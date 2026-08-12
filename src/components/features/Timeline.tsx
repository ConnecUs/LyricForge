import { useRef, useCallback } from 'react';
import type { LyricLine } from '@/types';

interface TimelineProps {
  currentTime: number;
  duration: number;
  lyrics: LyricLine[];
  isPlaying: boolean;
  onSeek: (time: number) => void;
}

export function Timeline({ currentTime, duration, lyrics, isPlaying, onSeek }: TimelineProps) {
  const trackRef = useRef<HTMLDivElement>(null);

  const handleSeek = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const track = trackRef.current;
    if (!track || duration === 0) return;
    const rect = track.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    onSeek(ratio * duration);
  }, [duration, onSeek]);

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  const formatTime = (s: number) => {
    if (!isFinite(s)) return '0:00';
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <div className="glass-panel border-t border-[hsl(var(--hud-border)/0.4)] px-4 py-2">
      {/* Time labels */}
      <div className="flex justify-between items-center mb-1">
        <span className="text-[10px] font-mono text-[hsl(var(--hud-blue))]">{formatTime(currentTime)}</span>
        <span className="text-[9px] font-mono text-[hsl(var(--muted-foreground))]">
          {isPlaying ? '▶ LIVE' : '⏸ PAUSED'}
        </span>
        <span className="text-[10px] font-mono text-[hsl(var(--muted-foreground))]">{formatTime(duration)}</span>
      </div>

      {/* Scrubber track */}
      <div
        ref={trackRef}
        className="relative h-8 cursor-pointer group"
        onClick={handleSeek}
        onTouchStart={handleSeek}
      >
        {/* Track base */}
        <div className="absolute top-1/2 -translate-y-1/2 w-full h-1.5 rounded-full bg-[hsl(var(--border)/0.6)] overflow-hidden">
          {/* Progress fill */}
          <div
            className="h-full rounded-full transition-none"
            style={{
              width: `${progress}%`,
              background: 'linear-gradient(90deg, hsl(213, 95%, 40%), hsl(213, 95%, 60%))',
              boxShadow: '0 0 8px hsl(213, 95%, 50%)',
            }}
          />
        </div>

        {/* Lyric markers */}
        {lyrics.map((line, i) => {
          const pos = duration > 0 ? (line.time / duration) * 100 : 0;
          return (
            <div
              key={i}
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[hsl(var(--hud-magenta)/0.7)] transition-all"
              style={{ left: `${pos}%` }}
              title={line.text}
            />
          );
        })}

        {/* Playhead */}
        <div
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3.5 h-3.5 rounded-full border-2 border-[hsl(var(--hud-blue))] bg-white shadow-lg transition-none group-hover:scale-125"
          style={{
            left: `${progress}%`,
            boxShadow: '0 0 12px hsl(213, 95%, 50%), 0 0 24px hsl(213, 95%, 50%, 0.3)',
          }}
        />
      </div>

      {/* Frame counter */}
      <div className="flex items-center justify-between mt-0.5">
        <span className="text-[9px] font-mono text-[hsl(var(--muted-foreground))]">
          FRAME {Math.floor(currentTime * 30).toString().padStart(6, '0')}
        </span>
        <span className="text-[9px] font-mono text-[hsl(var(--muted-foreground))]">
          {lyrics.length} MARKERS
        </span>
        <span className="text-[9px] font-mono text-[hsl(var(--muted-foreground))]">
          30 FPS · 1080p
        </span>
      </div>
    </div>
  );
}
