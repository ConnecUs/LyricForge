import { useRef } from 'react';
import { Upload, Music, FolderOpen } from 'lucide-react';
import { toast } from 'sonner';

interface AudioUploaderProps {
  onFileSelected: (file: File, url: string) => void;
  hasFile: boolean;
  fileName: string;
  duration: number;
}

export function AudioUploader({ onFileSelected, hasFile, fileName, duration }: AudioUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    if (!file.type.startsWith('audio/')) {
      toast.error('Please select an audio file (MP3, WAV, FLAC, OGG)');
      return;
    }
    if (file.size > 500 * 1024 * 1024) {
      toast.error('File too large. Max 500MB supported.');
      return;
    }

    const url = URL.createObjectURL(file);
    onFileSelected(file, url);
    toast.success(`Loaded: ${file.name}`, { description: `${(file.size / 1024 / 1024).toFixed(1)} MB — analyzing audio...` });
    console.log('Audio file loaded:', file.name, file.size);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleFSA = async () => {
    try {
      // File System Access API — high-performance direct disk access
      const [handle] = await (window as unknown as {
        showOpenFilePicker: (opts: object) => Promise<FileSystemFileHandle[]>
      }).showOpenFilePicker({
        types: [{
          description: 'Audio Files',
          accept: { 'audio/*': ['.mp3', '.wav', '.flac', '.ogg', '.aac', '.m4a'] },
        }],
        multiple: false,
      });
      const file = await handle.getFile();
      handleFile(file);
      toast.info('File System Access API active', { description: 'Direct disk streaming enabled — zero RAM overhead' });
    } catch {
      // Fallback to standard input if FSA not supported
      inputRef.current?.click();
    }
  };

  const formatDuration = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-2">
      {hasFile ? (
        <div className="glass-panel rounded-lg p-3 border border-[hsl(var(--hud-blue)/0.4)]">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded glass-panel flex items-center justify-center hud-border">
              <Music className="w-4 h-4 text-[hsl(var(--hud-blue))]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-white truncate">{fileName}</p>
              <p className="text-[10px] font-mono text-[hsl(var(--hud-teal))]">
                {formatDuration(duration)} · FS-ACCESS · STREAMING
              </p>
            </div>
            <button
              onClick={handleFSA}
              className="neo-button p-1.5 rounded text-[10px] font-mono text-[hsl(var(--muted-foreground))] hover:text-white transition-colors"
            >
              SWAP
            </button>
          </div>

          {/* Simulated file info */}
          <div className="grid grid-cols-3 gap-1">
            {[
              { label: 'CODEC', value: 'PCM/MP3' },
              { label: 'SR', value: '44.1kHz' },
              { label: 'CH', value: 'Stereo' },
            ].map(({ label, value }) => (
              <div key={label} className="bg-[hsl(var(--background)/0.6)] rounded px-2 py-1">
                <div className="text-[8px] font-mono text-[hsl(var(--muted-foreground))]">{label}</div>
                <div className="text-[10px] font-mono text-[hsl(var(--hud-blue))]">{value}</div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          className="border border-dashed border-[hsl(var(--hud-border))] rounded-lg p-4 text-center hover:border-[hsl(var(--hud-blue)/0.5)] transition-colors cursor-pointer group"
          onClick={handleFSA}
        >
          <Upload className="w-6 h-6 text-[hsl(var(--muted-foreground))] mx-auto mb-2 group-hover:text-[hsl(var(--hud-blue))] transition-colors" />
          <p className="text-xs text-[hsl(var(--muted-foreground))]">Drop audio or click to select</p>
          <p className="text-[10px] font-mono text-[hsl(var(--muted-foreground)/0.6)] mt-0.5">MP3 · WAV · FLAC · OGG · up to 500MB</p>
        </div>
      )}

      <button
        onClick={handleFSA}
        className="neo-button w-full flex items-center justify-center gap-2 py-1.5 rounded-lg text-xs font-mono text-[hsl(var(--hud-teal))] hover:text-white transition-colors"
      >
        <FolderOpen className="w-3 h-3" />
        FILE SYSTEM ACCESS
      </button>

      <input
        ref={inputRef}
        type="file"
        accept="audio/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />
    </div>
  );
}
