import { useState, useCallback } from 'react';
import type { RenderJob } from '@/types';

export function useRenderPipeline() {
  const [job, setJob] = useState<RenderJob>({
    id: '',
    status: 'idle',
    progress: 0,
    currentFrame: 0,
    totalFrames: 0,
    estimatedTime: 0,
    fps: 0,
  });

  const startRender = useCallback((durationSeconds: number, resolution: string, fps: number) => {
    const totalFrames = Math.floor(durationSeconds * fps);
    const id = `render-${Date.now()}`;

    setJob({
      id,
      status: 'analyzing',
      progress: 0,
      currentFrame: 0,
      totalFrames,
      estimatedTime: durationSeconds * 1.2,
      fps: 0,
    });

    console.log('Starting simulated render pipeline:', { id, totalFrames, resolution, fps });

    // Simulate multi-phase rendering pipeline
    setTimeout(() => {
      setJob(prev => ({ ...prev, status: 'rendering', progress: 5 }));

      const startTime = performance.now();
      let frame = 0;
      const targetRenderFps = fps * 3; // 3x real-time simulation
      const interval = 1000 / targetRenderFps;

      const renderInterval = setInterval(() => {
        frame += 1;
        const progress = Math.min(95, (frame / totalFrames) * 90 + 5);
        const elapsed = (performance.now() - startTime) / 1000;
        const currentRenderFps = elapsed > 0 ? Math.round(frame / elapsed) : 0;
        const remaining = elapsed > 0 ? (totalFrames - frame) / (frame / elapsed) : durationSeconds;

        setJob(prev => ({
          ...prev,
          status: frame < totalFrames * 0.85 ? 'rendering' : 'encoding',
          progress,
          currentFrame: frame,
          estimatedTime: remaining,
          fps: currentRenderFps,
        }));

        if (frame >= totalFrames) {
          clearInterval(renderInterval);
          setTimeout(() => {
            setJob(prev => ({ ...prev, status: 'complete', progress: 100, estimatedTime: 0 }));
          }, 800);
        }
      }, interval);
    }, 1200);
  }, []);

  const cancelRender = useCallback(() => {
    setJob(prev => ({ ...prev, status: 'idle', progress: 0 }));
  }, []);

  const resetRender = useCallback(() => {
    setJob({
      id: '',
      status: 'idle',
      progress: 0,
      currentFrame: 0,
      totalFrames: 0,
      estimatedTime: 0,
      fps: 0,
    });
  }, []);

  return { job, startRender, cancelRender, resetRender };
}
