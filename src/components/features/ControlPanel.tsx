import { useState } from 'react';
import { ChevronDown, Music2, Type, Palette, Cpu, BarChart3, Scan, Sparkles, Mic } from 'lucide-react';
import { AudioUploader } from './AudioUploader';
import { LyricsEditor } from './LyricsEditor';
import { StyleSelector } from './StyleSelector';
import { RenderPanel } from './RenderPanel';
import { StatusGauges } from './StatusGauges';
import { AudioVisualizer } from './AudioVisualizer';
import { LyricSyncPanel } from './LyricSyncPanel';
import { AILyricistPanel } from './AILyricistPanel';
import { VocalSynthesizerPanel } from './VocalSynthesizerPanel';
import type { AudioAnalysisData, VisualStyle, LyricLine, RenderJob } from '@/types';

interface ControlPanelProps {
  analysisData: AudioAnalysisData;
  currentStyle: VisualStyle;
  lyrics: LyricLine[];
  rawLyrics: string;
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  fps: number;
  hasAudio: boolean;
  audioFileName: string;
  renderJob: RenderJob;
  canvasRef?: React.RefObject<HTMLCanvasElement>;
  audioBuffer?: AudioBuffer | null;
  onFileSelected: (file: File, url: string) => void;
  onUseVocalAsSource?: (url: string, fileName: string) => void;
  onLyricsChange: (raw: string) => void;
  onStyleChange: (style: VisualStyle) => void;
  onStartRender: (duration: number, resolution: string, fps: number) => void;
  onCancelRender: () => void;
  onResetRender: () => void;
}

interface SectionProps {
  id: string;
  label: string;
  icon: React.ReactNode;
  accentColor?: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  badge?: string;
}

function Section({ id, label, icon, accentColor = 'hsl(var(--hud-blue))', children, defaultOpen = false, badge }: SectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="border-b border-[hsl(var(--hud-border)/0.3)] last:border-b-0">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-[hsl(var(--border)/0.2)] transition-colors group"
      >
        <span style={{ color: accentColor }}>{icon}</span>
        <span className="text-[10px] font-mono uppercase tracking-widest text-[hsl(var(--foreground)/0.8)] flex-1 text-left">
          {label}
        </span>
        {badge && (
          <span
            className="text-[8px] font-mono px-1 py-0.5 rounded"
            style={{ background: `${accentColor}22`, color: accentColor, border: `1px solid ${accentColor}44` }}
          >
            {badge}
          </span>
        )}
        <ChevronDown
          className="w-3 h-3 text-[hsl(var(--muted-foreground))] transition-transform duration-200"
          style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
        />
      </button>

      <div
        className="overflow-hidden transition-all duration-300"
        style={{ maxHeight: open ? '800px' : '0px' }}
      >
        <div className="px-3 pb-3">
          {children}
        </div>
      </div>
    </div>
  );
}

export function ControlPanel({
  analysisData, currentStyle, lyrics, rawLyrics, currentTime, duration,
  isPlaying, fps, hasAudio, audioFileName, renderJob, canvasRef, audioBuffer,
  onFileSelected, onLyricsChange, onStyleChange,
  onStartRender, onCancelRender, onResetRender,
  onUseVocalAsSource,
}: ControlPanelProps) {

  const handleSyncApply = (newLyrics: LyricLine[], newLRC: string) => {
    onLyricsChange(newLRC);
  };

  const handleAIInsert = (generatedLyrics: string) => {
    // Append AI lyrics to existing raw lyrics
    const combined = rawLyrics
      ? rawLyrics + '\n' + generatedLyrics
      : generatedLyrics;
    onLyricsChange(combined);
  };

  return (
    <div className="h-full flex flex-col glass-panel border-r border-[hsl(var(--hud-border)/0.4)] overflow-hidden">
      {/* Panel header */}
      <div className="px-3 py-2 border-b border-[hsl(var(--hud-border)/0.3)] flex items-center gap-2 shrink-0">
        <div className="w-1 h-4 rounded-full bg-[hsl(var(--hud-blue))]" style={{ boxShadow: '0 0 8px hsl(var(--hud-blue))' }} />
        <span className="text-[9px] font-mono text-[hsl(var(--muted-foreground))] uppercase tracking-widest">Control Matrix</span>
      </div>

      <div className="flex-1 overflow-y-auto">
        <Section
          id="audio"
          label="Audio Source"
          icon={<Music2 className="w-3 h-3" />}
          accentColor="hsl(var(--hud-blue))"
          defaultOpen
        >
          <AudioUploader
            onFileSelected={onFileSelected}
            hasFile={hasAudio}
            fileName={audioFileName}
            duration={duration}
          />
          {hasAudio && (
            <div className="mt-2">
              <AudioVisualizer analysisData={analysisData} compact />
            </div>
          )}
        </Section>

        <Section
          id="lyrics"
          label="Lyrics Engine"
          icon={<Type className="w-3 h-3" />}
          accentColor="hsl(var(--hud-teal))"
          defaultOpen
        >
          <LyricsEditor
            lyrics={lyrics}
            currentTime={currentTime}
            onLyricsChange={onLyricsChange}
            rawText={rawLyrics}
          />
        </Section>

        {/* NEW: Lyric Sync Panel */}
        <Section
          id="sync"
          label="Lyric Sync Scanner"
          icon={<Scan className="w-3 h-3" />}
          accentColor="hsl(var(--hud-teal))"
          badge="NEW"
        >
          <LyricSyncPanel
            lyrics={lyrics}
            audioBuffer={audioBuffer ?? null}
            hasAudio={hasAudio}
            onApplySync={handleSyncApply}
          />
        </Section>

        {/* NEW: AI Lyricist Panel */}
        <Section
          id="ai-lyricist"
          label="AI Lyricist"
          icon={<Sparkles className="w-3 h-3" />}
          accentColor="hsl(var(--hud-magenta))"
          badge="AI"
        >
          <AILyricistPanel
            currentRawLyrics={rawLyrics}
            onInsertLyrics={handleAIInsert}
            bpm={analysisData.bpm}
          />
        </Section>

        {/* NEW: Vocal Synthesizer Panel */}
        <Section
          id="vocal-synth"
          label="Vocal Synthesizer"
          icon={<Mic className="w-3 h-3" />}
          accentColor="hsl(var(--hud-magenta))"
          badge="TTS"
        >
          <VocalSynthesizerPanel
            lyrics={lyrics}
            onUseAsAudioSource={onUseVocalAsSource}
          />
        </Section>

        <Section
          id="style"
          label="Visual Shader"
          icon={<Palette className="w-3 h-3" />}
          accentColor="hsl(var(--hud-magenta))"
        >
          <StyleSelector
            currentStyle={currentStyle}
            onStyleChange={onStyleChange}
          />
        </Section>

        <Section
          id="metrics"
          label="Live Telemetry"
          icon={<BarChart3 className="w-3 h-3" />}
          accentColor="hsl(var(--hud-amber))"
        >
          <StatusGauges analysisData={analysisData} isPlaying={isPlaying} fps={fps} />
        </Section>

        <Section
          id="render"
          label="Render Pipeline"
          icon={<Cpu className="w-3 h-3" />}
          accentColor="hsl(var(--hud-green))"
        >
          <RenderPanel
            job={renderJob}
            duration={duration}
            hasAudio={hasAudio}
            canvasRef={canvasRef}
            audioBuffer={audioBuffer}
            onStartRender={onStartRender}
            onCancelRender={onCancelRender}
            onResetRender={onResetRender}
          />
        </Section>
      </div>
    </div>
  );
}
