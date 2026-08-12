import { useCallback, useRef, useState } from 'react';
import type { LyricLine } from '@/types';

export interface SyncResult {
  offsetSeconds: number;
  confidence: number;
  beatCount: number;
  detectedBPM: number;
}

export interface SyncState {
  status: 'idle' | 'scanning' | 'complete' | 'error';
  progress: number;
  result: SyncResult | null;
  errorMessage?: string;
}

/**
 * Detect onset positions (beat timestamps) from an AudioBuffer using Spectral Flux.
 * Returns sorted array of onset times in seconds.
 */
function detectOnsets(audioBuffer: AudioBuffer, sensitivity = 0.12): number[] {
  const sampleRate = audioBuffer.sampleRate;
  const channelData = audioBuffer.getChannelData(0);
  const frameSize = 2048;
  const hopSize = 512;
  const onsets: number[] = [];

  const prevSpectrum = new Float32Array(frameSize / 2);
  let prevFlux = 0;

  for (let i = 0; i + frameSize < channelData.length; i += hopSize) {
    // Extract frame
    const frame = channelData.slice(i, i + frameSize);

    // Simple magnitude spectrum (FFT approximation via autocorrelation for performance)
    const spectrum = new Float32Array(frameSize / 2);
    for (let k = 0; k < frameSize / 2; k++) {
      let re = 0, im = 0;
      for (let n = 0; n < frameSize; n++) {
        const angle = (2 * Math.PI * k * n) / frameSize;
        re += frame[n] * Math.cos(angle);
        im -= frame[n] * Math.sin(angle);
      }
      spectrum[k] = Math.sqrt(re * re + im * im) / frameSize;
    }

    // Spectral flux: sum positive differences
    let flux = 0;
    for (let k = 0; k < spectrum.length; k++) {
      const diff = spectrum[k] - prevSpectrum[k];
      if (diff > 0) flux += diff;
    }
    flux /= spectrum.length;

    // Half-wave rectified peak picking
    if (flux > sensitivity && flux > prevFlux * 1.2) {
      const time = i / sampleRate;
      // Debounce: avoid double triggers within 200ms
      if (onsets.length === 0 || time - onsets[onsets.length - 1] > 0.2) {
        onsets.push(time);
      }
    }

    prevSpectrum.set(spectrum);
    prevFlux = flux;
  }

  return onsets;
}

/**
 * Faster onset detection using RMS energy peaks (runs in < 500ms for 5min tracks).
 * Used as the default scanner since FFT over full audio is slow on main thread.
 */
function detectOnsetsRMS(audioBuffer: AudioBuffer, sensitivity = 0.08): number[] {
  const sampleRate = audioBuffer.sampleRate;
  const channelData = audioBuffer.getChannelData(0);
  const hopSize = Math.floor(sampleRate * 0.02); // 20ms hops
  const windowSize = Math.floor(sampleRate * 0.04); // 40ms window
  const onsets: number[] = [];

  const energyList: number[] = [];
  for (let i = 0; i + windowSize < channelData.length; i += hopSize) {
    let sum = 0;
    for (let j = i; j < i + windowSize; j++) {
      sum += channelData[j] * channelData[j];
    }
    energyList.push(Math.sqrt(sum / windowSize));
  }

  // Smooth energy
  const smoothed = energyList.map((v, i) => {
    const w = 5;
    const slice = energyList.slice(Math.max(0, i - w), i + w + 1);
    return slice.reduce((a, b) => a + b, 0) / slice.length;
  });

  // Peak pick
  const threshold = smoothed.reduce((a, b) => a + b, 0) / smoothed.length * (1 + sensitivity * 5);
  for (let i = 1; i < smoothed.length - 1; i++) {
    const v = smoothed[i];
    if (v > threshold && v > smoothed[i - 1] && v > smoothed[i + 1]) {
      const time = (i * hopSize) / sampleRate;
      if (onsets.length === 0 || time - onsets[onsets.length - 1] > 0.25) {
        onsets.push(time);
      }
    }
  }

  return onsets;
}

/**
 * Estimate BPM from an array of onset times using autocorrelation of inter-onset intervals.
 */
function estimateBPMFromOnsets(onsets: number[]): number {
  if (onsets.length < 4) return 120;
  const intervals: number[] = [];
  for (let i = 1; i < onsets.length; i++) {
    const ioi = onsets[i] - onsets[i - 1];
    if (ioi > 0.25 && ioi < 2.0) intervals.push(ioi);
  }
  if (intervals.length < 2) return 120;
  const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length;
  const bpm = Math.round(60 / avg);
  // Handle half-time / double-time
  if (bpm < 70) return bpm * 2;
  if (bpm > 180) return Math.round(bpm / 2);
  return bpm;
}

/**
 * Find the best offset to align lyrics lines to detected audio onsets.
 * Uses a sliding window correlation: for each candidate offset, count how many
 * lyric line times land within ±threshold of an onset.
 */
function findBestOffset(
  lyricsLines: LyricLine[],
  onsets: number[],
  maxOffsetSeconds = 30,
  stepMs = 100,
): { offset: number; score: number } {
  if (lyricsLines.length === 0 || onsets.length === 0) return { offset: 0, score: 0 };

  let bestOffset = 0;
  let bestScore = 0;
  const threshold = 0.35; // seconds — tolerance for considering a match
  const steps = (maxOffsetSeconds * 1000) / stepMs;

  for (let step = 0; step <= steps; step++) {
    const offset = step * (stepMs / 1000);
    let score = 0;

    for (const line of lyricsLines) {
      const shiftedTime = line.time + offset;
      // Check if any onset is within threshold
      const hasNearOnset = onsets.some(
        (o) => Math.abs(o - shiftedTime) <= threshold,
      );
      if (hasNearOnset) score++;
    }

    // Normalize by total lines
    const normalized = score / lyricsLines.length;
    if (normalized > bestScore) {
      bestScore = normalized;
      bestOffset = offset;
    }
  }

  return { offset: bestOffset, score: bestScore };
}

export function useLyricSync() {
  const [syncState, setSyncState] = useState<SyncState>({
    status: 'idle',
    progress: 0,
    result: null,
  });

  const cancelRef = useRef(false);

  /**
   * Main scan function. Analyzes the audio buffer and finds the best
   * lyric offset to align lyrics lines to audio onsets.
   */
  const scan = useCallback(async (
    audioBuffer: AudioBuffer,
    lyrics: LyricLine[],
    options?: { sensitivity?: number; maxOffset?: number },
  ) => {
    cancelRef.current = false;
    setSyncState({ status: 'scanning', progress: 0, result: null });

    await new Promise(r => setTimeout(r, 0)); // yield to UI

    try {
      setSyncState(prev => ({ ...prev, progress: 15 }));
      console.log('[LyricSync] Starting RMS onset detection...');

      // Step 1: Detect onsets using RMS energy (fast, < 200ms)
      const onsets = detectOnsetsRMS(audioBuffer, options?.sensitivity ?? 0.08);
      console.log(`[LyricSync] Detected ${onsets.length} onsets`);

      if (cancelRef.current) return;
      setSyncState(prev => ({ ...prev, progress: 45 }));

      // Step 2: Estimate BPM
      const bpm = estimateBPMFromOnsets(onsets);
      console.log(`[LyricSync] Estimated BPM: ${bpm}`);

      if (cancelRef.current) return;
      setSyncState(prev => ({ ...prev, progress: 65 }));

      // Step 3: Find best lyric offset
      const { offset, score } = findBestOffset(
        lyrics,
        onsets,
        options?.maxOffset ?? 30,
      );
      console.log(`[LyricSync] Best offset: ${offset.toFixed(2)}s, score: ${(score * 100).toFixed(1)}%`);

      setSyncState(prev => ({ ...prev, progress: 90 }));
      await new Promise(r => setTimeout(r, 80));

      const result: SyncResult = {
        offsetSeconds: offset,
        confidence: score,
        beatCount: onsets.length,
        detectedBPM: bpm,
      };

      setSyncState({ status: 'complete', progress: 100, result });
    } catch (err) {
      console.error('[LyricSync] Scan error:', err);
      setSyncState({ status: 'error', progress: 0, result: null, errorMessage: String(err) });
    }
  }, []);

  const cancel = useCallback(() => {
    cancelRef.current = true;
    setSyncState({ status: 'idle', progress: 0, result: null });
  }, []);

  const reset = useCallback(() => {
    setSyncState({ status: 'idle', progress: 0, result: null });
  }, []);

  /**
   * Apply an offset to all lyric lines, returning a new array.
   * Clamps negative times to 0.
   */
  const applyOffset = useCallback((lyrics: LyricLine[], offsetSeconds: number): LyricLine[] => {
    return lyrics.map(line => ({
      ...line,
      time: Math.max(0, line.time - offsetSeconds),
      words: line.words?.map(w => ({
        ...w,
        startTime: Math.max(0, w.startTime - offsetSeconds),
        endTime: Math.max(0, w.endTime - offsetSeconds),
      })),
    }));
  }, []);

  /**
   * Build a new raw LRC string from a lyrics array (for editor display).
   */
  const toLRCString = useCallback((lyrics: LyricLine[]): string => {
    return lyrics.map(line => {
      const t = Math.max(0, line.time);
      const m = Math.floor(t / 60).toString().padStart(2, '0');
      const s = (t % 60).toFixed(2).padStart(5, '0');
      return `[${m}:${s}]${line.text}`;
    }).join('\n');
  }, []);

  return { syncState, scan, cancel, reset, applyOffset, toLRCString };
}
