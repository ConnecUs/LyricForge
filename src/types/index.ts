export interface LyricLine {
  time: number; // seconds
  text: string;
  words?: LyricWord[];
}

export interface LyricWord {
  text: string;
  startTime: number;  // sub-frame precision via Intl.Segmenter
  endTime: number;
  syllableWeight?: number; // optional: used for timing distribution
}

export interface AudioAnalysisData {
  frequencyData: Uint8Array;
  timeDomainData: Uint8Array;
  bassLevel: number;       // 0-1
  midLevel: number;        // 0-1
  highLevel: number;       // 0-1
  rmsEnergy: number;       // 0-1
  spectralFlux: number;    // 0-1 beat detection
  bpm: number;
}

export interface ParticleConfig {
  count: number;
  speed: number;
  size: number;
  turbulence: number;
  colorPrimary: string;
  colorAccent: string;
}

export interface VisualStyle {
  id: string;
  name: string;
  description: string;
  particleConfig: ParticleConfig;
  typographyEffect: 'glow' | 'chromatic' | 'wave' | 'zoom' | 'split';
  backgroundEffect: 'aurora' | 'grid' | 'particles' | 'waveform';
  colorScheme: 'azure' | 'magenta' | 'teal' | 'amber';
}

export interface ProjectState {
  audioFile: File | null;
  audioUrl: string | null;
  lyrics: LyricLine[];
  currentStyle: VisualStyle;
  duration: number;
  currentTime: number;
  isPlaying: boolean;
  fps: number;
  resolution: '1080p' | '720p' | '4K';
}

export interface RenderJob {
  id: string;
  status: 'idle' | 'analyzing' | 'rendering' | 'encoding' | 'complete' | 'error';
  progress: number;
  currentFrame: number;
  totalFrames: number;
  estimatedTime: number;
  fps: number;
}

export interface FrequencyBand {
  label: string;
  range: [number, number]; // Hz
  level: number;
  color: string;
}

export type PanelId = 'audio' | 'lyrics' | 'style' | 'render' | 'timeline';
