import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { FunctionsHttpError } from '@supabase/supabase-js';

export interface LyricistOptions {
  genre: string;
  theme: string;
  section: 'Verse' | 'Chorus' | 'Bridge' | 'Hook' | 'Outro' | 'Intro';
  mood: string;
  bpm: number;
  rhymeScheme: 'AABB' | 'ABAB' | 'ABBA' | 'AAAA' | 'Free';
  existingLyrics?: string;
}

export interface RhymeAnalysis {
  syllableCount: number;
  rhymeScheme: string;
  avgSyllablesPerLine: number;
  rhymingWords: string[][];
  suggestedFlow: string;
}

export interface AILyricistState {
  status: 'idle' | 'generating' | 'refining' | 'analyzing' | 'error';
  generatedLyrics: string;
  analysis: RhymeAnalysis | null;
  rhymeSuggestions: string[];
  errorMessage?: string;
}

export function useAILyricist() {
  const [state, setState] = useState<AILyricistState>({
    status: 'idle',
    generatedLyrics: '',
    analysis: null,
    rhymeSuggestions: [],
  });

  const callEdgeFunction = useCallback(async (action: string, payload: Record<string, unknown>): Promise<string> => {
    const { data, error } = await supabase.functions.invoke('ai-lyricist', {
      body: { action, payload },
    });

    if (error) {
      let errorMessage = error.message;
      if (error instanceof FunctionsHttpError) {
        try {
          const statusCode = error.context?.status ?? 500;
          const textContent = await error.context?.text();
          errorMessage = `[Code: ${statusCode}] ${textContent || error.message}`;
        } catch {
          errorMessage = error.message;
        }
      }
      throw new Error(errorMessage);
    }

    return data?.content ?? '';
  }, []);

  const generateLyrics = useCallback(async (options: LyricistOptions) => {
    setState(prev => ({ ...prev, status: 'generating', errorMessage: undefined }));
    console.log('[AILyricist] Generating lyrics:', options);

    const content = await callEdgeFunction('generate', options);
    setState(prev => ({
      ...prev,
      status: 'idle',
      generatedLyrics: content,
    }));
    toast.success('Lyrics generated!', { description: `${content.split('\n').filter(Boolean).length} lines written` });
    return content;
  }, [callEdgeFunction]);

  const refineLyrics = useCallback(async (lyrics: string, instruction: string) => {
    setState(prev => ({ ...prev, status: 'refining', errorMessage: undefined }));
    console.log('[AILyricist] Refining lyrics...');

    const content = await callEdgeFunction('refine', { lyrics, instruction });
    setState(prev => ({
      ...prev,
      status: 'idle',
      generatedLyrics: content,
    }));
    toast.success('Lyrics refined!');
    return content;
  }, [callEdgeFunction]);

  const getRhymes = useCallback(async (word: string) => {
    if (!word.trim()) return [];
    const content = await callEdgeFunction('rhyme', { word: word.trim(), count: 12 });
    try {
      // Try to extract JSON array from response
      const match = content.match(/\[[\s\S]*\]/);
      const rhymes: string[] = match ? JSON.parse(match[0]) : content.split(',').map((s: string) => s.trim().replace(/["\[\]]/g, ''));
      setState(prev => ({ ...prev, rhymeSuggestions: rhymes }));
      return rhymes;
    } catch {
      const fallback = content.split(/[\n,]/).map((s: string) => s.trim().replace(/["\[\]]/g, '')).filter(Boolean);
      setState(prev => ({ ...prev, rhymeSuggestions: fallback }));
      return fallback;
    }
  }, [callEdgeFunction]);

  const analyzeLyrics = useCallback(async (lyrics: string) => {
    if (!lyrics.trim()) return null;
    setState(prev => ({ ...prev, status: 'analyzing', errorMessage: undefined }));

    const content = await callEdgeFunction('analyze', { lyrics });
    try {
      const match = content.match(/\{[\s\S]*\}/);
      const analysis: RhymeAnalysis = match ? JSON.parse(match[0]) : {
        syllableCount: 0, rhymeScheme: 'Unknown', avgSyllablesPerLine: 0,
        rhymingWords: [], suggestedFlow: 'Unable to analyze',
      };
      setState(prev => ({ ...prev, status: 'idle', analysis }));
      return analysis;
    } catch {
      setState(prev => ({ ...prev, status: 'idle', analysis: null }));
      return null;
    }
  }, [callEdgeFunction]);

  const reset = useCallback(() => {
    setState({
      status: 'idle',
      generatedLyrics: '',
      analysis: null,
      rhymeSuggestions: [],
    });
  }, []);

  return { state, generateLyrics, refineLyrics, getRhymes, analyzeLyrics, reset };
}
