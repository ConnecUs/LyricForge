import { useState, useCallback, useRef } from 'react';
import { Scan, Zap, AlertTriangle, CheckCircle2, SlidersHorizontal, ChevronRight, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { useLyricSync } from '@/hooks/useLyricSync';
import type { LyricLine } from '@/types';

interface LyricSyncPanelProps {
  lyrics: LyricLine[];
  audioBuffer: AudioBuffer | null;
  hasAudio: boolean;
  onApplySync: (newLyrics: LyricLine[], newRawLRC: string) => void;
}

export function LyricSyncPanel({ lyrics, audioBuffer, hasAudio, onApplySync }: LyricSyncPanelProps) {
  const { syncState, scan, cancel, reset, applyOffset, toLRCString } = useLyricSync();
  const [manualOffset, setManualOffset] = useState(0);
  const [sensitivity, setSensitivity] = useState(0.08);
  const [previewApplied, setPreviewApplied] = useState(false);

  const handleScan = async () => {
    if (!audioBuffer) {
      toast.error('No audio loaded', { description: 'Load an audio file before scanning.' });
      return;
    }
    if (lyrics.length === 0) {
      toast.error('No lyrics loaded', { description: 'Add lyrics before running sync scan.' });
      return;
    }
    setPreviewApplied(false);
    await scan(audioBuffer, lyrics, { sensitivity, maxOffset: 30 });
  };

  const handleApply = () => {
    const offsetToApply = syncState.result
      ? -(syncState.result.offsetSeconds) + manualOffset
      : manualOffset;

    const newLyrics = applyOffset(lyrics, -offsetToApply);
    const newLRC = toLRCString(newLyrics);
    onApplySync(newLyrics, newLRC);
    setPreviewApplied(true);
    toast.success('Sync applied!', {
      description: `Offset: ${offsetToApply > 0 ? '+' : ''}${offsetToApply.toFixed(2)}s to all ${lyrics.length} lines`,
    });
  };

  const handleManualApply = () => {
    const newLyrics = applyOffset(lyrics, -manualOffset);
    const newLRC = toLRCString(newLyrics);
    onApplySync(newLyrics, newLRC);
    setPreviewApplied(true);
    toast.success('Manual offset applied!', {
      description: `Shifted all lines by ${manualOffset > 0 ? '+' : ''}${manualOffset.toFixed(2)}s`,
    });
  };

  const handleReset = () => {
    reset();
    setManualOffset(0);
    setPreviewApplied(false);
  };

  const isScanning = syncState.status === 'scanning';
  const hasResult = syncState.status === 'complete' && syncState.result !== null;
  const confidence = syncState.result?.confidence ?? 0;
  const confidenceColor =
    confidence > 0.7 ? 'hsl(var(--hud-green))' :
    confidence > 0.4 ? 'hsl(var(--hud-amber))' :
    'hsl(var(--destructive))';

  const totalOffset = hasResult
    ? -(syncState.result!.offsetSeconds) + manualOffset
    : manualOffset;

  return (
    <div className="space-y-3">
      {/* Info banner */}
      <div className="glass-panel rounded-lg p-2.5 border border-[hsl(var(--hud-teal)/0.3)]">
        <p className="text-[9px] font-mono text-[hsl(var(--hud-teal))] leading-relaxed">
          SCAN analyzes audio onsets via Spectral Flux to auto-align lyric timestamps. Use INTRO OFFSET for songs with long musical intros.
        </p>
      </div>

      {/* Sensitivity */}
      <div className="space-y-1">
        <div className="flex justify-between items-center">
          <label className="text-[9px] font-mono text-[hsl(var(--muted-foreground))] uppercase tracking-wider">Beat Sensitivity</label>
          <span className="text-[10px] font-mono text-[hsl(var(--hud-blue))]">{(sensitivity * 100).toFixed(0)}%</span>
        </div>
        <input
          type="range" min={0.02} max={0.25} step={0.01}
          value={sensitivity}
          onChange={e => setSensitivity(parseFloat(e.target.value))}
          className="w-full h-1 accent-[hsl(var(--hud-blue))] cursor-pointer"
        />
        <div className="flex justify-between text-[8px] font-mono text-[hsl(var(--muted-foreground))]">
          <span>Sensitive</span><span>Conservative</span>
        </div>
      </div>

      {/* Scan button */}
      <button
        onClick={isScanning ? cancel : handleScan}
        disabled={!hasAudio || lyrics.length === 0}
        className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-semibold transition-all ${
          !hasAudio || lyrics.length === 0
            ? 'opacity-40 cursor-not-allowed neo-button text-[hsl(var(--muted-foreground))]'
            : isScanning
            ? 'border border-[hsl(var(--destructive)/0.5)] text-[hsl(var(--destructive))] hover:bg-[hsl(var(--destructive)/0.08)]'
            : 'bg-[hsl(var(--hud-teal)/0.15)] border border-[hsl(var(--hud-teal)/0.5)] text-[hsl(var(--hud-teal))] hover:bg-[hsl(var(--hud-teal)/0.25)]'
        }`}
        style={!isScanning && hasAudio ? { boxShadow: '0 0 12px hsl(var(--hud-teal)/0.2)' } : {}}
      >
        {isScanning ? (
          <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> CANCEL</>
        ) : (
          <><Scan className="w-3.5 h-3.5" /> SCAN AUDIO ONSETS</>
        )}
      </button>

      {/* Progress bar */}
      {isScanning && (
        <div className="space-y-1">
          <div className="h-1 bg-[hsl(var(--border)/0.5)] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${syncState.progress}%`,
                background: 'hsl(var(--hud-teal))',
                boxShadow: '0 0 8px hsl(var(--hud-teal))',
              }}
            />
          </div>
          <p className="text-[9px] font-mono text-[hsl(var(--muted-foreground))] text-center">
            Analyzing waveform... {syncState.progress}%
          </p>
        </div>
      )}

      {/* Scan result */}
      {hasResult && (
        <div className="glass-panel rounded-lg p-2.5 space-y-2 border" style={{ borderColor: `${confidenceColor}44` }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              {confidence > 0.5
                ? <CheckCircle2 className="w-3.5 h-3.5 text-[hsl(var(--hud-green))]" />
                : <AlertTriangle className="w-3.5 h-3.5 text-[hsl(var(--hud-amber))]" />
              }
              <span className="text-[10px] font-mono" style={{ color: confidenceColor }}>
                {(confidence * 100).toFixed(0)}% CONFIDENCE
              </span>
            </div>
            <span className="text-[10px] font-mono text-[hsl(var(--muted-foreground))]">
              {syncState.result!.detectedBPM} BPM · {syncState.result!.beatCount} ONSETS
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Zap className="w-3 h-3 text-[hsl(var(--hud-amber))]" />
            <span className="text-[9px] font-mono text-[hsl(var(--muted-foreground))]">Suggested offset:</span>
            <span className="text-[11px] font-mono font-bold text-white ml-auto">
              {syncState.result!.offsetSeconds > 0 ? '+' : ''}{syncState.result!.offsetSeconds.toFixed(2)}s intro skip
            </span>
          </div>

          {/* Confidence bar */}
          <div className="h-1 bg-[hsl(var(--border)/0.5)] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{ width: `${confidence * 100}%`, background: confidenceColor }}
            />
          </div>
        </div>
      )}

      {/* Manual offset (always visible) */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-1.5 mb-1">
          <SlidersHorizontal className="w-3 h-3 text-[hsl(var(--hud-magenta))]" />
          <span className="text-[9px] font-mono text-[hsl(var(--muted-foreground))] uppercase tracking-wider">Manual Intro Offset</span>
          <span className="text-[10px] font-mono text-[hsl(var(--hud-magenta))] ml-auto">
            {manualOffset >= 0 ? '+' : ''}{manualOffset.toFixed(1)}s
          </span>
        </div>
        <input
          type="range" min={-10} max={30} step={0.1}
          value={manualOffset}
          onChange={e => setManualOffset(parseFloat(e.target.value))}
          className="w-full h-1 accent-[hsl(var(--hud-magenta))] cursor-pointer"
        />
        <div className="flex justify-between text-[8px] font-mono text-[hsl(var(--muted-foreground))]">
          <span>-10s earlier</span>
          <span>0s</span>
          <span>+30s later</span>
        </div>
        <p className="text-[8px] font-mono text-[hsl(var(--muted-foreground))] leading-relaxed">
          Shift lyrics forward (+) if they appear too early, backward (−) if too late.
        </p>
      </div>

      {/* Total offset preview */}
      {(hasResult || manualOffset !== 0) && (
        <div className="glass-panel rounded-lg p-2 flex items-center justify-between border border-[hsl(var(--hud-blue)/0.3)]">
          <span className="text-[9px] font-mono text-[hsl(var(--muted-foreground))]">EFFECTIVE SHIFT</span>
          <div className="flex items-center gap-1">
            <ChevronRight className="w-3 h-3 text-[hsl(var(--hud-blue))]" />
            <span className="text-[11px] font-mono font-bold text-[hsl(var(--hud-blue))]">
              {totalOffset >= 0 ? '+' : ''}{totalOffset.toFixed(2)}s on all {lyrics.length} lines
            </span>
          </div>
        </div>
      )}

      {/* Apply buttons */}
      <div className="flex gap-1.5">
        {hasResult && (
          <button
            onClick={handleApply}
            disabled={previewApplied}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all ${
              previewApplied
                ? 'opacity-50 cursor-not-allowed neo-button text-[hsl(var(--muted-foreground))]'
                : 'bg-[hsl(var(--hud-blue))] hover:bg-[hsl(213,95%,45%)] text-white'
            }`}
            style={{ boxShadow: previewApplied ? 'none' : '0 0 12px hsl(213,95%,50%,0.35)' }}
          >
            <Zap className="w-3.5 h-3.5" />
            {previewApplied ? 'APPLIED ✓' : 'APPLY SYNC'}
          </button>
        )}
        <button
          onClick={handleManualApply}
          disabled={manualOffset === 0}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-mono transition-all ${
            manualOffset === 0
              ? 'opacity-40 cursor-not-allowed neo-button text-[hsl(var(--muted-foreground))]'
              : 'neo-button text-[hsl(var(--hud-magenta))] hover:text-white border border-[hsl(var(--hud-magenta)/0.4)]'
          }`}
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          SHIFT MANUAL
        </button>
      </div>

      {(hasResult || previewApplied) && (
        <button onClick={handleReset} className="w-full text-[9px] font-mono text-[hsl(var(--muted-foreground))] hover:text-white transition-colors py-1">
          RESET SYNC STATE
        </button>
      )}
    </div>
  );
}
