import { Check, Sparkles } from 'lucide-react';
import { VISUAL_STYLES } from '@/constants';
import type { VisualStyle } from '@/types';

interface StyleSelectorProps {
  currentStyle: VisualStyle;
  onStyleChange: (style: VisualStyle) => void;
}

const COLOR_MAP: Record<string, string> = {
  azure: 'hsl(213, 95%, 50%)',
  magenta: 'hsl(300, 80%, 55%)',
  teal: 'hsl(180, 85%, 50%)',
  amber: 'hsl(38, 95%, 55%)',
};

const EFFECT_LABELS: Record<string, string> = {
  glow: 'NEON GLOW',
  chromatic: 'CHROMA-ABR',
  wave: 'WAVE TYPE',
  zoom: 'ZOOM BLUR',
  split: 'SPLIT TEXT',
};

const BG_LABELS: Record<string, string> = {
  aurora: 'AURORA',
  grid: 'HUD GRID',
  particles: 'PARTICLE',
  waveform: 'WAVEFORM',
};

export function StyleSelector({ currentStyle, onStyleChange }: StyleSelectorProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 mb-2">
        <Sparkles className="w-3 h-3 text-[hsl(var(--hud-magenta))]" />
        <span className="text-[10px] font-mono text-[hsl(var(--muted-foreground))] uppercase tracking-wider">
          Visual Style Modules
        </span>
      </div>

      <div className="space-y-1.5">
        {VISUAL_STYLES.map((style) => {
          const isActive = style.id === currentStyle.id;
          const color = COLOR_MAP[style.colorScheme];
          return (
            <button
              key={style.id}
              onClick={() => onStyleChange(style)}
              className={`w-full text-left p-2.5 rounded-lg border transition-all ${
                isActive
                  ? 'border-[hsl(var(--hud-blue)/0.6)] bg-[hsl(var(--hud-blue)/0.1)]'
                  : 'border-[hsl(var(--border)/0.5)] hover:border-[hsl(var(--hud-border))] glass-panel'
              }`}
            >
              <div className="flex items-center gap-2">
                {/* Color swatch */}
                <div
                  className="w-6 h-6 rounded-md shrink-0 flex items-center justify-center"
                  style={{ background: `${color}22`, border: `1px solid ${color}66` }}
                >
                  {isActive ? (
                    <Check className="w-3 h-3" style={{ color }} />
                  ) : (
                    <div className="w-2 h-2 rounded-full" style={{ background: color }} />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-semibold ${isActive ? 'text-white' : 'text-[hsl(var(--foreground)/0.8)]'}`}>
                      {style.name}
                    </span>
                    <span className="text-[9px] font-mono" style={{ color }}>
                      {style.particleConfig.count.toLocaleString()}px
                    </span>
                  </div>
                  <p className="text-[9px] text-[hsl(var(--muted-foreground))] truncate">{style.description}</p>
                </div>
              </div>

              {isActive && (
                <div className="flex gap-1 mt-1.5">
                  <span className="text-[8px] font-mono px-1.5 py-0.5 rounded" style={{ background: `${color}22`, color }}>
                    {EFFECT_LABELS[style.typographyEffect]}
                  </span>
                  <span className="text-[8px] font-mono px-1.5 py-0.5 rounded bg-[hsl(var(--border)/0.4)] text-[hsl(var(--muted-foreground))]">
                    {BG_LABELS[style.backgroundEffect]}
                  </span>
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Particle config display */}
      <div className="glass-panel rounded-lg p-2 space-y-1.5 mt-2">
        <p className="text-[9px] font-mono text-[hsl(var(--muted-foreground))] uppercase tracking-wider">Shader Config</p>
        {[
          { label: 'PARTICLES', value: currentStyle.particleConfig.count.toLocaleString() },
          { label: 'SPEED', value: currentStyle.particleConfig.speed.toFixed(1) },
          { label: 'TURBULENCE', value: (currentStyle.particleConfig.turbulence * 100).toFixed(0) + '%' },
          { label: 'SIZE', value: currentStyle.particleConfig.size.toFixed(1) + 'px' },
        ].map(({ label, value }) => (
          <div key={label} className="flex justify-between items-center">
            <span className="text-[9px] font-mono text-[hsl(var(--muted-foreground))]">{label}</span>
            <span className="text-[10px] font-mono text-[hsl(var(--hud-blue))]">{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
