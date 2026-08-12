import { useState, useRef, useCallback, useEffect } from 'react';
import type { AudioAnalysisData } from '@/types';

const DEFAULT_DATA: AudioAnalysisData = {
  frequencyData: new Uint8Array(256),
  timeDomainData: new Uint8Array(256),
  bassLevel: 0,
  midLevel: 0,
  highLevel: 0,
  rmsEnergy: 0,
  spectralFlux: 0,
  bpm: 120,
};

export function useAudioAnalyzer() {
  const [analysisData, setAnalysisData] = useState<AudioAnalysisData>(DEFAULT_DATA);
  const [isReady, setIsReady] = useState(false);
  const [bpm, setBpm] = useState(120);

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const rafRef = useRef<number>(0);
  const prevFreqRef = useRef<Uint8Array>(new Uint8Array(256));
  const onsetHistoryRef = useRef<number[]>([]);

  const connectAudio = useCallback((audioElement: HTMLAudioElement) => {
    if (sourceRef.current) {
      sourceRef.current.disconnect();
    }

    if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
      audioContextRef.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    }

    const ctx = audioContextRef.current;
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0.8;
    analyserRef.current = analyser;

    const source = ctx.createMediaElementSource(audioElement);
    source.connect(analyser);
    analyser.connect(ctx.destination);
    sourceRef.current = source;

    setIsReady(true);
    console.log('Audio analyzer connected, sampleRate:', ctx.sampleRate);
  }, []);

  const getFrequencyAverage = (data: Uint8Array, startBin: number, endBin: number): number => {
    let sum = 0;
    const count = endBin - startBin;
    for (let i = startBin; i < endBin; i++) {
      sum += data[i];
    }
    return count > 0 ? sum / count / 255 : 0;
  };

  const calculateSpectralFlux = (current: Uint8Array, previous: Uint8Array): number => {
    let flux = 0;
    for (let i = 0; i < current.length; i++) {
      const diff = current[i] - previous[i];
      if (diff > 0) flux += diff;
    }
    return Math.min(flux / (current.length * 255), 1);
  };

  const calculateRMS = (data: Uint8Array): number => {
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
      const normalized = (data[i] - 128) / 128;
      sum += normalized * normalized;
    }
    return Math.sqrt(sum / data.length);
  };

  const estimateBPM = useCallback((flux: number, timestamp: number) => {
    if (flux > 0.15) {
      const history = onsetHistoryRef.current;
      history.push(timestamp);
      if (history.length > 32) history.shift();

      if (history.length >= 4) {
        let intervals: number[] = [];
        for (let i = 1; i < history.length; i++) {
          const interval = history[i] - history[i - 1];
          if (interval > 200 && interval < 2000) {
            intervals.push(interval);
          }
        }
        if (intervals.length > 2) {
          const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
          const estimatedBpm = Math.round(60000 / avgInterval);
          if (estimatedBpm > 60 && estimatedBpm < 240) {
            setBpm(estimatedBpm);
          }
        }
      }
    }
  }, []);

  const tick = useCallback(() => {
    const analyser = analyserRef.current;
    if (!analyser) {
      rafRef.current = requestAnimationFrame(tick);
      return;
    }

    const bufferLength = analyser.frequencyBinCount;
    const freqData = new Uint8Array(bufferLength);
    const timeData = new Uint8Array(bufferLength);
    analyser.getByteFrequencyData(freqData);
    analyser.getByteTimeDomainData(timeData);

    // Frequency bands (for 44100Hz sample rate, 1024 bins, each bin = ~43Hz)
    const bassLevel = getFrequencyAverage(freqData, 1, 5);      // ~20-215Hz
    const midLevel = getFrequencyAverage(freqData, 5, 47);      // ~215-2021Hz
    const highLevel = getFrequencyAverage(freqData, 47, 200);   // ~2021-8600Hz

    const rmsEnergy = calculateRMS(timeData);
    const flux = calculateSpectralFlux(freqData, prevFreqRef.current);

    estimateBPM(flux, performance.now());

    prevFreqRef.current = new Uint8Array(freqData);

    setAnalysisData({
      frequencyData: freqData,
      timeDomainData: timeData,
      bassLevel,
      midLevel,
      highLevel,
      rmsEnergy,
      spectralFlux: flux,
      bpm,
    });

    rafRef.current = requestAnimationFrame(tick);
  }, [bpm, estimateBPM]);

  const startAnalysis = useCallback(() => {
    if (audioContextRef.current?.state === 'suspended') {
      audioContextRef.current.resume();
    }
    rafRef.current = requestAnimationFrame(tick);
  }, [tick]);

  const stopAnalysis = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
  }, []);

  useEffect(() => {
    return () => {
      cancelAnimationFrame(rafRef.current);
      audioContextRef.current?.close();
    };
  }, []);

  return {
    analysisData,
    isReady,
    bpm,
    connectAudio,
    startAnalysis,
    stopAnalysis,
  };
}
