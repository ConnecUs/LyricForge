import type { VisualStyle } from '@/types';

export const VISUAL_STYLES: VisualStyle[] = [
  {
    id: 'azure-hud',
    name: 'Azure HUD',
    description: 'Electric blue particles with HUD grid overlay',
    particleConfig: {
      count: 800,
      speed: 0.8,
      size: 1.5,
      turbulence: 0.6,
      colorPrimary: '#0b84f3',
      colorAccent: '#00e5ff',
    },
    typographyEffect: 'glow',
    backgroundEffect: 'grid',
    colorScheme: 'azure',
  },
  {
    id: 'neon-aurora',
    name: 'Neon Aurora',
    description: 'Flowing magenta and teal aurora streams',
    particleConfig: {
      count: 600,
      speed: 0.6,
      size: 2,
      turbulence: 0.9,
      colorPrimary: '#d946ef',
      colorAccent: '#00ffd4',
    },
    typographyEffect: 'chromatic',
    backgroundEffect: 'aurora',
    colorScheme: 'magenta',
  },
  {
    id: 'cyber-wave',
    name: 'Cyber Wave',
    description: 'Teal waveform with particle explosion on beats',
    particleConfig: {
      count: 1000,
      speed: 1.2,
      size: 1,
      turbulence: 0.4,
      colorPrimary: '#00ffd4',
      colorAccent: '#0b84f3',
    },
    typographyEffect: 'wave',
    backgroundEffect: 'waveform',
    colorScheme: 'teal',
  },
  {
    id: 'golden-hour',
    name: 'Golden Hour',
    description: 'Warm amber particles with zoom blur typography',
    particleConfig: {
      count: 500,
      speed: 0.5,
      size: 2.5,
      turbulence: 0.7,
      colorPrimary: '#f59e0b',
      colorAccent: '#ef4444',
    },
    typographyEffect: 'zoom',
    backgroundEffect: 'particles',
    colorScheme: 'amber',
  },
];

export const SAMPLE_LYRICS = `[00:05.00]Welcome to the future of music
[00:10.00]Where pixels dance and frequencies ignite
[00:15.00]Electric dreams in digital light
[00:20.00]Every beat a frame of infinite sight
[00:25.00]Words that glow and drift through space
[00:30.00]Kinetic type at a futuristic pace
[00:35.00]Audio waves become a visual art
[00:40.00]A generative engine of the heart`;

export const FPS_OPTIONS = [24, 30, 60];
export const RESOLUTION_OPTIONS = ['720p', '1080p', '4K'] as const;

export const FREQUENCY_BANDS = [
  { label: 'Sub', range: [20, 60] as [number, number], color: '#ef4444' },
  { label: 'Bass', range: [60, 250] as [number, number], color: '#f59e0b' },
  { label: 'Low-Mid', range: [250, 500] as [number, number], color: '#22c55e' },
  { label: 'Mid', range: [500, 2000] as [number, number], color: '#0b84f3' },
  { label: 'High-Mid', range: [2000, 4000] as [number, number], color: '#00e5ff' },
  { label: 'High', range: [4000, 20000] as [number, number], color: '#d946ef' },
];

export const CODEC_OPTIONS = ['H.264 (MP4)', 'VP9 (WebM)', 'H.265 (MP4)', 'AV1 (WebM)'];
