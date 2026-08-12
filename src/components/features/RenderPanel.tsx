import { useState, useEffect, useRef } from 'react';
import { Cpu, Download, Square, Zap, Film, Shield, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { CODEC_OPTIONS, RESOLUTION_OPTIONS, FPS_OPTIONS } from '@/constants';
import { useWebCodecsEncoder } from '@/hooks/useWebCodecsEncoder';
import type { RenderJob } from '@/types';

interface RenderPanelProps {
  job: RenderJob;
  duration: number;
  hasAudio: boolean;
  canvasRef?: React.RefObject<HTMLCanvasElement>;
  audioBuffer?: AudioBuffer | null;
  onStartRender: (duration: number, resolution: string, fps: number) => void;
  onCancelRender: () => void;
  onResetRender: () => void;
}

const STATUS_COLORS: Record<string, string> = {
  idle: 'hsl(var(--muted-foreground))',
  initializing: 'hsl(var(--hud-amber))',
  capturing: 'hsl(var(--hud-teal))',
  encoding: 'hsl(var(--hud-blue))',
  muxing: 'hsl(var(--hud-magenta))',
  complete: 'hsl(var(--hud-green))',
  error: 'hsl(var(--destructive))',
  unsupported: 'hsl(var(--muted-foreground))',
  analyzing: 'hsl(var(--hud-amber))',
  rendering: 'hsl(var(--hud-blue))',
};

export function RenderPanel({
  job,
  duration,
  hasAudio,
  canvasRef,
  audioBuffer,
  onStartRender,
  onCancelRender,
  onResetRender,
}: RenderPanelProps) {
  const [resolution, setResolution] = useState<string>('1080p');
  const [fps, setFps] = useState(30);
  const [codec, setCodec] = useState(CODEC_OPTIONS[0]);
  const [useWebCodecs, setUseWebCodecs] = useState(true);

  const {
    state: encoderState,
    detectSupport,
    encodeFromCanvas,
    cancelEncoding,
    downloadOutput,
    resetEncoder,
  } = useWebCodecsEncoder();

  // Detect codec support on mount
  useEffect(() => {
    detectSupport();
  }, [detectSupport]);

  const bitrateMap: Record<string, number> = {
    '720p': 4_000_000,
    '1080p': 8_000_000,
    '4K': 40_000_000,
  };

  const handleStart = async () => {
    if (!hasAudio) {
      toast.error('Please load an audio file first');
      return;
    }
    if (duration === 0) {
      toast.error('Audio not ready — press play first to initialize.');
      return;
    }

    if (useWebCodecs && encoderState.status !== 'unsupported') {
      // Real WebCodecs encode path
      if (!canvasRef?.current) {
        toast.error('Canvas reference not available');
        return;
      }

      await encodeFromCanvas(
        canvasRef.current,
        audioBuffer ?? null,
        {
          resolution: resolution as '720p' | '1080p' | '4K',
          fps,
          codec,
          bitrate: bitrateMap[resolution] ?? 8_000_000,
        },
        (frameIndex, totalFrames) => {
          // renderFrame callback: Index.tsx drives this by seeking to the frame time
          console.log(`[RenderPanel] Render frame ${frameIndex}/${totalFrames}`);
        },
      );
    } else {
      // Simulated pipeline fallback
      onStartRender(duration, resolution, fps);
      toast.info('Using simulated pipeline', {
        description: 'WebCodecs not available in this browser — switch to Chrome 94+ for real encoding.',
      });
    }
  };

  const handleCancel = () => {
    if (useWebCodecs && encoderState.status !== 'idle') {
      cancelEncoding();
    } else {
      onCancelRender();
    }
  };

  const handleReset = () => {
    resetEncoder();
    onResetRender();
  };

  // Decide which state to display
  const displayState = useWebCodecs ? encoderState : job;
  const displayStatus = useWebCodecs ? encoderState.status : job.status;
  const displayProgress = useWebCodecs ? encoderState.progress : job.progress;
  const displayFrame = useWebCodecs ? encoderState.currentFrame : job.currentFrame;
  const displayTotal = useWebCodecs ? encoderState.totalFrames : job.totalFrames;
  const displayFps = useWebCodecs ? encoderState.fps : job.fps;

  const isActive = !['idle', 'complete', 'error', 'unsupported'].includes(displayStatus);
  const isComplete = displayStatus === 'complete';
  const statusColor = STATUS_COLORS[displayStatus] ?? STATUS_COLORS.idle;

  const formatETA = (s: number) => {
    if (!s || !isFinite(s) || s <= 0) return '--:--';
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const formatBytes = (b: number) => {
    if (b < 1024) return `${b}B`;
    if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)}KB`;
    return `${(b / 1024 / 1024).toFixed(1)}MB`;
  };

  return (
    <div className="space-y-3">
      {/* WebCodecs feature probe */}
      <div className="glass-panel rounded-lg p-2.5 space-y-1.5">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[9px] font-mono text-[hsl(var(--muted-foreground))] uppercase tracking-wider">
            Codec Support Matrix
          </span>
          <div className="flex items-center gap-1">
            {encoderState.hardwareAccelerated ? (
              <Shield className="w-3 h-3 text-[hsl(var(--hud-green))]" />
            ) : (
              <AlertTriangle className="w-3 h-3 text-[hsl(var(--hud-amber))]" />
            )}
            <span className="text-[9px] font-mono" style={{
              color: encoderState.hardwareAccelerated ? 'hsl(var(--hud-green))' : 'hsl(var(--hud-amber))'
            }}>
              {encoderState.hardwareAccelerated ? 'HW ACCEL' : 'SW ONLY'}
            </span>
          </div>
        </div>

        {Object.keys(CODEC_OPTIONS.reduce((acc, c) => ({ ...acc, [c]: true }), {})).length > 0 && (
          <div className="grid grid-cols-2 gap-1">
            {CODEC_OPTIONS.map((c) => {
              const supported = encoderState.codecSupport[c];
              return (
                <div
                  key={c}
                  className="flex items-center gap-1 px-1.5 py-0.5 rounded"
                  style={{
                    background: supported ? 'hsl(var(--hud-green)/0.08)' : 'hsl(var(--border)/0.3)',
                    border: `1px solid ${supported ? 'hsl(var(--hud-green)/0.3)' : 'hsl(var(--border)/0.4)'}`,
                  }}
                >
                  {supported !== undefined ? (
                    supported
                      ? <CheckCircle2 className="w-2.5 h-2.5 shrink-0 text-[hsl(var(--hud-green))]" />
                      : <AlertTriangle className="w-2.5 h-2.5 shrink-0 text-[hsl(var(--muted-foreground))]" />
                  ) : (
                    <div className="w-2.5 h-2.5 rounded-full bg-[hsl(var(--border))]" />
                  )}
                  <span className="text-[8px] font-mono text-[hsl(var(--muted-foreground))] truncate">{c.split(' ')[0]}</span>
                </div>
              );
            })}
          </div>
        )}

        {/* Mode toggle */}
        <div className="flex items-center justify-between pt-1 border-t border-[hsl(var(--border)/0.4)]">
          <span className="text-[9px] font-mono text-[hsl(var(--muted-foreground))]">WebCodecs Engine</span>
          <button
            onClick={() => setUseWebCodecs(!useWebCodecs)}
            className={`flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-mono transition-all ${
              useWebCodecs
                ? 'bg-[hsl(var(--hud-blue)/0.2)] text-[hsl(var(--hud-blue))] border border-[hsl(var(--hud-blue)/0.4)]'
                : 'neo-button text-[hsl(var(--muted-foreground))]'
            }`}
          >
            {useWebCodecs ? 'NATIVE' : 'SIMULATED'}
          </button>
        </div>
      </div>

      {/* Status readout */}
      <div className="glass-panel rounded-lg p-2.5 border" style={{ borderColor: `${statusColor}44` }}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <div
              className="w-2 h-2 rounded-full"
              style={{ background: statusColor, boxShadow: `0 0 6px ${statusColor}` }}
            />
            <span className="text-[10px] font-mono uppercase tracking-wider" style={{ color: statusColor }}>
              {displayStatus}
            </span>
          </div>
          {isActive && (
            <span className="text-[10px] font-mono text-[hsl(var(--muted-foreground))]">
              {displayFps > 0 ? `${displayFps} FPS` : 'INIT...'}
            </span>
          )}
          {isComplete && useWebCodecs && (
            <span className="text-[9px] font-mono text-[hsl(var(--hud-green))]">
              {formatBytes(encoderState.encodedSize)}
            </span>
          )}
        </div>

        <div className="h-1.5 bg-[hsl(var(--border)/0.5)] rounded-full overflow-hidden mb-1.5">
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{
              width: `${displayProgress}%`,
              background: `linear-gradient(90deg, ${statusColor}88, ${statusColor})`,
              boxShadow: `0 0 8px ${statusColor}`,
            }}
          />
        </div>

        <div className="flex justify-between text-[9px] font-mono text-[hsl(var(--muted-foreground))]">
          <span>{displayProgress.toFixed(1)}%</span>
          {isActive && displayTotal > 0 && (
            <span>FRAME {displayFrame}/{displayTotal}</span>
          )}
          {isActive && (
            <span>ETA {formatETA('estimatedTime' in displayState ? (displayState as RenderJob).estimatedTime : 0)}</span>
          )}
        </div>
      </div>

      {/* Config */}
      {!isActive && !isComplete && (
        <div className="space-y-2">
          <div>
            <label className="text-[9px] font-mono text-[hsl(var(--muted-foreground))] uppercase tracking-wider block mb-1">Resolution</label>
            <div className="flex gap-1">
              {RESOLUTION_OPTIONS.map((r) => (
                <button key={r} onClick={() => setResolution(r)} className={`flex-1 py-1 rounded text-[10px] font-mono transition-all ${resolution === r ? 'bg-[hsl(var(--hud-blue)/0.2)] text-[hsl(var(--hud-blue))] border border-[hsl(var(--hud-blue)/0.4)]' : 'neo-button text-[hsl(var(--muted-foreground))] hover:text-white'}`}>
                  {r}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-[9px] font-mono text-[hsl(var(--muted-foreground))] uppercase tracking-wider block mb-1">Frame Rate</label>
            <div className="flex gap-1">
              {FPS_OPTIONS.map((f) => (
                <button key={f} onClick={() => setFps(f)} className={`flex-1 py-1 rounded text-[10px] font-mono transition-all ${fps === f ? 'bg-[hsl(var(--hud-blue)/0.2)] text-[hsl(var(--hud-blue))] border border-[hsl(var(--hud-blue)/0.4)]' : 'neo-button text-[hsl(var(--muted-foreground))] hover:text-white'}`}>
                  {f}fps
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-[9px] font-mono text-[hsl(var(--muted-foreground))] uppercase tracking-wider block mb-1">Codec (WebCodecs)</label>
            <select
              value={codec}
              onChange={(e) => setCodec(e.target.value)}
              className="w-full bg-[hsl(var(--input))] border border-[hsl(var(--hud-border)/0.5)] rounded px-2 py-1.5 text-[10px] font-mono text-white focus:outline-none focus:border-[hsl(var(--hud-blue)/0.6)]"
            >
              {CODEC_OPTIONS.map((c) => (
                <option key={c} value={c} disabled={encoderState.codecSupport[c] === false}>
                  {c} {encoderState.codecSupport[c] === true ? '✓' : encoderState.codecSupport[c] === false ? '✗' : ''}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Pipeline info */}
      <div className="glass-panel rounded-lg p-2 space-y-1">
        {[
          { icon: Cpu, label: 'ENCODER', value: useWebCodecs ? 'VideoEncoder API' : 'Simulated' },
          { icon: Zap, label: 'ACCEL', value: encoderState.hardwareAccelerated ? 'NVENC/QuickSync/VideoToolbox' : 'Software' },
          { icon: Film, label: 'MUXER', value: codec.includes('MP4') ? 'MP4 Container' : 'WebM Container' },
        ].map(({ icon: Icon, label, value }) => (
          <div key={label} className="flex items-center gap-2">
            <Icon className="w-2.5 h-2.5 text-[hsl(var(--hud-blue))]" />
            <span className="text-[9px] font-mono text-[hsl(var(--muted-foreground))]">{label}</span>
            <span className="text-[9px] font-mono text-white ml-auto truncate">{value}</span>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="flex gap-1.5">
        {!isActive && !isComplete && (
          <button
            onClick={handleStart}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-[hsl(var(--hud-blue))] hover:bg-[hsl(213,95%,45%)] text-white text-xs font-semibold transition-all"
            style={{ boxShadow: '0 0 16px hsl(213, 95%, 50%, 0.4)' }}
          >
            <Zap className="w-3.5 h-3.5" />
            RENDER
          </button>
        )}
        {isActive && (
          <button
            onClick={handleCancel}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg border border-[hsl(var(--destructive)/0.5)] text-[hsl(var(--destructive))] text-xs font-mono hover:bg-[hsl(var(--destructive)/0.1)] transition-colors"
          >
            <Square className="w-3 h-3" />
            CANCEL
          </button>
        )}
        {isComplete && (
          <>
            <button
              onClick={downloadOutput}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-[hsl(var(--hud-green)/0.2)] border border-[hsl(var(--hud-green)/0.5)] text-[hsl(var(--hud-green))] text-xs font-mono hover:bg-[hsl(var(--hud-green)/0.3)] transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              DOWNLOAD
            </button>
            <button onClick={handleReset} className="neo-button px-3 rounded-lg text-[10px] font-mono text-[hsl(var(--muted-foreground))] hover:text-white">
              RESET
            </button>
          </>
        )}
      </div>
    </div>
  );
}
