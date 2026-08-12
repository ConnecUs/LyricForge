import { useRef, useEffect, useCallback, useState } from 'react';
import type { AudioAnalysisData, VisualStyle, LyricLine } from '@/types';
import { useWebGPU } from '@/hooks/useWebGPU';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  opacity: number;
  hue: number;
  life: number;
  maxLife: number;
}

interface PreviewCanvasProps {
  analysisData: AudioAnalysisData;
  style: VisualStyle;
  currentLyric: LyricLine | null;
  nextLyric: LyricLine | null;
  currentTime: number;
  isPlaying: boolean;
  activeWordIndex?: number;
  wordProgress?: number;
}

export function PreviewCanvas({
  analysisData,
  style,
  currentLyric,
  nextLyric,
  currentTime,
  isPlaying,
  activeWordIndex = -1,
  wordProgress = 0,
}: PreviewCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // CPU fallback particles (used when WebGPU unavailable)
  const cpuParticlesRef = useRef<Particle[]>([]);
  // WebGPU computed particle data (Float32Array from compute shader)
  const gpuParticleDataRef = useRef<Float32Array | null>(null);
  const rafRef = useRef<number>(0);
  const frameRef = useRef<number>(0);

  const [useGPU, setUseGPU] = useState(false);
  const { gpuState, init: initGPU, compute: computeGPU } = useWebGPU();

  // ── Attempt WebGPU init on mount ─────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const success = await initGPU({
        count: style.particleConfig.count * 2, // double on GPU since it's free
        colorPrimary: hexToRgb(style.particleConfig.colorPrimary),
        colorAccent: hexToRgb(style.particleConfig.colorAccent),
        turbulence: style.particleConfig.turbulence,
        speed: style.particleConfig.speed,
      });
      setUseGPU(success);
      if (!success) {
        console.info('[PreviewCanvas] WebGPU unavailable — using CPU particle fallback');
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [style.id]);

  // ── CPU fallback particle init ────────────────────────────────────────────
  const initCPUParticles = useCallback((canvas: HTMLCanvasElement) => {
    const { count, colorPrimary } = style.particleConfig;
    cpuParticlesRef.current = Array.from({ length: count }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 1.2,
      vy: (Math.random() - 0.5) * 1.2,
      size: Math.random() * style.particleConfig.size + 0.5,
      opacity: Math.random() * 0.7 + 0.15,
      hue: parseFloat(hexToHsl(colorPrimary).split(',')[0]),
      life: Math.random() * 100,
      maxLife: 100 + Math.random() * 200,
    }));
  }, [style]);

  // ── Utilities ─────────────────────────────────────────────────────────────
  function hexToRgb(hex: string): [number, number, number] {
    const map: Record<string, [number, number, number]> = {
      '#0b84f3': [0.043, 0.518, 0.953],
      '#00e5ff': [0, 0.898, 1],
      '#d946ef': [0.851, 0.275, 0.937],
      '#00ffd4': [0, 1, 0.831],
      '#f59e0b': [0.961, 0.620, 0.043],
      '#ef4444': [0.937, 0.267, 0.267],
    };
    return map[hex] ?? [0.043, 0.518, 0.953];
  }

  function hexToHsl(color: string): string {
    const map: Record<string, string> = {
      '#0b84f3': '213, 95%, 50%',
      '#00e5ff': '186, 100%, 50%',
      '#d946ef': '300, 85%, 60%',
      '#00ffd4': '170, 100%, 50%',
      '#f59e0b': '38, 95%, 52%',
      '#ef4444': '0, 84%, 60%',
    };
    return map[color] || '213, 95%, 50%';
  }

  // ── Background draw ───────────────────────────────────────────────────────
  const drawBackground = (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, frame: number) => {
    ctx.fillStyle = 'rgba(2, 4, 14, 0.82)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (style.backgroundEffect === 'grid') {
      ctx.strokeStyle = 'rgba(11, 132, 243, 0.08)';
      ctx.lineWidth = 0.5;
      const gs = 40;
      for (let x = 0; x < canvas.width; x += gs) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
      }
      for (let y = 0; y < canvas.height; y += gs) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
      }
      const hGrad = ctx.createLinearGradient(0, canvas.height * 0.6, 0, canvas.height);
      hGrad.addColorStop(0, 'rgba(11, 132, 243, 0.04)');
      hGrad.addColorStop(1, 'rgba(11, 132, 243, 0.14)');
      ctx.fillStyle = hGrad;
      ctx.fillRect(0, canvas.height * 0.6, canvas.width, canvas.height * 0.4);
    } else if (style.backgroundEffect === 'aurora') {
      const t = frame * 0.007;
      for (let i = 0; i < 3; i++) {
        const grd = ctx.createRadialGradient(
          canvas.width * (0.2 + i * 0.3 + Math.sin(t + i) * 0.1),
          canvas.height * (0.3 + Math.cos(t * 0.7 + i) * 0.2),
          0,
          canvas.width * 0.5, canvas.height * 0.5, canvas.width * 0.65
        );
        const cols = [
          ['rgba(217,70,239,0.1)', 'transparent'],
          ['rgba(11,132,243,0.09)', 'transparent'],
          ['rgba(0,228,255,0.07)', 'transparent'],
        ];
        grd.addColorStop(0, cols[i][0]);
        grd.addColorStop(1, cols[i][1]);
        ctx.fillStyle = grd;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
    } else if (style.backgroundEffect === 'waveform') {
      const cx = canvas.width / 2;
      const cy = canvas.height / 2;
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(0,255,212,0.13)';
      ctx.lineWidth = 1;
      for (let i = 0; i < analysisData.timeDomainData.length; i++) {
        const angle = (i / analysisData.timeDomainData.length) * Math.PI * 2;
        const amp = (analysisData.timeDomainData[i] - 128) / 128;
        const r = canvas.height * 0.33 + amp * 28;
        const x = cx + Math.cos(angle) * r;
        const y = cy + Math.sin(angle) * r;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.closePath(); ctx.stroke();
    }
  };

  // ── GPU particle draw (from WebGPU compute output) ────────────────────────
  const drawGPUParticles = (ctx: CanvasRenderingContext2D) => {
    const data = gpuParticleDataRef.current;
    if (!data) return;

    const FLOATS_PER = 8;
    const primaryHsl = hexToHsl(style.particleConfig.colorPrimary);
    const { bassLevel } = analysisData;

    for (let i = 0; i < data.length / FLOATS_PER; i++) {
      const base = i * FLOATS_PER;
      const x = data[base + 0];
      const y = data[base + 1];
      const life = data[base + 4];
      const maxLife = data[base + 5];
      const size = data[base + 7];

      const lifeRatio = life / Math.max(maxLife, 0.001);
      const fadeIn = lifeRatio < 0.1 ? lifeRatio * 10 : 1;
      const fadeOut = lifeRatio > 0.9 ? (1 - lifeRatio) * 10 : 1;
      const opacity = fadeIn * fadeOut * 0.7;
      const glowR = size * (1 + bassLevel * 1.8);

      const grd = ctx.createRadialGradient(x, y, 0, x, y, glowR * 3);
      grd.addColorStop(0, `hsla(${primaryHsl}, ${opacity.toFixed(2)})`);
      grd.addColorStop(1, `hsla(${primaryHsl}, 0)`);
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(x, y, glowR * 3, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = `hsla(${primaryHsl}, ${Math.min(1, opacity * 2).toFixed(2)})`;
      ctx.beginPath();
      ctx.arc(x, y, glowR, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  // ── CPU particle draw (fallback) ──────────────────────────────────────────
  const drawCPUParticles = (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) => {
    const { bassLevel, midLevel, highLevel, spectralFlux } = analysisData;
    const { speed, turbulence, colorPrimary } = style.particleConfig;
    const primaryHsl = hexToHsl(colorPrimary);
    const beatBurst = spectralFlux > 0.15;

    cpuParticlesRef.current.forEach((p) => {
      const nx = Math.sin(p.y * 0.008 + frameRef.current * 0.01);
      const ny = Math.cos(p.x * 0.008 + frameRef.current * 0.01);
      const audioForce = bassLevel * 1.5 + midLevel * 0.5;
      p.vx += nx * turbulence * 0.05 + audioForce * (Math.random() - 0.5) * 0.1;
      p.vy += ny * turbulence * 0.05 + audioForce * (Math.random() - 0.5) * 0.1;
      if (beatBurst && Math.random() < 0.3) {
        const cx = canvas.width / 2;
        const cy = canvas.height / 2;
        const angle = Math.atan2(p.y - cy, p.x - cx);
        p.vx += Math.cos(angle) * spectralFlux * 2;
        p.vy += Math.sin(angle) * spectralFlux * 2;
      }
      p.vx *= 0.97; p.vy *= 0.97;
      p.x += p.vx * speed * (1 + highLevel * 0.5);
      p.y += p.vy * speed * (1 + highLevel * 0.5);
      if (p.x < -10) p.x = canvas.width + 10;
      if (p.x > canvas.width + 10) p.x = -10;
      if (p.y < -10) p.y = canvas.height + 10;
      if (p.y > canvas.height + 10) p.y = -10;
      p.life += 1;
      if (p.life > p.maxLife) {
        p.life = 0;
        p.x = Math.random() * canvas.width;
        p.y = Math.random() * canvas.height;
      }
      const lr = p.life / p.maxLife;
      const opacity = p.opacity * (lr < 0.1 ? lr * 10 : lr > 0.9 ? (1 - lr) * 10 : 1);
      const glowR = p.size * (1 + bassLevel * 2);
      const grd = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, glowR * 3);
      grd.addColorStop(0, `hsla(${primaryHsl}, ${opacity.toFixed(2)})`);
      grd.addColorStop(1, `hsla(${primaryHsl}, 0)`);
      ctx.fillStyle = grd;
      ctx.beginPath(); ctx.arc(p.x, p.y, glowR * 3, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = `hsla(${primaryHsl}, ${Math.min(1, opacity * 2).toFixed(2)})`;
      ctx.beginPath(); ctx.arc(p.x, p.y, glowR, 0, Math.PI * 2); ctx.fill();
    });
  };

  // ── Spectrum bars ─────────────────────────────────────────────────────────
  const drawSpectrum = (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) => {
    const { frequencyData } = analysisData;
    const barCount = 64;
    const barW = canvas.width / barCount;
    const maxH = canvas.height * 0.13;
    for (let i = 0; i < barCount; i++) {
      const v = frequencyData[Math.floor(i * frequencyData.length / barCount)] / 255;
      const h = v * maxH;
      const hue = 213 + i * 1.5;
      const grad = ctx.createLinearGradient(0, canvas.height - h, 0, canvas.height);
      grad.addColorStop(0, `hsla(${hue}, 90%, 60%, 0.75)`);
      grad.addColorStop(1, `hsla(${hue}, 90%, 40%, 0.18)`);
      ctx.fillStyle = grad;
      ctx.fillRect(i * barW, canvas.height - h, barW - 1, h);
    }
  };

  // ── Kinetic typography with per-word highlighting ─────────────────────────
  const drawLyrics = (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, frame: number) => {
    if (!currentLyric) return;

    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const { bassLevel, spectralFlux } = analysisData;
    const words = currentLyric.words ?? [];
    const primaryHsl = hexToHsl(style.particleConfig.colorPrimary);
    const accentHsl = hexToHsl(style.particleConfig.colorAccent);

    ctx.save();
    const beatScale = 1 + spectralFlux * 0.055;
    ctx.translate(cx, cy); ctx.scale(beatScale, beatScale); ctx.translate(-cx, -cy);
    ctx.textAlign = 'center';

    const baseFontSize = Math.floor(canvas.width * 0.048);

    if (style.typographyEffect === 'glow' || style.typographyEffect === 'chromatic') {
      // ── WORD-BY-WORD highlight mode ────────────────────────────────────────
      if (words.length > 0 && activeWordIndex >= 0) {
        // Render each word individually with sub-frame highlight
        ctx.font = `900 ${baseFontSize}px 'Poppins', sans-serif`;
        const totalText = words.map(w => w.text).join(' ');
        const totalWidth = ctx.measureText(totalText).width;
        let xCursor = cx - totalWidth / 2;

        words.forEach((word, wi) => {
          const wordWidth = ctx.measureText(word.text).width;
          const spaceWidth = wi < words.length - 1 ? ctx.measureText(' ').width : 0;
          const wordCx = xCursor + wordWidth / 2;

          const isActive = wi === activeWordIndex;
          const isPast = wi < activeWordIndex;
          const progress = isActive ? wordProgress : 0;

          // Chromatic aberration on active word
          if (style.typographyEffect === 'chromatic' && isActive) {
            const offset = (1 + bassLevel * 3) * progress;
            ctx.fillStyle = `rgba(255, 0, 100, 0.35)`;
            ctx.fillText(word.text, wordCx - offset, cy - offset);
            ctx.fillStyle = `rgba(0, 255, 255, 0.35)`;
            ctx.fillText(word.text, wordCx + offset, cy + offset);
          }

          if (isActive) {
            // Active word: full brightness + neon glow + slight scale
            const scale = 1 + progress * 0.08;
            ctx.save();
            ctx.translate(wordCx, cy);
            ctx.scale(scale, scale);
            ctx.translate(-wordCx, -cy);
            ctx.shadowColor = `hsl(${primaryHsl})`;
            ctx.shadowBlur = 18 + bassLevel * 25 + progress * 12;
            ctx.fillStyle = `rgba(255, 255, 255, ${0.85 + progress * 0.15})`;
            ctx.fillText(word.text, wordCx, cy);
            ctx.shadowBlur = 0;
            ctx.restore();
          } else if (isPast) {
            // Past words: slightly dimmed teal
            ctx.shadowColor = `hsl(${accentHsl})`;
            ctx.shadowBlur = 4;
            ctx.fillStyle = `hsla(${accentHsl}, 0.6)`;
            ctx.fillText(word.text, wordCx, cy);
            ctx.shadowBlur = 0;
          } else {
            // Upcoming words: ghost
            ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
            ctx.fillText(word.text, wordCx, cy);
          }

          xCursor += wordWidth + spaceWidth;
        });

      } else {
        // Full-line fallback (no word data)
        if (style.typographyEffect === 'chromatic') {
          const offset = bassLevel * 3;
          ctx.font = `900 ${baseFontSize}px 'Poppins', sans-serif`;
          ctx.fillStyle = 'rgba(255, 0, 100, 0.35)';
          ctx.fillText(currentLyric.text, cx - offset, cy - offset);
          ctx.fillStyle = 'rgba(0, 255, 255, 0.35)';
          ctx.fillText(currentLyric.text, cx + offset, cy + offset);
        }
        ctx.font = `900 ${baseFontSize}px 'Poppins', sans-serif`;
        ctx.shadowColor = `hsl(${primaryHsl})`;
        ctx.shadowBlur = 18 + bassLevel * 28;
        ctx.fillStyle = `rgba(255, 255, 255, ${0.7 + bassLevel * 0.3})`;
        ctx.fillText(currentLyric.text, cx, cy);
        ctx.shadowBlur = 0;
      }

    } else if (style.typographyEffect === 'wave') {
      ctx.font = `900 ${baseFontSize}px 'Poppins', sans-serif`;
      const letters = currentLyric.text.split('');
      const totalWidth = ctx.measureText(currentLyric.text).width;
      let xPos = cx - totalWidth / 2;
      letters.forEach((letter, i) => {
        const wave = Math.sin(frame * 0.08 + i * 0.5) * 7 * (bassLevel + 0.3);
        const hue = 213 + i * 8;
        ctx.fillStyle = `hsl(${hue}, 90%, 70%)`;
        ctx.shadowColor = `hsl(${hue}, 90%, 60%)`;
        ctx.shadowBlur = 14;
        ctx.fillText(letter, xPos, cy + wave);
        xPos += ctx.measureText(letter).width;
      });
      ctx.shadowBlur = 0;

    } else if (style.typographyEffect === 'zoom') {
      const pulse = 1 + bassLevel * 0.07;
      const fs = Math.floor(baseFontSize * pulse);
      ctx.font = `900 ${fs}px 'Poppins', sans-serif`;
      ctx.fillStyle = `hsl(${primaryHsl})`;
      ctx.shadowColor = `hsl(${accentHsl})`;
      ctx.shadowBlur = 28 + bassLevel * 38;
      ctx.fillText(currentLyric.text, cx, cy);
      ctx.shadowBlur = 0;
    }

    // Next lyric ghost
    if (nextLyric) {
      ctx.font = `500 ${Math.floor(baseFontSize * 0.48)}px 'Poppins', sans-serif`;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.shadowBlur = 0;
      ctx.fillText(nextLyric.text, cx, cy + baseFontSize * 0.85);
    }

    ctx.restore();
  };

  // ── HUD overlay ───────────────────────────────────────────────────────────
  const drawHUDOverlay = (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, frame: number) => {
    const s = 20; const m = 12;
    ctx.strokeStyle = 'rgba(11, 132, 243, 0.5)';
    ctx.lineWidth = 1.5;
    [[m, m], [canvas.width - m, m], [m, canvas.height - m], [canvas.width - m, canvas.height - m]].forEach(([x, y], qi) => {
      ctx.beginPath();
      const hf = qi % 2 === 1 ? -1 : 1;
      const vf = qi >= 2 ? -1 : 1;
      ctx.moveTo(x, y + s * vf); ctx.lineTo(x, y); ctx.lineTo(x + s * hf, y);
      ctx.stroke();
    });

    ctx.font = '500 10px "JetBrains Mono", monospace';
    ctx.fillStyle = 'rgba(11, 132, 243, 0.65)';
    ctx.textAlign = 'left';
    const gpuLabel = useGPU ? `GPU·${gpuState.particleCount.toLocaleString()}px` : `CPU·${style.particleConfig.count}px`;
    ctx.fillText(`FRAME ${frame.toString().padStart(5, '0')} · ${gpuLabel}`, m + s + 8, m + 4);

    const mins = Math.floor(currentTime / 60);
    const secs = (currentTime % 60).toFixed(2);
    ctx.textAlign = 'right';
    ctx.fillText(`${mins.toString().padStart(2, '0')}:${secs.padStart(5, '0')}`, canvas.width - m - s - 8, m + 4);

    if (useGPU) {
      ctx.textAlign = 'left';
      ctx.fillStyle = 'rgba(0, 228, 255, 0.5)';
      ctx.fillText(`WGPU·${gpuState.computeTime.toFixed(1)}ms`, m + s + 8, canvas.height - m - 2);
    }

    // Scan line
    const scanY = (frame * 2) % canvas.height;
    const scanGrad = ctx.createLinearGradient(0, scanY - 4, 0, scanY + 4);
    scanGrad.addColorStop(0, 'transparent');
    scanGrad.addColorStop(0.5, 'rgba(11, 132, 243, 0.07)');
    scanGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = scanGrad;
    ctx.fillRect(0, scanY - 4, canvas.width, 8);
  };

  // ── Main render loop ──────────────────────────────────────────────────────
  const draw = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    frameRef.current += 1;
    const frame = frameRef.current;

    // Run WebGPU compute pass if active
    if (useGPU && gpuState.active) {
      const result = await computeGPU(
        {
          bassLevel: analysisData.bassLevel,
          midLevel: analysisData.midLevel,
          highLevel: analysisData.highLevel,
          spectralFlux: analysisData.spectralFlux,
        },
        canvas.width,
        canvas.height,
      );
      if (result) gpuParticleDataRef.current = result;
    }

    drawBackground(ctx, canvas, frame);
    if (useGPU && gpuState.active) {
      drawGPUParticles(ctx);
    } else {
      drawCPUParticles(ctx, canvas);
    }
    drawSpectrum(ctx, canvas);
    drawLyrics(ctx, canvas, frame);
    drawHUDOverlay(ctx, canvas, frame);

    rafRef.current = requestAnimationFrame(draw);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analysisData, style, currentLyric, nextLyric, currentTime, activeWordIndex, wordProgress, useGPU, gpuState]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas && !useGPU) initCPUParticles(canvas);
  }, [style, useGPU, initCPUParticles]);

  useEffect(() => {
    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, [draw]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const observer = new ResizeObserver(() => {
      const parent = canvas.parentElement;
      if (parent) {
        canvas.width = parent.clientWidth;
        canvas.height = parent.clientHeight;
        if (!useGPU) initCPUParticles(canvas);
      }
    });
    const parent = canvas.parentElement;
    if (parent) {
      canvas.width = parent.clientWidth;
      canvas.height = parent.clientHeight;
      observer.observe(parent);
    }
    return () => observer.disconnect();
  }, [initCPUParticles, useGPU]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full block"
      style={{ imageRendering: 'pixelated' }}
    />
  );
}
