import { useCallback } from 'react';
import type { LyricLine } from '@/types';

// Intl.Segmenter type declarations (may not exist in older TS lib versions)
declare global {
  namespace Intl {
    class Segmenter {
      constructor(locale?: string, options?: { granularity?: 'grapheme' | 'word' | 'sentence' });
      segment(input: string): Iterable<{ segment: string; index: number; isWordLike?: boolean }>;
    }
  }
}

/**
 * Uses Intl.Segmenter for locale-aware word boundary detection —
 * handles CJK, Arabic, emoji clusters, and compound words correctly.
 * Falls back to whitespace split on unsupported browsers.
 */
function segmentWords(text: string): string[] {
  if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
    try {
      const segmenter = new Intl.Segmenter('en', { granularity: 'word' });
      const segments = [...segmenter.segment(text)];
      // isWordLike: true for actual words, false for whitespace/punctuation
      return segments
        .filter(s => s.isWordLike)
        .map(s => s.segment);
    } catch {
      console.warn('[Intl.Segmenter] Segmentation failed, using whitespace split');
    }
  }
  // Fallback: split on whitespace, keeping punctuation attached to words
  return text.split(/\s+/).filter(w => w.length > 0);
}

/**
 * Estimate per-word timing within a lyric line using syllable-weight interpolation.
 * Words are weighted by character length (proxy for syllable count) to distribute
 * the available time proportionally — e.g. "beautiful" gets more time than "I".
 */
function estimateWordTimings(
  words: string[],
  lineStart: number,
  nextLineStart: number,
): Array<{ text: string; startTime: number; endTime: number }> {
  const availableDuration = Math.max(0.5, nextLineStart - lineStart - 0.05);

  // Weight = sqrt(charCount) — square root dampens extreme outliers
  const weights = words.map(w => Math.sqrt(Math.max(1, w.replace(/[^\w]/g, '').length)));
  const totalWeight = weights.reduce((a, b) => a + b, 0);

  let cursor = lineStart;
  return words.map((word, i) => {
    const fraction = weights[i] / totalWeight;
    const duration = fraction * availableDuration;
    const startTime = cursor;
    const endTime = cursor + duration;
    cursor = endTime;
    return { text: word, startTime, endTime };
  });
}

export function useLyricsParser() {
  const parseLRC = useCallback((lrcText: string): LyricLine[] => {
    const lines: LyricLine[] = [];
    // Support both [mm:ss.xx] and [mm:ss.xxx] timestamp formats
    const lineRegex = /\[(\d{1,2}):(\d{2})\.(\d{2,3})\](.*)/;

    const rawLines = lrcText.split('\n');
    for (const raw of rawLines) {
      const match = raw.match(lineRegex);
      if (match) {
        const minutes = parseInt(match[1]);
        const seconds = parseInt(match[2]);
        const ms = parseInt(match[3].padEnd(3, '0'));
        const time = minutes * 60 + seconds + ms / 1000;
        const text = match[4].trim();

        if (text) {
          lines.push({ time, text, words: [] }); // words filled in below
        }
      }
    }

    const sorted = lines.sort((a, b) => a.time - b.time);

    // Assign word-level timings using Intl.Segmenter + syllable weighting
    for (let i = 0; i < sorted.length; i++) {
      const line = sorted[i];
      const nextTime = sorted[i + 1]?.time ?? line.time + 4.0;
      const wordTokens = segmentWords(line.text);

      line.words = estimateWordTimings(wordTokens, line.time, nextTime);

      console.log(`[LyricsParser] Line ${i}: "${line.text}" → ${line.words.length} words via Intl.Segmenter`);
    }

    return sorted;
  }, []);

  const parsePlainText = useCallback((text: string): LyricLine[] => {
    const rawLines = text.split('\n').filter(l => l.trim().length > 0);
    const DEFAULT_LINE_DURATION = 3.5;

    const lines: LyricLine[] = rawLines.map((raw, index) => ({
      time: index * DEFAULT_LINE_DURATION,
      text: raw.trim(),
      words: [],
    }));

    // Assign word timings
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const nextTime = lines[i + 1]?.time ?? line.time + DEFAULT_LINE_DURATION;
      const wordTokens = segmentWords(line.text);
      line.words = estimateWordTimings(wordTokens, line.time, nextTime);
    }

    return lines;
  }, []);

  const getCurrentLine = useCallback((lyrics: LyricLine[], currentTime: number): LyricLine | null => {
    for (let i = lyrics.length - 1; i >= 0; i--) {
      if (currentTime >= lyrics[i].time) {
        return lyrics[i];
      }
    }
    return null;
  }, []);

  const getNextLine = useCallback((lyrics: LyricLine[], currentTime: number): LyricLine | null => {
    for (let i = 0; i < lyrics.length; i++) {
      if (lyrics[i].time > currentTime) {
        return lyrics[i];
      }
    }
    return null;
  }, []);

  /**
   * Returns the index of the currently active word within a lyric line.
   * Uses sub-frame precision: compares currentTime against each word's startTime/endTime.
   */
  const getActiveWordIndex = useCallback((line: LyricLine | null, currentTime: number): number => {
    if (!line?.words?.length) return -1;
    for (let i = line.words.length - 1; i >= 0; i--) {
      if (currentTime >= line.words[i].startTime) {
        return i;
      }
    }
    return -1;
  }, []);

  /**
   * Returns a 0-1 float representing how far through the current word we are.
   * Used for smooth sub-word highlight interpolation (e.g., color lerp, scale).
   */
  const getWordProgress = useCallback((line: LyricLine | null, wordIndex: number, currentTime: number): number => {
    if (!line?.words || wordIndex < 0 || wordIndex >= line.words.length) return 0;
    const word = line.words[wordIndex];
    const duration = word.endTime - word.startTime;
    if (duration <= 0) return 1;
    return Math.min(1, (currentTime - word.startTime) / duration);
  }, []);

  return {
    parseLRC,
    parsePlainText,
    getCurrentLine,
    getNextLine,
    getActiveWordIndex,
    getWordProgress,
  };
}
