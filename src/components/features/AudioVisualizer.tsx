import { useRef, useEffect } from 'react';
import type { AudioAnalysisData } from '@/types';

interface AudioVisualizerProps {
  analysisData: AudioAnalysisData;
  compact?: boolean;
}

export function AudioVisualizer({ analysisData, compact = false }: AudioVisualizerProps) {
  const waveCanvasRef = useRef<HTMLCanvasElement>(null);
  const specCanvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const drawWave = () => {
      const canvas = waveCanvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const { timeDomainData, bassLevel } = analysisData;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      ctx.beginPath();
      const sliceWidth = canvas.width / timeDomainData.length;
      let x = 0;

      ctx.strokeStyle = `hsl(213, 95%, ${50 + bassLevel * 30}%)`;
      ctx.lineWidth = compact ? 1 : 1.5;
      ctx.shadowColor = 'hsl(213, 95%, 60%)';
      ctx.shadowBlur = compact ? 4 : 8;

      for (let i = 0; i < timeDomainData.length; i++) {
        const v = timeDomainData[i] / 128;
        const y = (v * canvas.height) / 2;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
        x += sliceWidth;
      }

      ctx.stroke();
      ctx.shadowBlur = 0;
      rafRef.current = requestAnimationFrame(drawWave);
    };

    rafRef.current = requestAnimationFrame(drawWave);
    return () => cancelAnimationFrame(rafRef.current);
  }, [analysisData, compact]);

  useEffect(() => {
    const drawSpectrum = () => {
      const canvas = specCanvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const { frequencyData } = analysisData;
      const bars = compact ? 32 : 64;

      for (let i = 0; i < bars; i++) {
        const value = frequencyData[Math.floor(i * frequencyData.length / bars)] / 255;
        const h = value * canvas.height;
        const hue = 180 + i * 2;

        const grad = ctx.createLinearGradient(0, canvas.height - h, 0, canvas.height);
        grad.addColorStop(0, `hsla(${hue}, 90%, 60%, 0.9)`);
        grad.addColorStop(1, `hsla(${hue}, 90%, 40%, 0.3)`);
        ctx.fillStyle = grad;

        const barW = canvas.width / bars - 1;
        ctx.fillRect(i * (barW + 1), canvas.height - h, barW, h);
      }
    };

    const spec = specCanvasRef.current;
    if (!spec) return;
    const rafSpec = requestAnimationFrame(drawSpectrum);
    return () => cancelAnimationFrame(rafSpec);
  }, [analysisData, compact]);

  const h = compact ? 'h-12' : 'h-16';

  return (
    <div className="space-y-1">
      <div className={`${h} rounded overflow-hidden bg-[hsl(var(--background)/0.5)]`}>
        <canvas
          ref={waveCanvasRef}
          className="w-full h-full"
          width={400}
          height={compact ? 48 : 64}
        />
      </div>
      <div className={`${h} rounded overflow-hidden bg-[hsl(var(--background)/0.5)]`}>
        <canvas
          ref={specCanvasRef}
          className="w-full h-full"
          width={400}
          height={compact ? 48 : 64}
        />
      </div>
    </div>
  );
}
