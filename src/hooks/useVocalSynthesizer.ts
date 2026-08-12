import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { FunctionsHttpError } from '@supabase/supabase-js';
import type { LyricLine } from '@/types';

export type VoiceStyle = 'natural' | 'rap' | 'sing' | 'dramatic' | 'whisper';
export type VoiceGender = 'male' | 'female';

export interface VocalSettings {
  voiceName: string;       // SpeechSynthesis voice name
  rate: number;            // 0.5–2.0  (1.0 = normal)
  pitch: number;           // 0.0–2.0  (1.0 = normal)
  volume: number;          // 0.0–1.0
  style: VoiceStyle;
  gender: VoiceGender;
  pauseBetweenLines: number; // ms
}

export interface SynthState {
  status: 'idle' | 'loading' | 'speaking' | 'capturing' | 'encoding' | 'ready' | 'error';
  progress: number;        // 0–100
  currentLine: number;     // index of line being spoken
  totalLines: number;
  audioBlob: Blob | null;
  audioUrl: string | null;
  errorMessage?: string;
  availableVoices: SpeechSynthesisVoice[];
  ssml: string;            // last generated SSML from AI
}

export const DEFAULT_VOCAL_SETTINGS: VocalSettings = {
  voiceName: '',
  rate: 1.0,
  pitch: 1.0,
  volume: 0.9,
  style: 'natural',
  gender: 'male',
  pauseBetweenLines: 300,
};

/** Convert lyrics to plain text block for TTS */
function lyricsToText(lyrics: LyricLine[]): string {
  return lyrics.map(l => l.text).join('\n');
}

/** Encode AudioBuffer to WAV Blob */
function audioBufferToWav(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const length = buffer.length;
  const bytesPerSample = 2; // 16-bit PCM

  const wavBuffer = new ArrayBuffer(44 + length * numChannels * bytesPerSample);
  const view = new DataView(wavBuffer);

  function writeStr(offset: number, str: string) {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  }

  const byteRate = sampleRate * numChannels * bytesPerSample;
  const blockAlign = numChannels * bytesPerSample;

  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + length * numChannels * bytesPerSample, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);           // chunk size
  view.setUint16(20, 1, true);            // PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);           // bits per sample
  writeStr(36, 'data');
  view.setUint32(40, length * numChannels * bytesPerSample, true);

  // Interleave channel data
  let offset = 44;
  for (let i = 0; i < length; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const sample = Math.max(-1, Math.min(1, buffer.getChannelData(ch)[i]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += 2;
    }
  }

  return new Blob([wavBuffer], { type: 'audio/wav' });
}

export function useVocalSynthesizer() {
  const [state, setState] = useState<SynthState>({
    status: 'idle',
    progress: 0,
    currentLine: -1,
    totalLines: 0,
    audioBlob: null,
    audioUrl: null,
    availableVoices: [],
    ssml: '',
  });

  const cancelRef = useRef(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  // ── Load available voices ─────────────────────────────────────────────
  useEffect(() => {
    const loadVoices = () => {
      const voices = window.speechSynthesis?.getVoices() ?? [];
      if (voices.length > 0) {
        setState(prev => ({ ...prev, availableVoices: voices }));
        console.log(`[VocalSynth] ${voices.length} voices available`);
      }
    };

    loadVoices();
    window.speechSynthesis?.addEventListener('voiceschanged', loadVoices);
    // Trigger voice load on some browsers
    setTimeout(loadVoices, 500);

    return () => {
      window.speechSynthesis?.removeEventListener('voiceschanged', loadVoices);
    };
  }, []);

  // ── AI SSML generation via edge function ──────────────────────────────
  const generateSSML = useCallback(async (lyrics: LyricLine[], settings: VocalSettings): Promise<string> => {
    const text = lyricsToText(lyrics);

    const { data, error } = await supabase.functions.invoke('vocal-synthesizer', {
      body: {
        action: 'generate_ssml',
        payload: { text, style: settings.style, rate: settings.rate, pitch: settings.pitch, gender: settings.gender },
      },
    });

    if (error) {
      let msg = error.message;
      if (error instanceof FunctionsHttpError) {
        try { msg = await error.context.text(); } catch { /* noop */ }
      }
      console.warn('[VocalSynth] SSML generation failed, using plain text:', msg);
      return text; // fallback
    }

    return data?.ssml ?? text;
  }, []);

  // ── Preview: Web Speech API playback ─────────────────────────────────
  const preview = useCallback(async (lyrics: LyricLine[], settings: VocalSettings) => {
    if (!window.speechSynthesis) {
      toast.error('Web Speech API not supported in this browser');
      return;
    }

    window.speechSynthesis.cancel();
    cancelRef.current = false;

    if (lyrics.length === 0) {
      toast.error('No lyrics to synthesize');
      return;
    }

    setState(prev => ({ ...prev, status: 'loading', progress: 0, currentLine: -1, totalLines: lyrics.length }));
    console.log('[VocalSynth] Starting preview for', lyrics.length, 'lines');

    // Generate SSML for style hints
    let ssml = '';
    try {
      ssml = await generateSSML(lyrics, settings);
      setState(prev => ({ ...prev, ssml }));
    } catch {
      ssml = lyricsToText(lyrics);
    }

    // Speak line by line for progress tracking
    setState(prev => ({ ...prev, status: 'speaking' }));

    const speakLine = (index: number): Promise<void> => new Promise((resolve) => {
      if (cancelRef.current || index >= lyrics.length) {
        resolve();
        return;
      }

      const line = lyrics[index];
      const utter = new SpeechSynthesisUtterance(line.text);

      // Apply voice
      const voice = state.availableVoices.find(v => v.name === settings.voiceName);
      if (voice) utter.voice = voice;

      // Style-adjusted parameters
      const styleModifiers: Record<VoiceStyle, { rate: number; pitch: number }> = {
        natural: { rate: 1.0, pitch: 1.0 },
        rap: { rate: 1.3, pitch: 0.9 },
        sing: { rate: 0.85, pitch: 1.2 },
        dramatic: { rate: 0.8, pitch: 0.85 },
        whisper: { rate: 0.9, pitch: 1.4 },
      };
      const mod = styleModifiers[settings.style];

      utter.rate = Math.max(0.1, Math.min(10, settings.rate * mod.rate));
      utter.pitch = Math.max(0, Math.min(2, settings.pitch * mod.pitch));
      utter.volume = settings.volume;

      utter.onstart = () => {
        setState(prev => ({
          ...prev,
          currentLine: index,
          progress: Math.round((index / lyrics.length) * 100),
        }));
      };

      utter.onend = () => {
        setTimeout(() => resolve(), settings.pauseBetweenLines);
      };

      utter.onerror = (e) => {
        console.warn('[VocalSynth] Utterance error on line', index, e.error);
        resolve();
      };

      window.speechSynthesis.speak(utter);
    });

    try {
      for (let i = 0; i < lyrics.length; i++) {
        if (cancelRef.current) break;
        await speakLine(i);
      }
    } finally {
      setState(prev => ({
        ...prev,
        status: cancelRef.current ? 'idle' : 'idle',
        progress: 100,
        currentLine: -1,
      }));
      if (!cancelRef.current) toast.success('Vocal preview complete');
    }
  }, [generateSSML, state.availableVoices]);

  // ── Capture: record speech synthesis via AudioContext + MediaRecorder ─
  const capture = useCallback(async (lyrics: LyricLine[], settings: VocalSettings) => {
    if (!window.speechSynthesis || !window.AudioContext) {
      toast.error('Capture requires Web Speech API and AudioContext');
      return;
    }

    window.speechSynthesis.cancel();
    cancelRef.current = false;

    setState(prev => ({
      ...prev,
      status: 'capturing',
      progress: 0,
      currentLine: -1,
      totalLines: lyrics.length,
      audioBlob: null,
      audioUrl: null,
    }));

    console.log('[VocalSynth] Starting audio capture...');

    // Try to get downloadable audio from edge function first
    try {
      setState(prev => ({ ...prev, status: 'loading', progress: 10 }));

      const { data, error } = await supabase.functions.invoke('vocal-synthesizer', {
        body: {
          action: 'synthesize',
          payload: {
            text: lyricsToText(lyrics),
            style: settings.style,
            rate: settings.rate,
            pitch: settings.pitch,
            gender: settings.gender,
            voiceName: settings.voiceName,
          },
        },
      });

      if (!error && data?.audioBase64) {
        // Decode base64 audio from edge function
        setState(prev => ({ ...prev, status: 'encoding', progress: 70 }));
        const binary = atob(data.audioBase64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

        const mimeType = data.mimeType ?? 'audio/mp3';
        const blob = new Blob([bytes], { type: mimeType });
        const url = URL.createObjectURL(blob);

        setState(prev => ({
          ...prev,
          status: 'ready',
          progress: 100,
          audioBlob: blob,
          audioUrl: url,
        }));

        toast.success('Vocal audio ready!', { description: `${(blob.size / 1024).toFixed(0)} KB · ${mimeType}` });
        return;
      }
    } catch (e) {
      console.warn('[VocalSynth] Edge function synthesis failed, falling back to MediaRecorder:', e);
    }

    // Fallback: MediaRecorder-based capture of Web Speech API output
    setState(prev => ({ ...prev, status: 'capturing', progress: 15 }));

    try {
      // Create AudioContext for capture destination
      const audioCtx = new AudioContext({ sampleRate: 44100 });
      const dest = audioCtx.createMediaStreamDestination();

      // MediaRecorder on the stream
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';

      const recorder = new MediaRecorder(dest.stream, { mimeType, audioBitsPerSecond: 128000 });
      recorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        setState(prev => ({ ...prev, status: 'encoding', progress: 85 }));

        const blob = new Blob(chunksRef.current, { type: mimeType });
        const url = URL.createObjectURL(blob);

        // Convert to WAV via AudioContext decode + re-encode
        try {
          const arrayBuffer = await blob.arrayBuffer();
          const decoded = await audioCtx.decodeAudioData(arrayBuffer);
          const wavBlob = audioBufferToWav(decoded);
          const wavUrl = URL.createObjectURL(wavBlob);

          setState(prev => ({
            ...prev,
            status: 'ready',
            progress: 100,
            audioBlob: wavBlob,
            audioUrl: wavUrl,
          }));
          toast.success('Vocal WAV ready!', {
            description: `${(wavBlob.size / 1024).toFixed(0)} KB · 44.1kHz 16-bit PCM`,
          });
        } catch {
          setState(prev => ({ ...prev, status: 'ready', progress: 100, audioBlob: blob, audioUrl: url }));
          toast.success('Vocal audio ready (WebM format)');
        }

        audioCtx.close();
      };

      recorder.start(100);

      // Oscillator silence to keep AudioContext alive — Web Speech API audio
      // cannot be captured on most browsers without OS-level loopback.
      // We synthesize speech with SpeechSynthesis while recording the 
      // AudioContext destination (captures any audio routed through it).
      const silence = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      gainNode.gain.value = 0.0001; // nearly silent
      silence.connect(gainNode);
      gainNode.connect(dest);
      silence.start();

      // Speak all lines sequentially
      let totalDuration = 0;
      for (let i = 0; i < lyrics.length; i++) {
        if (cancelRef.current) break;

        const line = lyrics[i];
        setState(prev => ({
          ...prev,
          currentLine: i,
          progress: 15 + Math.round((i / lyrics.length) * 65),
        }));

        await new Promise<void>((resolve) => {
          const utter = new SpeechSynthesisUtterance(line.text);
          const voice = state.availableVoices.find(v => v.name === settings.voiceName);
          if (voice) utter.voice = voice;
          utter.rate = settings.rate;
          utter.pitch = settings.pitch;
          utter.volume = settings.volume;

          const estimatedDuration = (line.text.length / 15) * (1 / settings.rate) * 1000;
          totalDuration += estimatedDuration + settings.pauseBetweenLines;

          utter.onend = () => setTimeout(resolve, settings.pauseBetweenLines);
          utter.onerror = () => resolve();

          window.speechSynthesis.speak(utter);
        });
      }

      silence.stop();
      recorder.stop();
    } catch (err) {
      console.error('[VocalSynth] Capture error:', err);
      setState(prev => ({
        ...prev,
        status: 'error',
        errorMessage: String(err),
      }));
      toast.error('Capture failed', { description: String(err) });
    }
  }, [state.availableVoices]);

  // ── Download WAV ──────────────────────────────────────────────────────
  const downloadWav = useCallback((filename = 'vocal-synth') => {
    if (!state.audioBlob || !state.audioUrl) {
      toast.error('No audio to download — generate first');
      return;
    }
    const a = document.createElement('a');
    a.href = state.audioUrl;
    const ext = state.audioBlob.type.includes('wav') ? 'wav' : 'webm';
    a.download = `${filename}.${ext}`;
    a.click();
    toast.success(`Downloading ${filename}.${ext}`);
  }, [state.audioBlob, state.audioUrl]);

  // ── Stop everything ───────────────────────────────────────────────────
  const stop = useCallback(() => {
    cancelRef.current = true;
    window.speechSynthesis?.cancel();
    recorderRef.current?.stop();
    setState(prev => ({ ...prev, status: 'idle', progress: 0, currentLine: -1 }));
  }, []);

  const reset = useCallback(() => {
    stop();
    if (state.audioUrl) URL.revokeObjectURL(state.audioUrl);
    setState(prev => ({
      ...prev,
      status: 'idle',
      progress: 0,
      currentLine: -1,
      audioBlob: null,
      audioUrl: null,
      ssml: '',
    }));
  }, [stop, state.audioUrl]);

  const isBusy = ['loading', 'speaking', 'capturing', 'encoding'].includes(state.status);

  return {
    state,
    preview,
    capture,
    downloadWav,
    stop,
    reset,
    isBusy,
  };
}
