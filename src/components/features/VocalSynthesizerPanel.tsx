import { useState, useMemo } from 'react';
import {
  Mic, Play, Square, Download, Loader2, ChevronRight,
  Music, Volume2, Gauge, Sliders, Waveform, Zap, Info,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  useVocalSynthesizer,
  DEFAULT_VOCAL_SETTINGS,
  type VocalSettings,
  type VoiceStyle,
  type VoiceGender,
} from '@/hooks/useVocalSynthesizer';
import type { LyricLine } from '@/types';

interface VocalSynthesizerPanelProps {
  lyrics: LyricLine[];
  onUseAsAudioSource?: (url: string, fileName: string) => void;
}

const STYLE_OPTIONS: { value: VoiceStyle; label: string; icon: string; desc: string }[] = [
  { value: 'natural',  label: 'Natural',   icon: '🗣️', desc: 'Clear conversational delivery' },
  { value: 'rap',      label: 'Rap Flow',  icon: '🎤', desc: 'Fast punchy rhythmic speech' },
  { value: 'sing',     label: 'Melodic',   icon: '🎵', desc: 'Elongated sung delivery' },
  { value: 'dramatic', label: 'Dramatic',  icon: '🎭', desc: 'Slow powerful projection' },
  { value: 'whisper',  label: 'Whisper',   icon: '🌬️', desc: 'Soft intimate vocal tone' },
];

const STATUS_LABELS: Record<string, string> = {
  idle: 'Ready',
  loading: 'Loading AI...',
  speaking: 'Previewing...',
  capturing: 'Recording...',
  encoding: 'Encoding WAV...',
  ready: 'Audio Ready',
  error: 'Error',
};

const STATUS_COLORS: Record<string, string> = {
  idle:      'hsl(var(--muted-foreground))',
  loading:   'hsl(var(--hud-amber))',
  speaking:  'hsl(var(--hud-teal))',
  capturing: 'hsl(var(--hud-magenta))',
  encoding:  'hsl(var(--hud-blue))',
  ready:     'hsl(var(--hud-green))',
  error:     'hsl(var(--destructive))',
};

export function VocalSynthesizerPanel({ lyrics, onUseAsAudioSource }: VocalSynthesizerPanelProps) {
  const { state, preview, capture, downloadWav, stop, reset, isBusy } = useVocalSynthesizer();
  const [settings, setSettings] = useState<VocalSettings>(DEFAULT_VOCAL_SETTINGS);
  const [activeTab, setActiveTab] = useState<'voice' | 'controls' | 'output'>('voice');

  // Filter voices by gender and language
  const filteredVoices = useMemo(() => {
    return state.availableVoices.filter(v =>
      v.lang.startsWith('en') &&
      (settings.gender === 'male'
        ? v.name.match(/male|man|guy|david|mark|james|daniel|alex|ryan|chris|andrew/i)
        : v.name.match(/female|woman|jenny|zira|eva|karen|samantha|victoria|siri|aria/i))
    ).slice(0, 12);
  }, [state.availableVoices, settings.gender]);

  const set = <K extends keyof VocalSettings>(key: K, value: VocalSettings[K]) =>
    setSettings(prev => ({ ...prev, [key]: value }));

  const handlePreview = () => {
    if (lyrics.length === 0) {
      toast.error('No lyrics loaded');
      return;
    }
    preview(lyrics, settings);
  };

  const handleCapture = () => {
    if (lyrics.length === 0) {
      toast.error('No lyrics loaded');
      return;
    }
    capture(lyrics, settings);
  };

  const handleUseAsSource = () => {
    if (state.audioUrl && onUseAsAudioSource) {
      const ext = state.audioBlob?.type.includes('wav') ? 'wav' : 'mp3';
      onUseAsAudioSource(state.audioUrl, `vocal-synth-${settings.style}.${ext}`);
      toast.success('Loaded as audio source!', { description: 'Now playing through the LyricForge engine' });
    }
  };

  const statusColor = STATUS_COLORS[state.status] ?? STATUS_COLORS.idle;
  const statusLabel = STATUS_LABELS[state.status] ?? 'Unknown';

  return (
    <div className="space-y-3">
      {/* Info banner */}
      <div className="glass-panel rounded-lg p-2.5 border border-[hsl(var(--hud-blue)/0.3)]">
        <div className="flex items-start gap-2">
          <Info className="w-3 h-3 text-[hsl(var(--hud-blue))] mt-0.5 shrink-0" />
          <p className="text-[9px] font-mono text-[hsl(var(--hud-blue))] leading-relaxed">
            Converts lyrics to vocal audio using Edge-TTS neural voices. Preview uses Web Speech API instantly. Capture generates a downloadable WAV.
          </p>
        </div>
      </div>

      {/* Status bar */}
      <div className="flex items-center gap-2 glass-panel rounded-lg px-2.5 py-1.5">
        <div
          className="w-1.5 h-1.5 rounded-full"
          style={{
            background: statusColor,
            boxShadow: isBusy ? `0 0 6px ${statusColor}` : 'none',
            animation: isBusy ? 'pulse 1s infinite' : 'none',
          }}
        />
        <span className="text-[10px] font-mono flex-1" style={{ color: statusColor }}>
          {statusLabel}
        </span>
        {state.totalLines > 0 && isBusy && (
          <span className="text-[9px] font-mono text-[hsl(var(--muted-foreground))]">
            {state.currentLine >= 0 ? `${state.currentLine + 1}/${state.totalLines}` : `${state.progress}%`}
          </span>
        )}
        <Mic className="w-3 h-3" style={{ color: statusColor }} />
      </div>

      {/* Progress bar */}
      {isBusy && (
        <div className="h-0.5 bg-[hsl(var(--border)/0.4)] rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${state.progress}%`, background: statusColor, boxShadow: `0 0 8px ${statusColor}` }}
          />
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-0.5 glass-panel rounded-lg p-0.5">
        {(['voice', 'controls', 'output'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-1 rounded text-[9px] font-mono uppercase tracking-wider transition-all ${
              activeTab === tab
                ? 'bg-[hsl(var(--hud-magenta)/0.2)] text-[hsl(var(--hud-magenta))] border border-[hsl(var(--hud-magenta)/0.4)]'
                : 'text-[hsl(var(--muted-foreground))] hover:text-white'
            }`}
          >
            {tab === 'voice' ? '🎤 Voice' : tab === 'controls' ? '🎛 Controls' : '📁 Output'}
          </button>
        ))}
      </div>

      {/* Tab: Voice Selection */}
      {activeTab === 'voice' && (
        <div className="space-y-3">
          {/* Gender toggle */}
          <div className="space-y-1.5">
            <label className="text-[9px] font-mono text-[hsl(var(--muted-foreground))] uppercase tracking-wider">Voice Gender</label>
            <div className="flex gap-1">
              {(['male', 'female'] as VoiceGender[]).map((g) => (
                <button
                  key={g}
                  onClick={() => { set('gender', g); set('voiceName', ''); }}
                  className={`flex-1 py-1.5 rounded-lg text-[10px] font-mono capitalize transition-all ${
                    settings.gender === g
                      ? 'bg-[hsl(var(--hud-magenta)/0.2)] border border-[hsl(var(--hud-magenta)/0.5)] text-[hsl(var(--hud-magenta))]'
                      : 'neo-button text-[hsl(var(--muted-foreground))] hover:text-white'
                  }`}
                >
                  {g === 'male' ? '♂ Male' : '♀ Female'}
                </button>
              ))}
            </div>
          </div>

          {/* Style picker */}
          <div className="space-y-1.5">
            <label className="text-[9px] font-mono text-[hsl(var(--muted-foreground))] uppercase tracking-wider">Vocal Style</label>
            <div className="space-y-1">
              {STYLE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => set('style', opt.value)}
                  className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left transition-all ${
                    settings.style === opt.value
                      ? 'bg-[hsl(var(--hud-magenta)/0.12)] border border-[hsl(var(--hud-magenta)/0.4)]'
                      : 'neo-button hover:border-[hsl(var(--border))]'
                  }`}
                >
                  <span className="text-base leading-none">{opt.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className={`text-[10px] font-semibold ${settings.style === opt.value ? 'text-[hsl(var(--hud-magenta))]' : 'text-white'}`}>
                      {opt.label}
                    </div>
                    <div className="text-[8px] font-mono text-[hsl(var(--muted-foreground))] truncate">{opt.desc}</div>
                  </div>
                  {settings.style === opt.value && (
                    <ChevronRight className="w-3 h-3 text-[hsl(var(--hud-magenta))] shrink-0" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Browser voice override */}
          {filteredVoices.length > 0 && (
            <div className="space-y-1">
              <label className="text-[9px] font-mono text-[hsl(var(--muted-foreground))] uppercase tracking-wider">
                Browser Voice Override
              </label>
              <select
                value={settings.voiceName}
                onChange={e => set('voiceName', e.target.value)}
                className="w-full bg-[hsl(var(--background)/0.8)] border border-[hsl(var(--hud-border)/0.5)] rounded-lg px-2 py-1.5 text-[10px] font-mono text-white focus:outline-none focus:border-[hsl(var(--hud-magenta)/0.6)]"
              >
                <option value="">Auto (Edge-TTS Neural)</option>
                {filteredVoices.map(v => (
                  <option key={v.name} value={v.name}>{v.name.replace(/Microsoft|Google/g, '').trim()}</option>
                ))}
              </select>
              <p className="text-[8px] font-mono text-[hsl(var(--muted-foreground))]">
                {state.availableVoices.length} voices detected · Override for preview only
              </p>
            </div>
          )}
        </div>
      )}

      {/* Tab: Controls */}
      {activeTab === 'controls' && (
        <div className="space-y-3">
          {/* Rate */}
          <div className="space-y-1">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-1.5">
                <Gauge className="w-3 h-3 text-[hsl(var(--hud-teal))]" />
                <label className="text-[9px] font-mono text-[hsl(var(--muted-foreground))] uppercase tracking-wider">Speech Rate</label>
              </div>
              <span className="text-[11px] font-mono font-bold text-[hsl(var(--hud-teal))]">{settings.rate.toFixed(1)}×</span>
            </div>
            <input
              type="range" min={0.5} max={2.0} step={0.05}
              value={settings.rate}
              onChange={e => set('rate', parseFloat(e.target.value))}
              className="w-full h-1 accent-[hsl(var(--hud-teal))] cursor-pointer"
            />
            <div className="flex justify-between text-[8px] font-mono text-[hsl(var(--muted-foreground))]">
              <span>0.5× Slow</span><span>1.0× Normal</span><span>2.0× Fast</span>
            </div>
          </div>

          {/* Pitch */}
          <div className="space-y-1">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-1.5">
                <Music className="w-3 h-3 text-[hsl(var(--hud-blue))]" />
                <label className="text-[9px] font-mono text-[hsl(var(--muted-foreground))] uppercase tracking-wider">Pitch</label>
              </div>
              <span className="text-[11px] font-mono font-bold text-[hsl(var(--hud-blue))]">{settings.pitch.toFixed(1)}</span>
            </div>
            <input
              type="range" min={0.5} max={2.0} step={0.05}
              value={settings.pitch}
              onChange={e => set('pitch', parseFloat(e.target.value))}
              className="w-full h-1 accent-[hsl(var(--hud-blue))] cursor-pointer"
            />
            <div className="flex justify-between text-[8px] font-mono text-[hsl(var(--muted-foreground))]">
              <span>0.5 Deep</span><span>1.0 Normal</span><span>2.0 High</span>
            </div>
          </div>

          {/* Volume */}
          <div className="space-y-1">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-1.5">
                <Volume2 className="w-3 h-3 text-[hsl(var(--hud-amber))]" />
                <label className="text-[9px] font-mono text-[hsl(var(--muted-foreground))] uppercase tracking-wider">Volume</label>
              </div>
              <span className="text-[11px] font-mono font-bold text-[hsl(var(--hud-amber))]">{Math.round(settings.volume * 100)}%</span>
            </div>
            <input
              type="range" min={0} max={1} step={0.05}
              value={settings.volume}
              onChange={e => set('volume', parseFloat(e.target.value))}
              className="w-full h-1 accent-[hsl(var(--hud-amber))] cursor-pointer"
            />
          </div>

          {/* Pause between lines */}
          <div className="space-y-1">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-1.5">
                <Sliders className="w-3 h-3 text-[hsl(var(--hud-magenta))]" />
                <label className="text-[9px] font-mono text-[hsl(var(--muted-foreground))] uppercase tracking-wider">Line Gap</label>
              </div>
              <span className="text-[11px] font-mono font-bold text-[hsl(var(--hud-magenta))]">{settings.pauseBetweenLines}ms</span>
            </div>
            <input
              type="range" min={0} max={1500} step={50}
              value={settings.pauseBetweenLines}
              onChange={e => set('pauseBetweenLines', parseInt(e.target.value))}
              className="w-full h-1 accent-[hsl(var(--hud-magenta))] cursor-pointer"
            />
            <div className="flex justify-between text-[8px] font-mono text-[hsl(var(--muted-foreground))]">
              <span>No gap</span><span>750ms</span><span>1.5s</span>
            </div>
          </div>

          {/* Preset shortcuts */}
          <div className="space-y-1">
            <label className="text-[9px] font-mono text-[hsl(var(--muted-foreground))] uppercase tracking-wider">Quick Presets</label>
            <div className="grid grid-cols-3 gap-1">
              {[
                { label: 'Slow Jam', rate: 0.75, pitch: 0.9 },
                { label: 'Normal',   rate: 1.0,  pitch: 1.0 },
                { label: 'Rapid',    rate: 1.5,  pitch: 1.1 },
              ].map(p => (
                <button
                  key={p.label}
                  onClick={() => { set('rate', p.rate); set('pitch', p.pitch); }}
                  className="neo-button py-1.5 rounded text-[9px] font-mono text-[hsl(var(--muted-foreground))] hover:text-white transition-colors"
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab: Output */}
      {activeTab === 'output' && (
        <div className="space-y-3">
          {state.status === 'ready' && state.audioUrl ? (
            <div className="space-y-2">
              {/* Audio player */}
              <div className="glass-panel rounded-lg p-2 border border-[hsl(var(--hud-green)/0.4)]" style={{ boxShadow: '0 0 12px hsl(var(--hud-green)/0.1)' }}>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 rounded-full bg-[hsl(var(--hud-green))] animate-pulse" />
                  <span className="text-[10px] font-mono text-[hsl(var(--hud-green))]">VOCAL AUDIO READY</span>
                  <span className="text-[9px] font-mono text-[hsl(var(--muted-foreground))] ml-auto">
                    {state.audioBlob ? `${(state.audioBlob.size / 1024).toFixed(0)} KB` : ''}
                  </span>
                </div>
                <audio
                  src={state.audioUrl}
                  controls
                  className="w-full h-8"
                  style={{ filter: 'invert(1) hue-rotate(180deg)' }}
                />
              </div>

              {/* SSML preview */}
              {state.ssml && (
                <details className="group">
                  <summary className="text-[9px] font-mono text-[hsl(var(--muted-foreground))] cursor-pointer hover:text-white flex items-center gap-1">
                    <ChevronRight className="w-2.5 h-2.5 group-open:rotate-90 transition-transform" />
                    VIEW SSML MARKUP
                  </summary>
                  <div className="mt-1 max-h-24 overflow-y-auto glass-panel rounded p-1.5 border border-[hsl(var(--border)/0.3)]">
                    <pre className="text-[8px] font-mono text-[hsl(var(--muted-foreground))] whitespace-pre-wrap break-all">
                      {state.ssml.substring(0, 500)}{state.ssml.length > 500 ? '...' : ''}
                    </pre>
                  </div>
                </details>
              )}

              {/* Action buttons */}
              <div className="flex gap-1.5">
                <button
                  onClick={() => downloadWav('lyricforge-vocal')}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[10px] font-semibold bg-[hsl(var(--hud-green)/0.15)] border border-[hsl(var(--hud-green)/0.5)] text-[hsl(var(--hud-green))] hover:bg-[hsl(var(--hud-green)/0.25)] transition-all"
                  style={{ boxShadow: '0 0 10px hsl(var(--hud-green)/0.2)' }}
                >
                  <Download className="w-3.5 h-3.5" />
                  DOWNLOAD
                </button>
                {onUseAsAudioSource && (
                  <button
                    onClick={handleUseAsSource}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[10px] font-semibold bg-[hsl(var(--hud-blue)/0.15)] border border-[hsl(var(--hud-blue)/0.5)] text-[hsl(var(--hud-blue))] hover:bg-[hsl(var(--hud-blue)/0.25)] transition-all"
                  >
                    <Zap className="w-3.5 h-3.5" />
                    USE AS SOURCE
                  </button>
                )}
              </div>

              <button
                onClick={reset}
                className="w-full text-[9px] font-mono text-[hsl(var(--muted-foreground))] hover:text-white transition-colors py-1"
              >
                RESET OUTPUT
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-6 gap-2">
              <div className="w-10 h-10 rounded-xl glass-panel border border-[hsl(var(--border)/0.3)] flex items-center justify-center">
                <Download className="w-5 h-5 text-[hsl(var(--muted-foreground))]" />
              </div>
              <p className="text-[10px] font-mono text-[hsl(var(--muted-foreground))] text-center">
                Use "Capture WAV" to generate<br />a downloadable audio file
              </p>
            </div>
          )}
        </div>
      )}

      {/* Action Buttons (always visible) */}
      <div className="border-t border-[hsl(var(--border)/0.3)] pt-3 space-y-1.5">
        {isBusy ? (
          <button
            onClick={stop}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-[11px] font-semibold border border-[hsl(var(--destructive)/0.5)] text-[hsl(var(--destructive))] hover:bg-[hsl(var(--destructive)/0.1)] transition-all"
          >
            <Square className="w-3.5 h-3.5 fill-current" />
            STOP
          </button>
        ) : (
          <>
            <button
              onClick={handlePreview}
              disabled={lyrics.length === 0}
              className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-[11px] font-semibold transition-all ${
                lyrics.length === 0
                  ? 'opacity-40 cursor-not-allowed neo-button text-[hsl(var(--muted-foreground))]'
                  : 'bg-[hsl(var(--hud-teal)/0.15)] border border-[hsl(var(--hud-teal)/0.5)] text-[hsl(var(--hud-teal))] hover:bg-[hsl(var(--hud-teal)/0.25)]'
              }`}
              style={lyrics.length > 0 ? { boxShadow: '0 0 12px hsl(var(--hud-teal)/0.2)' } : {}}
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              PREVIEW ({lyrics.length} LINES)
            </button>

            <button
              onClick={handleCapture}
              disabled={lyrics.length === 0}
              className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-[11px] font-semibold transition-all ${
                lyrics.length === 0
                  ? 'opacity-40 cursor-not-allowed neo-button text-[hsl(var(--muted-foreground))]'
                  : 'bg-[hsl(var(--hud-magenta)/0.15)] border border-[hsl(var(--hud-magenta)/0.5)] text-[hsl(var(--hud-magenta))] hover:bg-[hsl(var(--hud-magenta)/0.25)]'
              }`}
              style={lyrics.length > 0 ? { boxShadow: '0 0 12px hsl(var(--hud-magenta)/0.2)' } : {}}
            >
              <Mic className="w-3.5 h-3.5" />
              CAPTURE WAV (EDGE-TTS)
            </button>
          </>
        )}

        <p className="text-[8px] font-mono text-[hsl(var(--muted-foreground))] text-center leading-relaxed">
          Preview = instant Web Speech API · Capture = high-quality Edge-TTS neural MP3→WAV
        </p>
      </div>
    </div>
  );
}
