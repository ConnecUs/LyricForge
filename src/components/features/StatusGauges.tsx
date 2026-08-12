import type { AudioAnalysisData } from '@/types';

interface StatusGaugesProps {
  analysisData: AudioAnalysisData;
  isPlaying: boolean;
  fps: number;
}

interface GaugeProps {
  label: string;
  value: number;
  max?: number;
  color: string;
  unit?: string;
  circular?: boolean;
}

function Gauge({ label, value, max = 1, color, unit = '', circular = false }: GaugeProps) {
  const pct = Math.min(1, value / max);

  if (circular) {
    const r = 18;
    const circumference = 2 * Math.PI * r;
    const stroke = circumference * (1 - pct);
    return (
      <div className="flex flex-col items-center gap-1">
        <div className="relative w-12 h-12">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 44 44">
            <circle cx="22" cy="22" r={r} fill="none" stroke="hsl(var(--border))" strokeWidth="2.5" />
            <circle
              cx="22" cy="22" r={r} fill="none"
              stroke={color} strokeWidth="2.5"
              strokeDasharray={circumference}
              strokeDashoffset={stroke}
              strokeLinecap="round"
              style={{ filter: `drop-shadow(0 0 4px ${color})`, transition: 'stroke-dashoffset 0.2s ease' }}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-[9px] font-mono text-white font-bold">
              {unit === '%' ? Math.round(pct * 100) : Math.round(value)}{unit}
            </span>
          </div>
        </div>
        <span className="text-[8px] font-mono text-[hsl(var(--muted-foreground))] tracking-wider uppercase">{label}</span>
      </div>
    );
  }

  return (
    <div className="space-y-0.5">
      <div className="flex justify-between">
        <span className="text-[8px] font-mono text-[hsl(var(--muted-foreground))] uppercase tracking-wider">{label}</span>
        <span className="text-[9px] font-mono" style={{ color }}>
          {unit === '%' ? Math.round(pct * 100) : value.toFixed(unit === 'BPM' ? 0 : 2)}{unit}
        </span>
      </div>
      <div className="h-1 bg-[hsl(var(--border)/0.5)] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-75"
          style={{
            width: `${pct * 100}%`,
            background: color,
            boxShadow: `0 0 6px ${color}`,
          }}
        />
      </div>
    </div>
  );
}

export function StatusGauges({ analysisData, isPlaying, fps }: StatusGaugesProps) {
  const { bassLevel, midLevel, highLevel, rmsEnergy, bpm, spectralFlux } = analysisData;

  return (
    <div className="space-y-3">
      {/* Circular gauges row */}
      <div className="flex justify-around py-1">
        <Gauge label="GPU" value={isPlaying ? 0.65 + bassLevel * 0.2 : 0.12} max={1} color="hsl(213, 95%, 60%)" unit="%" circular />
        <Gauge label="DSP" value={isPlaying ? 0.4 + rmsEnergy * 0.5 : 0.05} max={1} color="hsl(300, 80%, 60%)" unit="%" circular />
        <Gauge label="FPS" value={fps} max={60} color="hsl(145, 75%, 55%)" unit="" circular />
      </div>

      {/* Frequency bands */}
      <div className="glass-panel rounded-lg p-2.5 space-y-1.5">
        <p className="text-[9px] font-mono text-[hsl(var(--muted-foreground))] uppercase tracking-wider mb-2">Audio Spectrum</p>
        <Gauge label="BASS" value={bassLevel} color="hsl(38, 95%, 55%)" unit="%" />
        <Gauge label="MID" value={midLevel} color="hsl(213, 95%, 60%)" unit="%" />
        <Gauge label="HIGH" value={highLevel} color="hsl(300, 80%, 65%)" unit="%" />
        <Gauge label="RMS" value={rmsEnergy} color="hsl(145, 75%, 55%)" unit="%" />
        <Gauge label="FLUX" value={spectralFlux} color="hsl(0, 84%, 65%)" unit="%" />
      </div>

      {/* BPM display */}
      <div className="glass-panel rounded-lg p-2.5 flex items-center gap-3">
        <div
          className="w-10 h-10 rounded-lg border flex items-center justify-center shrink-0"
          style={{
            borderColor: spectralFlux > 0.15 ? 'hsl(var(--hud-magenta))' : 'hsl(var(--hud-border)/0.5)',
            background: spectralFlux > 0.15 ? 'hsl(var(--hud-magenta)/0.15)' : 'transparent',
            boxShadow: spectralFlux > 0.15 ? '0 0 12px hsl(var(--hud-magenta)/0.4)' : 'none',
            transition: 'all 0.1s ease',
          }}
        >
          <span className="text-[8px] font-black text-white">BPM</span>
        </div>
        <div>
          <div className="text-2xl font-black text-white font-mono leading-none hud-glow-text">
            {bpm}
          </div>
          <div className="text-[9px] font-mono text-[hsl(var(--muted-foreground))]">
            SPECTRAL FLUX · AUTO-DETECT
          </div>
        </div>
        <div className="ml-auto">
          <div className="flex flex-col gap-0.5">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="w-1 h-1 rounded-full transition-all duration-75"
                style={{
                  background: i < Math.round(spectralFlux * 8)
                    ? 'hsl(var(--hud-magenta))'
                    : 'hsl(var(--border))',
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
