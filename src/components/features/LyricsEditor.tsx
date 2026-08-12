import { useRef, useState } from 'react';
import { FileText, Upload, RefreshCw, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { SAMPLE_LYRICS } from '@/constants';
import type { LyricLine } from '@/types';

interface LyricsEditorProps {
  lyrics: LyricLine[];
  currentTime: number;
  onLyricsChange: (raw: string) => void;
  rawText: string;
}

export function LyricsEditor({ lyrics, currentTime, onLyricsChange, rawText }: LyricsEditorProps) {
  const [activeTab, setActiveTab] = useState<'edit' | 'preview'>('edit');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      onLyricsChange(text);
      toast.success(`Loaded: ${file.name}`, { description: `${lyrics.length} lines parsed` });
    };
    reader.readAsText(file);
  };

  const loadSample = () => {
    onLyricsChange(SAMPLE_LYRICS);
    toast.info('Sample lyrics loaded', { description: 'LRC format with timestamps' });
  };

  const getCurrentLineIndex = () => {
    for (let i = lyrics.length - 1; i >= 0; i--) {
      if (currentTime >= lyrics[i].time) return i;
    }
    return -1;
  };

  const activeIndex = getCurrentLineIndex();

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = (s % 60).toFixed(2);
    return `${m.toString().padStart(2, '0')}:${sec.padStart(5, '0')}`;
  };

  return (
    <div className="space-y-2">
      {/* Tab switcher */}
      <div className="flex gap-1 glass-panel rounded-lg p-0.5">
        {(['edit', 'preview'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-1 rounded text-[10px] font-mono uppercase tracking-wider transition-all ${
              activeTab === tab
                ? 'bg-[hsl(var(--hud-blue)/0.2)] text-[hsl(var(--hud-blue))] border border-[hsl(var(--hud-blue)/0.4)]'
                : 'text-[hsl(var(--muted-foreground))] hover:text-white'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'edit' ? (
        <>
          <textarea
            value={rawText}
            onChange={(e) => onLyricsChange(e.target.value)}
            className="w-full h-40 bg-[hsl(var(--background)/0.7)] border border-[hsl(var(--hud-border)/0.5)] rounded-lg p-2 text-xs font-mono text-white resize-none focus:outline-none focus:border-[hsl(var(--hud-blue)/0.6)] placeholder-[hsl(var(--muted-foreground))] leading-relaxed"
            placeholder={'[00:05.00] Your lyrics here...\n[00:10.00] Next line\n\nOr paste plain text without timestamps'}
            spellCheck={false}
          />
          <div className="flex gap-1.5">
            <button
              onClick={loadSample}
              className="neo-button flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded text-[10px] font-mono text-[hsl(var(--hud-teal))] hover:text-white transition-colors"
            >
              <RefreshCw className="w-3 h-3" />
              SAMPLE
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="neo-button flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded text-[10px] font-mono text-[hsl(var(--muted-foreground))] hover:text-white transition-colors"
            >
              <Upload className="w-3 h-3" />
              LOAD .LRC
            </button>
          </div>
          <p className="text-[9px] font-mono text-[hsl(var(--muted-foreground))]">
            {lyrics.length} LINES PARSED · LRC + PLAIN TEXT SUPPORTED
          </p>
        </>
      ) : (
        <div className="h-44 overflow-y-auto space-y-0.5 pr-1">
          {lyrics.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <FileText className="w-6 h-6 text-[hsl(var(--muted-foreground))] mx-auto mb-2" />
                <p className="text-[10px] text-[hsl(var(--muted-foreground))]">No lyrics loaded</p>
              </div>
            </div>
          ) : (
            lyrics.map((line, i) => (
              <div
                key={i}
                className={`flex items-center gap-2 px-2 py-1 rounded transition-all ${
                  i === activeIndex
                    ? 'bg-[hsl(var(--hud-blue)/0.15)] border-l-2 border-[hsl(var(--hud-blue))]'
                    : 'hover:bg-[hsl(var(--border)/0.3)]'
                }`}
              >
                <div className="flex items-center gap-1 shrink-0">
                  <Clock className="w-2.5 h-2.5 text-[hsl(var(--muted-foreground))]" />
                  <span className="text-[9px] font-mono text-[hsl(var(--muted-foreground))]">
                    {formatTime(line.time)}
                  </span>
                </div>
                <span className={`text-[11px] truncate ${i === activeIndex ? 'text-white font-semibold hud-glow-text' : 'text-[hsl(var(--muted-foreground))]'}`}>
                  {line.text}
                </span>
              </div>
            ))
          )}
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept=".lrc,.txt"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFileUpload(f);
        }}
      />
    </div>
  );
}
