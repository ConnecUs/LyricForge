import { Layers, Zap, Activity, Cpu, Triangle, Palette } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { HUD_THEMES, useHUDTheme, type HUDThemeId } from '@/hooks/useHUDTheme';

const THEME_LABELS: Record<HUDThemeId, string> = {
  azure:   'Azure',
  crimson: 'Crimson',
  jade:    'Jade',
  void:    'Void',
};

interface HUDHeaderProps {
  bpm: number;
  isPlaying: boolean;
  resolution: string;
  fps: number;
  webgpuActive?: boolean;
  webCodecsActive?: boolean;
  hardwareAccel?: boolean;
}

export function HUDHeader({ bpm, isPlaying, resolution, fps, webgpuActive = false, webCodecsActive = false, hardwareAccel = false }: HUDHeaderProps) {
  const { activeTheme, setTheme } = useHUDTheme();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const paletteRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!paletteOpen) return;
    const handler = (e: MouseEvent) => {
      if (paletteRef.current && !paletteRef.current.contains(e.target as Node)) {
        setPaletteOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [paletteOpen]);

  return (
    <div className="flex items-center justify-between px-4 py-2 glass-panel border-b border-[hsl(var(--hud-border)/0.5)]">
      {/* Logo */}
      <div className="flex items-center gap-3">
        <div className="relative">
          <div className="w-8 h-8 rounded-lg border border-[hsl(var(--hud-blue)/0.6)] flex items-center justify-center animate-pulse-glow">
            <Layers className="w-4 h-4 text-[hsl(var(--hud-blue))]" />
          </div>
        </div>
        <div>
          <span className="font-black text-sm tracking-[0.15em] text-white hud-glow-text">
            LYRIC<span className="text-[hsl(var(--hud-blue))]">FORGE</span>
          </span>
          <div className="text-[9px] font-mono text-[hsl(var(--hud-teal))] tracking-widest leading-none">
            GENERATIVE ENGINE v2.0
          </div>
        </div>
      </div>

      {/* Center status pills */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 glass-panel rounded-full px-3 py-1 hud-border">
          <div className={`w-1.5 h-1.5 rounded-full ${isPlaying ? 'bg-[hsl(var(--hud-green))] animate-pulse' : 'bg-[hsl(var(--muted-foreground))]'}`} />
          <span className="text-[10px] font-mono text-[hsl(var(--muted-foreground))]">
            {isPlaying ? 'LIVE' : 'PAUSED'}
          </span>
        </div>

        <div className="flex items-center gap-1.5 glass-panel rounded-full px-3 py-1 hud-border">
          <Activity className="w-2.5 h-2.5 text-[hsl(var(--hud-magenta))]" />
          <span className="text-[10px] font-mono text-[hsl(var(--hud-magenta))]">{bpm} BPM</span>
        </div>

        <div className="flex items-center gap-1.5 glass-panel rounded-full px-3 py-1 hud-border">
          <Zap className="w-2.5 h-2.5 text-[hsl(var(--hud-amber))]" />
          <span className="text-[10px] font-mono text-[hsl(var(--hud-amber))]">{fps}FPS · {resolution}</span>
        </div>
      </div>

      {/* Right — system indicators */}
      <div className="flex items-center gap-3">
        {/* Theme Switcher */}
        <div className="relative" ref={paletteRef}>
          <button
            onClick={() => setPaletteOpen(p => !p)}
            className="flex items-center gap-1.5 glass-panel rounded-full px-2.5 py-1 hud-border hover:border-[hsl(var(--hud-blue)/0.6)] transition-all group"
            title="Switch HUD Theme"
          >
            <div
              className="w-2.5 h-2.5 rounded-full ring-1 ring-white/20 transition-transform group-hover:scale-110"
              style={{ background: activeTheme.swatch, boxShadow: `0 0 6px ${activeTheme.swatch}` }}
            />
            <Palette className="w-2.5 h-2.5 text-[hsl(var(--muted-foreground))]" />
            <span className="text-[9px] font-mono text-[hsl(var(--muted-foreground))] uppercase tracking-widest">
              {activeTheme.name}
            </span>
          </button>

          {/* Dropdown palette */}
          {paletteOpen && (
            <div
              className="absolute right-0 top-full mt-1.5 z-50 glass-panel rounded-xl p-2 border border-[hsl(var(--hud-border)/0.7)] min-w-[140px]"
              style={{ boxShadow: `0 8px 32px hsl(0 0% 0% / 0.6), 0 0 20px ${activeTheme.swatch}22` }}
            >
              <p className="text-[8px] font-mono text-[hsl(var(--muted-foreground))] uppercase tracking-widest px-1 pb-1.5 border-b border-[hsl(var(--border)/0.5)] mb-1.5">
                HUD Theme
              </p>
              {HUD_THEMES.map(theme => (
                <button
                  key={theme.id}
                  onClick={() => { setTheme(theme.id); setPaletteOpen(false); }}
                  className={`w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-left transition-all ${
                    activeTheme.id === theme.id
                      ? 'bg-[hsl(var(--hud-blue)/0.15)] border border-[hsl(var(--hud-blue)/0.35)]'
                      : 'hover:bg-[hsl(var(--border)/0.4)] border border-transparent'
                  }`}
                >
                  {/* Dual-tone swatch */}
                  <div className="relative w-4 h-4 rounded-full overflow-hidden ring-1 ring-white/20 shrink-0">
                    <div className="absolute inset-0" style={{ background: theme.swatch }} />
                    <div
                      className="absolute inset-0"
                      style={{
                        background: theme.swatchAccent,
                        clipPath: 'polygon(50% 0%, 100% 0%, 100% 100%, 50% 100%)',
                      }}
                    />
                  </div>
                  <span
                    className="text-[10px] font-mono flex-1"
                    style={{ color: activeTheme.id === theme.id ? theme.swatch : 'hsl(var(--foreground))' }}
                  >
                    {theme.name}
                  </span>
                  {activeTheme.id === theme.id && (
                    <div
                      className="w-1.5 h-1.5 rounded-full shrink-0"
                      style={{ background: theme.swatch, boxShadow: `0 0 6px ${theme.swatch}` }}
                    />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="flex gap-1 items-center">
          {['GPU', 'DSP', 'ENC'].map((label) => (
            <div key={label} className="flex flex-col items-center gap-0.5">
              <div className="flex gap-0.5">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div
                    key={i}
                    className={`w-0.5 h-2 rounded-full ${
                      i < 3 ? 'bg-[hsl(var(--hud-teal))]' : 'bg-[hsl(var(--border))]'
                    }`}
                  />
                ))}
              </div>
              <span className="text-[7px] font-mono text-[hsl(var(--muted-foreground))] tracking-wider">{label}</span>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2">
          {/* WebGPU status */}
          <div
            className="flex items-center gap-1 px-2 py-0.5 rounded-full"
            style={{
              background: webgpuActive ? 'hsl(var(--hud-teal)/0.12)' : 'transparent',
              border: `1px solid ${webgpuActive ? 'hsl(var(--hud-teal)/0.4)' : 'hsl(var(--border)/0.5)'}`,
            }}
          >
            <Triangle
              className="w-2.5 h-2.5"
              style={{ color: webgpuActive ? 'hsl(var(--hud-teal))' : 'hsl(var(--muted-foreground))' }}
            />
            <span
              className="text-[9px] font-mono"
              style={{ color: webgpuActive ? 'hsl(var(--hud-teal))' : 'hsl(var(--muted-foreground))' }}
            >
              {webgpuActive ? 'WGPU' : 'WebGL'}
            </span>
          </div>

          {/* WebCodecs / HW Encoder status */}
          <div
            className="flex items-center gap-1 px-2 py-0.5 rounded-full"
            style={{
              background: webCodecsActive ? 'hsl(var(--hud-blue)/0.12)' : 'transparent',
              border: `1px solid ${webCodecsActive ? 'hsl(var(--hud-blue)/0.4)' : 'hsl(var(--border)/0.5)'}`,
            }}
          >
            <Cpu
              className="w-2.5 h-2.5"
              style={{ color: webCodecsActive ? 'hsl(var(--hud-blue))' : 'hsl(var(--muted-foreground))' }}
            />
            <span
              className="text-[9px] font-mono"
              style={{ color: webCodecsActive ? 'hsl(var(--hud-blue))' : 'hsl(var(--muted-foreground))' }}
            >
              {webCodecsActive ? (hardwareAccel ? 'NVENC' : 'ENC') : 'WebCodecs'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
