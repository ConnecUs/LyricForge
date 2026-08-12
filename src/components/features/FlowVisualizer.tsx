import { useEffect, useRef, useState, useCallback } from 'react';
import { X, Play, Pause, SkipBack, ChevronLeft, ChevronRight } from 'lucide-react';
import type { LyricLine } from '@/types';

interface FlowVisualizerProps {
  lyrics: LyricLine[];
  audioRef: React.RefObject<HTMLAudioElement>;
  isOpen: boolean;
  onClose: () => void;
}

export function FlowVisualizer({ lyrics, audioRef, isOpen, onClose }: FlowVisualizerProps) {
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeLineIndex, setActiveLineIndex] = useState(-1);
  const [activeWordIndex, setActiveWordIndex] = useState(-1);
  const [wordProgress, setWordProgress] = useState(0);
  const lyricsContainerRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);
  const playheadRef = useRef<HTMLDivElement>(null);

  // Sync with audio element
  const tick = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const t = audio.currentTime;
    setCurrentTime(t);
    setIsPlaying(!audio.paused);
    setDuration(audio.duration || 0);

    // Find active line
    let lineIdx = -1;
    for (let i = lyrics.length - 1; i >= 0; i--) {
      if (t >= lyrics[i].time) { lineIdx = i; break; }
    }
    setActiveLineIndex(lineIdx);

    // Find active word
    if (lineIdx >= 0 && lyrics[lineIdx]?.words?.length) {
      const words = lyrics[lineIdx].words!;
      let wordIdx = -1;
      for (let w = words.length - 1; w >= 0; w--) {
        if (t >= words[w].startTime) { wordIdx = w; break; }
      }
      setActiveWordIndex(wordIdx);
      if (wordIdx >= 0) {
        const word = words[wordIdx];
        const dur = word.endTime - word.startTime;
        setWordProgress(dur > 0 ? Math.min(1, (t - word.startTime) / dur) : 1);
      }
    } else {
      setActiveWordIndex(-1);
      setWordProgress(0);
    }

    rafRef.current = requestAnimationFrame(tick);
  }, [lyrics, audioRef]);

  useEffect(() => {
    if (isOpen) {
      rafRef.current = requestAnimationFrame(tick);
    }
    return () => cancelAnimationFrame(rafRef.current);
  }, [isOpen, tick]);

  // Auto-scroll active line into view
  useEffect(() => {
    if (activeLineIndex < 0 || !lyricsContainerRef.current) return;
    const container = lyricsContainerRef.current;
    const lineEl = container.querySelector(`[data-line="${activeLineIndex}"]`) as HTMLElement;
    if (lineEl) {
      const containerRect = container.getBoundingClientRect();
      const lineRect = lineEl.getBoundingClientRect();
      const lineCenter = lineRect.top + lineRect.height / 2 - containerRect.top;
      const targetScroll = container.scrollTop + lineCenter - container.clientHeight / 2;
      container.scrollTo({ top: targetScroll, behavior: 'smooth' });
    }
  }, [activeLineIndex]);

  const togglePlay = async () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) await audio.play();
    else audio.pause();
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    if (!audio || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    audio.currentTime = ratio * duration;
  };

  const handleSkipLine = (dir: 'prev' | 'next') => {
    const audio = audioRef.current;
    if (!audio || lyrics.length === 0) return;
    const target = dir === 'next'
      ? lyrics.find(l => l.time > currentTime)
      : [...lyrics].reverse().find(l => l.time < currentTime - 0.5);
    if (target) audio.currentTime = target.time;
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const progress = duration > 0 ? currentTime / duration : 0;

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(2, 4, 14, 0.96)', backdropFilter: 'blur(24px)' }}
    >
      {/* Close */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 neo-button w-10 h-10 rounded-xl flex items-center justify-center text-[hsl(var(--muted-foreground))] hover:text-white transition-colors z-50"
      >
        <X className="w-4 h-4" />
      </button>

      {/* Background aurora effect */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute w-[600px] h-[600px] rounded-full"
          style={{
            top: '20%', left: '10%',
            background: 'radial-gradient(circle, hsl(213,95%,50%,0.06), transparent 70%)',
            transform: `scale(${1 + Math.sin(currentTime * 0.5) * 0.1})`,
          }}
        />
        <div
          className="absolute w-[500px] h-[500px] rounded-full"
          style={{
            bottom: '15%', right: '15%',
            background: 'radial-gradient(circle, hsl(300,80%,55%,0.05), transparent 70%)',
          }}
        />
      </div>

      <div className="w-full max-w-2xl mx-auto px-6 flex flex-col" style={{ height: '90vh' }}>
        {/* Header */}
        <div className="flex items-center justify-between py-4 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-[hsl(var(--hud-teal))] animate-pulse" />
            <span className="text-[10px] font-mono text-[hsl(var(--hud-teal))] uppercase tracking-widest">Flow Visualizer</span>
          </div>
          <div className="text-[10px] font-mono text-[hsl(var(--muted-foreground))]">
            {lyrics.length} LINES · {lyrics.reduce((s, l) => s + (l.words?.length ?? 0), 0)} WORDS
          </div>
        </div>

        {/* HUD corner brackets */}
        <div className="relative flex-1 overflow-hidden">
          {/* Brackets */}
          {[['top-0 left-0', 'border-t-2 border-l-2'], ['top-0 right-0', 'border-t-2 border-r-2'],
            ['bottom-0 left-0', 'border-b-2 border-l-2'], ['bottom-0 right-0', 'border-b-2 border-r-2']].map(([pos, borders], i) => (
            <div
              key={i}
              className={`absolute w-6 h-6 ${pos} ${borders}`}
              style={{ borderColor: 'hsl(var(--hud-blue)/0.4)' }}
            />
          ))}

          {/* Lyrics scroll area */}
          <div
            ref={lyricsContainerRef}
            className="h-full overflow-y-auto px-4 py-8 scrollbar-hide"
            style={{ scrollbarWidth: 'none' }}
          >
            <div className="space-y-1">
              {lyrics.map((line, i) => {
                const isActive = i === activeLineIndex;
                const isPast = i < activeLineIndex;
                const words = line.words ?? [];

                return (
                  <div
                    key={i}
                    data-line={i}
                    className="relative py-2 px-3 rounded-lg transition-all duration-300 cursor-pointer"
                    style={{
                      background: isActive ? 'hsl(var(--hud-blue)/0.08)' : 'transparent',
                      borderLeft: isActive ? '2px solid hsl(var(--hud-blue)/0.8)' : '2px solid transparent',
                    }}
                    onClick={() => { if (audioRef.current) audioRef.current.currentTime = line.time; }}
                  >
                    {/* Line timestamp */}
                    <div
                      className="absolute left-3 -top-2 text-[8px] font-mono transition-all"
                      style={{ color: isActive ? 'hsl(var(--hud-blue)/0.7)' : 'transparent' }}
                    >
                      {formatTime(line.time)}
                    </div>

                    {/* Words with word-level highlight */}
                    {words.length > 0 && isActive ? (
                      <div className="flex flex-wrap gap-x-2 gap-y-1">
                        {words.map((word, wi) => {
                          const isActiveWord = wi === activeWordIndex;
                          const isPastWord = wi < activeWordIndex;
                          return (
                            <span
                              key={wi}
                              className="relative transition-all duration-100"
                              style={{
                                fontSize: isActiveWord ? '1.5rem' : isPastWord ? '1.3rem' : '1.3rem',
                                fontWeight: isActiveWord ? 900 : 700,
                                lineHeight: 1.2,
                                color: isActiveWord
                                  ? 'white'
                                  : isPastWord
                                  ? 'hsl(var(--hud-teal)/0.7)'
                                  : 'rgba(255,255,255,0.25)',
                                textShadow: isActiveWord
                                  ? `0 0 20px hsl(var(--hud-blue)), 0 0 40px hsl(var(--hud-blue)/0.4)`
                                  : 'none',
                                transform: isActiveWord ? `scale(${1 + wordProgress * 0.06})` : 'scale(1)',
                                display: 'inline-block',
                              }}
                            >
                              {word.text}
                              {/* Sweeping underline playhead */}
                              {isActiveWord && (
                                <span
                                  className="absolute bottom-0 left-0 h-0.5 rounded-full"
                                  style={{
                                    width: `${wordProgress * 100}%`,
                                    background: 'hsl(var(--hud-teal))',
                                    boxShadow: '0 0 8px hsl(var(--hud-teal))',
                                    transition: 'width 0.05s linear',
                                  }}
                                />
                              )}
                            </span>
                          );
                        })}
                      </div>
                    ) : (
                      <p
                        className="font-bold transition-all duration-300"
                        style={{
                          fontSize: isActive ? '1.5rem' : isPast ? '1.1rem' : '1.1rem',
                          fontWeight: isActive ? 900 : isPast ? 600 : 500,
                          color: isActive ? 'white' : isPast ? 'rgba(255,255,255,0.45)' : 'rgba(255,255,255,0.18)',
                          textShadow: isActive ? '0 0 20px hsl(var(--hud-blue)/0.6)' : 'none',
                          lineHeight: 1.3,
                        }}
                      >
                        {line.text}
                      </p>
                    )}
                  </div>
                );
              })}
              {/* Padding at bottom */}
              <div style={{ height: '40vh' }} />
            </div>
          </div>

          {/* Top + bottom fade masks */}
          <div className="absolute top-0 left-0 right-0 h-24 pointer-events-none" style={{ background: 'linear-gradient(to bottom, rgba(2,4,14,0.98), transparent)' }} />
          <div className="absolute bottom-0 left-0 right-0 h-24 pointer-events-none" style={{ background: 'linear-gradient(to top, rgba(2,4,14,0.98), transparent)' }} />
        </div>

        {/* Transport bar */}
        <div className="shrink-0 pb-6 pt-2 space-y-3">
          {/* Progress bar / Scrubber */}
          <div className="relative group cursor-pointer" onClick={handleSeek}>
            <div className="h-1 bg-[hsl(var(--border)/0.4)] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-none"
                style={{
                  width: `${progress * 100}%`,
                  background: 'linear-gradient(90deg, hsl(var(--hud-teal)/0.8), hsl(var(--hud-blue)))',
                  boxShadow: '0 0 8px hsl(var(--hud-blue)/0.5)',
                }}
              />
            </div>
            {/* Lyric timestamp markers */}
            {duration > 0 && lyrics.map((line, i) => (
              <div
                key={i}
                className="absolute top-0 w-0.5 h-1 rounded-full"
                style={{
                  left: `${(line.time / duration) * 100}%`,
                  background: i === activeLineIndex ? 'hsl(var(--hud-teal))' : 'hsl(var(--hud-border)/0.6)',
                  transform: 'translateX(-50%)',
                }}
              />
            ))}
          </div>

          {/* Time */}
          <div className="flex justify-between text-[10px] font-mono text-[hsl(var(--muted-foreground))]">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>

          {/* Controls */}
          <div className="flex items-center justify-center gap-4">
            <button
              onClick={() => handleSkipLine('prev')}
              className="neo-button w-10 h-10 rounded-xl flex items-center justify-center text-[hsl(var(--muted-foreground))] hover:text-white"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => { if (audioRef.current) audioRef.current.currentTime = 0; }}
              className="neo-button w-10 h-10 rounded-xl flex items-center justify-center text-[hsl(var(--muted-foreground))] hover:text-white"
            >
              <SkipBack className="w-4 h-4" />
            </button>
            <button
              onClick={togglePlay}
              className="w-14 h-14 rounded-full flex items-center justify-center text-white transition-all"
              style={{
                background: 'hsl(var(--hud-blue))',
                boxShadow: isPlaying ? '0 0 28px hsl(var(--hud-blue)/0.6), 0 0 50px hsl(var(--hud-blue)/0.2)' : '0 0 12px hsl(var(--hud-blue)/0.3)',
              }}
            >
              {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
            </button>
            <button
              onClick={() => handleSkipLine('next')}
              className="neo-button w-10 h-10 rounded-xl flex items-center justify-center text-[hsl(var(--muted-foreground))] hover:text-white"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Active line preview */}
          {activeLineIndex >= 0 && lyrics[activeLineIndex] && (
            <div className="text-center">
              <p className="text-[10px] font-mono text-[hsl(var(--hud-blue)/0.7)] truncate">
                ▶ {lyrics[activeLineIndex].text}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
