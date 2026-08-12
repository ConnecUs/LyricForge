import { useState, useRef, useCallback, useEffect } from 'react';
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, Maximize2, Tv2 } from 'lucide-react';
import { toast } from 'sonner';
import { HUDHeader } from '@/components/layout/HUDHeader';
import { ControlPanel } from '@/components/features/ControlPanel';
import { PreviewCanvas } from '@/components/features/PreviewCanvas';
import { Timeline } from '@/components/features/Timeline';
import { FlowVisualizer } from '@/components/features/FlowVisualizer';
import { useAudioAnalyzer } from '@/hooks/useAudioAnalyzer';
import { useLyricsParser } from '@/hooks/useLyricsParser';
import { useRenderPipeline } from '@/hooks/useRenderPipeline';
import { useWebCodecsEncoder } from '@/hooks/useWebCodecsEncoder';
import { VISUAL_STYLES, SAMPLE_LYRICS } from '@/constants';
import type { LyricLine, VisualStyle } from '@/types';

export default function Index() {
  // ── Audio state ──────────────────────────────────────────────────────────
  const audioRef = useRef<HTMLAudioElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioFileName, setAudioFileName] = useState('');
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.8);
  const [isMuted, setIsMuted] = useState(false);
  const [previewFps, setPreviewFps] = useState(0);
  const [flowVisualizerOpen, setFlowVisualizerOpen] = useState(false);

  // ── Lyrics state ─────────────────────────────────────────────────────────
  const [rawLyrics, setRawLyrics] = useState(SAMPLE_LYRICS);
  const [lyrics, setLyrics] = useState<LyricLine[]>([]);

  // ── Visual style ─────────────────────────────────────────────────────────
  const [currentStyle, setCurrentStyle] = useState<VisualStyle>(VISUAL_STYLES[0]);

  // ── Hooks ────────────────────────────────────────────────────────────────
  const { analysisData, connectAudio, startAnalysis, stopAnalysis, bpm } = useAudioAnalyzer();
  const { parseLRC, parsePlainText, getCurrentLine, getNextLine, getActiveWordIndex, getWordProgress } = useLyricsParser();
  const { job: renderJob, startRender, cancelRender, resetRender } = useRenderPipeline();
  const { state: encoderState } = useWebCodecsEncoder();

  // ── FPS counter ──────────────────────────────────────────────────────────
  const fpsCounterRef = useRef<{ frames: number; lastTime: number }>({ frames: 0, lastTime: performance.now() });
  useEffect(() => {
    let raf: number;
    const measure = () => {
      fpsCounterRef.current.frames++;
      const now = performance.now();
      if (now - fpsCounterRef.current.lastTime >= 1000) {
        setPreviewFps(fpsCounterRef.current.frames);
        fpsCounterRef.current.frames = 0;
        fpsCounterRef.current.lastTime = now;
      }
      raf = requestAnimationFrame(measure);
    };
    raf = requestAnimationFrame(measure);
    return () => cancelAnimationFrame(raf);
  }, []);

  // ── Parse lyrics when raw text changes ───────────────────────────────────
  useEffect(() => {
    const isLRC = rawLyrics.includes('[') && rawLyrics.includes(']');
    const parsed = isLRC ? parseLRC(rawLyrics) : parsePlainText(rawLyrics);
    setLyrics(parsed);
    console.log('Lyrics parsed:', parsed.length, 'lines, words on first line:', parsed[0]?.words?.length);
  }, [rawLyrics, parseLRC, parsePlainText]);

  // ── Audio element events ─────────────────────────────────────────────────
  const handleLoadedMetadata = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return;
    setDuration(audio.duration);
    connectAudio(audio);

    if (audioUrl) {
      try {
        const response = await fetch(audioUrl);
        const arrayBuffer = await response.arrayBuffer();
        const offlineCtx = new OfflineAudioContext(2, 44100 * audio.duration, 44100);
        const decoded = await offlineCtx.decodeAudioData(arrayBuffer);
        setAudioBuffer(decoded);
        console.log('[Index] AudioBuffer decoded:', decoded.duration.toFixed(2), 's');
        toast.success('Audio decoded', { description: 'Ready for sync scan & rendering' });
      } catch (err) {
        console.warn('[Index] AudioBuffer decode failed:', err);
      }
    }
  }, [connectAudio, audioUrl]);

  const handleTimeUpdate = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    setCurrentTime(audio.currentTime);
  }, []);

  const handleEnded = useCallback(() => {
    setIsPlaying(false);
    stopAnalysis();
    toast.info('Playback complete');
  }, [stopAnalysis]);

  // ── Playback controls ─────────────────────────────────────────────────────
  const togglePlay = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio || !audioUrl) {
      toast.error('Please load an audio file first');
      return;
    }
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
      stopAnalysis();
    } else {
      await audio.play();
      setIsPlaying(true);
      startAnalysis();
    }
  }, [isPlaying, audioUrl, startAnalysis, stopAnalysis]);

  const handleSeek = useCallback((time: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = time;
    setCurrentTime(time);
  }, []);

  const handleSkipBack = useCallback(() => handleSeek(Math.max(0, currentTime - 10)), [currentTime, handleSeek]);
  const handleSkipForward = useCallback(() => handleSeek(Math.min(duration, currentTime + 10)), [currentTime, duration, handleSeek]);

  const toggleMute = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.muted = !isMuted;
    setIsMuted(!isMuted);
  }, [isMuted]);

  const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseFloat(e.target.value);
    setVolume(v);
    if (audioRef.current) audioRef.current.volume = v;
  }, []);

  // ── File selection ────────────────────────────────────────────────────────
  const handleFileSelected = useCallback((file: File, url: string) => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(url);
    setAudioFileName(file.name);
    setAudioBuffer(null);
    setIsPlaying(false);
    setCurrentTime(0);
    if (audioRef.current) {
      audioRef.current.src = url;
      audioRef.current.volume = volume;
    }
  }, [audioUrl, volume]);

  // ── Vocal synth → use as audio source ────────────────────────────────────
  const handleVocalAsSource = useCallback((url: string, fileName: string) => {
    // Create a pseudo-File object for compatibility
    const mockFile = new File([], fileName, { type: 'audio/wav' });
    handleFileSelected(mockFile, url);
  }, [handleFileSelected]);

  // ── Lyric + word state ────────────────────────────────────────────────────
  const currentLyric = getCurrentLine(lyrics, currentTime);
  const nextLyric = getNextLine(lyrics, currentTime);
  const activeWordIndex = getActiveWordIndex(currentLyric, currentTime);
  const wordProgress = getWordProgress(currentLyric, activeWordIndex, currentTime);

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-background">
      {/* Hidden audio element */}
      <audio
        ref={audioRef}
        onLoadedMetadata={handleLoadedMetadata}
        onTimeUpdate={handleTimeUpdate}
        onEnded={handleEnded}
        crossOrigin="anonymous"
        preload="metadata"
      />

      {/* HUD Header */}
      <HUDHeader
        bpm={bpm}
        isPlaying={isPlaying}
        resolution="1080p"
        fps={previewFps}
        webgpuActive={false}
        webCodecsActive={encoderState.status !== 'unsupported' && 'VideoEncoder' in window}
        hardwareAccel={encoderState.hardwareAccelerated}
      />

      {/* Main Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Control Panel */}
        <div className="w-72 shrink-0 overflow-hidden">
          <ControlPanel
            analysisData={analysisData}
            currentStyle={currentStyle}
            lyrics={lyrics}
            rawLyrics={rawLyrics}
            currentTime={currentTime}
            duration={duration}
            isPlaying={isPlaying}
            fps={previewFps}
            hasAudio={!!audioUrl}
            audioFileName={audioFileName}
            renderJob={renderJob}
            canvasRef={canvasRef as React.RefObject<HTMLCanvasElement>}
            audioBuffer={audioBuffer}
            onFileSelected={handleFileSelected}
            onLyricsChange={setRawLyrics}
            onStyleChange={setCurrentStyle}
            onStartRender={startRender}
            onCancelRender={cancelRender}
            onResetRender={resetRender}
            onUseVocalAsSource={handleVocalAsSource}
          />
        </div>

        {/* Preview Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Canvas Preview */}
          <div className="flex-1 relative overflow-hidden bg-[hsl(225,39%,2%)]">
            <div className="absolute inset-0 hud-scan-line pointer-events-none z-10" />

            <PreviewCanvas
              analysisData={analysisData}
              style={currentStyle}
              currentLyric={currentLyric}
              nextLyric={nextLyric}
              currentTime={currentTime}
              isPlaying={isPlaying}
              activeWordIndex={activeWordIndex}
              wordProgress={wordProgress}
            />

            {/* No audio placeholder */}
            {!audioUrl && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="text-center animate-float-in">
                  <div className="w-16 h-16 rounded-2xl glass-panel border border-[hsl(var(--hud-blue)/0.3)] flex items-center justify-center mx-auto mb-4 animate-pulse-glow">
                    <Play className="w-8 h-8 text-[hsl(var(--hud-blue)/0.6)]" />
                  </div>
                  <p className="text-sm font-semibold text-[hsl(var(--foreground)/0.5)]">Load audio to begin</p>
                  <p className="text-xs font-mono text-[hsl(var(--muted-foreground))] mt-1">
                    Particle engine active · {currentStyle.particleConfig.count.toLocaleString()} pts
                  </p>
                </div>
              </div>
            )}

            {/* Corner badges */}
            <div className="absolute top-3 right-3 z-20 flex flex-col items-end gap-1 pointer-events-none">
              <div className="glass-panel rounded px-2 py-1 flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-[hsl(var(--hud-teal))] animate-pulse" />
                <span className="text-[9px] font-mono text-[hsl(var(--hud-teal))]">
                  {'VideoEncoder' in window ? 'WebCodecs ✓' : 'WebGL ACTIVE'}
                </span>
              </div>
              <div className="glass-panel rounded px-2 py-1">
                <span className="text-[9px] font-mono text-[hsl(var(--muted-foreground))]">
                  {currentStyle.name.toUpperCase()}
                </span>
              </div>
              {activeWordIndex >= 0 && currentLyric?.words?.[activeWordIndex] && (
                <div
                  className="glass-panel rounded px-2 py-0.5 border border-[hsl(var(--hud-magenta)/0.4)]"
                  style={{ boxShadow: '0 0 8px hsl(var(--hud-magenta)/0.2)' }}
                >
                  <span className="text-[9px] font-mono text-[hsl(var(--hud-magenta))]">
                    WORD {activeWordIndex + 1}/{currentLyric.words!.length} · Intl.Segmenter
                  </span>
                </div>
              )}
            </div>

            {/* Current lyric badge */}
            {currentLyric && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
                <div className="glass-panel-bright rounded-full px-4 py-1 border border-[hsl(var(--hud-blue)/0.3)]">
                  <span className="text-[10px] font-mono text-[hsl(var(--hud-blue))]">
                    ▶ {currentLyric.text.substring(0, 40)}{currentLyric.text.length > 40 ? '...' : ''}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Transport Controls */}
          <div className="glass-panel border-t border-[hsl(var(--hud-border)/0.4)] px-6 py-2 flex items-center gap-4">
            <div className="flex items-center gap-2">
              <button
                onClick={handleSkipBack}
                className="neo-button w-8 h-8 rounded-lg flex items-center justify-center text-[hsl(var(--muted-foreground))] hover:text-white transition-colors"
              >
                <SkipBack className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={togglePlay}
                className="w-10 h-10 rounded-xl flex items-center justify-center bg-[hsl(var(--hud-blue))] hover:bg-[hsl(213,95%,45%)] transition-all shadow-lg"
                style={{ boxShadow: isPlaying ? '0 0 20px hsl(213,95%,50%,0.5)' : 'none' }}
              >
                {isPlaying
                  ? <Pause className="w-4 h-4 text-white" />
                  : <Play className="w-4 h-4 text-white ml-0.5" />
                }
              </button>

              <button
                onClick={handleSkipForward}
                className="neo-button w-8 h-8 rounded-lg flex items-center justify-center text-[hsl(var(--muted-foreground))] hover:text-white transition-colors"
              >
                <SkipForward className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="flex items-center gap-2 ml-2">
              <button onClick={toggleMute} className="text-[hsl(var(--muted-foreground))] hover:text-white transition-colors">
                {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
              </button>
              <input
                type="range" min={0} max={1} step={0.01} value={volume}
                onChange={handleVolumeChange}
                className="w-20 h-1 accent-[hsl(var(--hud-blue))] cursor-pointer"
              />
            </div>

            <div className="flex-1" />

            {/* Word sync indicator */}
            {activeWordIndex >= 0 && (
              <div className="flex items-center gap-1 px-2 py-1 rounded glass-panel border border-[hsl(var(--hud-magenta)/0.3)]">
                <div className="w-1 h-1 rounded-full bg-[hsl(var(--hud-magenta))] animate-pulse" />
                <span className="text-[9px] font-mono text-[hsl(var(--hud-magenta))]">
                  WORD-SYNC · {Math.round(wordProgress * 100)}%
                </span>
              </div>
            )}

            {/* Flow Visualizer button */}
            <button
              onClick={() => setFlowVisualizerOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg neo-button text-[hsl(var(--hud-teal))] border border-[hsl(var(--hud-teal)/0.4)] hover:text-white hover:border-[hsl(var(--hud-teal)/0.7)] transition-all text-[10px] font-mono"
              title="Open Flow Visualizer (karaoke mode)"
            >
              <Tv2 className="w-3.5 h-3.5" />
              FLOW
            </button>

            {/* Style switcher */}
            <div className="flex items-center gap-1">
              {VISUAL_STYLES.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setCurrentStyle(s)}
                  title={s.name}
                  className={`w-6 h-6 rounded-md transition-all ${currentStyle.id === s.id ? 'border border-[hsl(var(--hud-blue)/0.8)] bg-[hsl(var(--hud-blue)/0.2)]' : 'neo-button opacity-60 hover:opacity-100'}`}
                >
                  <div className="w-full h-full rounded-md" style={{ background: s.particleConfig.colorPrimary + '88' }} />
                </button>
              ))}
            </div>

            <button className="neo-button w-8 h-8 rounded-lg flex items-center justify-center text-[hsl(var(--muted-foreground))] hover:text-white transition-colors">
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Timeline */}
          <Timeline
            currentTime={currentTime}
            duration={duration}
            lyrics={lyrics}
            isPlaying={isPlaying}
            onSeek={handleSeek}
          />
        </div>
      </div>

      {/* Flow Visualizer Modal */}
      <FlowVisualizer
        lyrics={lyrics}
        audioRef={audioRef}
        isOpen={flowVisualizerOpen}
        onClose={() => setFlowVisualizerOpen(false)}
      />
    </div>
  );
}
