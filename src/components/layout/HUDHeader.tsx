import { Layers, Zap, Activity, Cpu, Triangle } from 'lucide-react';

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
