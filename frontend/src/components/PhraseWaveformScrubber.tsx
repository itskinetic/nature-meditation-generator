import React, { useRef, useEffect, useCallback, useState, useMemo } from 'react';
import { AudioSegment, AudioSilenceInterval } from '../types';

interface PhraseWaveformScrubberProps {
  segment: AudioSegment;
  peaks: number[];
  totalDuration: number;
  currentTime: number;
  isActive: boolean;
  isPlaying: boolean;
  isDark?: boolean;
  silences?: AudioSilenceInterval[];
  onSeek: (time: number) => void;
}

export const PhraseWaveformScrubber: React.FC<PhraseWaveformScrubberProps> = ({
  segment,
  peaks,
  totalDuration,
  currentTime,
  isActive,
  isPlaying,
  isDark = false,
  silences = [],
  onSeek,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [isHovered, setIsHovered] = useState<boolean>(false);

  const segDuration = Math.max(0.1, segment.end_time - segment.start_time);

  // Sliced peaks for this phrase
  const slicedPeaks = useMemo(() => {
    if (!peaks || peaks.length === 0 || totalDuration <= 0) return [];
    const startRatio = Math.max(0, Math.min(1, segment.start_time / totalDuration));
    const endRatio = Math.max(0, Math.min(1, segment.end_time / totalDuration));
    const startIdx = Math.floor(startRatio * peaks.length);
    const endIdx = Math.ceil(endRatio * peaks.length);
    const slice = peaks.slice(startIdx, Math.max(startIdx + 12, endIdx));
    return slice;
  }, [peaks, segment.start_time, segment.end_time, totalDuration]);

  // Draw waveform on canvas
  const drawWaveform = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const width = container.clientWidth;
    const height = 24;

    if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
      canvas.width = width * dpr;
      canvas.height = height * dpr;
    }

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    if (slicedPeaks.length === 0) {
      // Fallback empty line
      ctx.fillStyle = isDark ? '#334155' : '#cbd5e1';
      ctx.fillRect(0, height / 2 - 1, width, 2);
      ctx.restore();
      return;
    }

    // Playback progress ratio within this segment
    let progressRatio = 0;
    if (currentTime >= segment.start_time) {
      progressRatio = Math.min(1, (currentTime - segment.start_time) / segDuration);
    }

    const numBars = Math.min(slicedPeaks.length, Math.floor(width / 3.5));
    const barWidth = Math.max(1.5, (width / numBars) - 1.2);
    const centerY = height / 2;

    // Resample sliced peaks to match available visual width
    for (let i = 0; i < numBars; i++) {
      const peakIdx = Math.floor((i / numBars) * slicedPeaks.length);
      const peakVal = slicedPeaks[peakIdx] || 0.05;
      const barHeight = Math.max(3, peakVal * (height - 4));
      const x = i * (width / numBars);

      const barProgress = i / numBars;
      const hasPlayed = isActive && barProgress <= progressRatio;

      if (hasPlayed) {
        ctx.fillStyle = '#f59e0b'; // Amber 500 played
      } else if (isActive) {
        ctx.fillStyle = isDark ? '#78716c' : '#a8a29e'; // Neutral active unplayed
      } else {
        ctx.fillStyle = isDark ? '#44403c' : '#d6d3d1'; // Inactive card bars
      }

      const top = centerY - barHeight / 2;
      ctx.beginPath();
      ctx.roundRect(x, top, barWidth, barHeight, 1);
      ctx.fill();
    }

    // Draw playhead vertical line if active & within this card
    if (isActive && progressRatio > 0 && progressRatio < 1) {
      const playheadX = progressRatio * width;
      ctx.strokeStyle = '#d97706'; // Amber 600
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(playheadX, 0);
      ctx.lineTo(playheadX, height);
      ctx.stroke();

      // Playhead top dot
      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      ctx.arc(playheadX, 3, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw hover scrub preview line
    if (hoverTime !== null && hoverTime >= segment.start_time && hoverTime <= segment.end_time) {
      const hoverRatio = (hoverTime - segment.start_time) / segDuration;
      const hoverX = hoverRatio * width;
      ctx.strokeStyle = isDark ? '#38bdf8' : '#0284c7';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([2, 2]);
      ctx.beginPath();
      ctx.moveTo(hoverX, 0);
      ctx.lineTo(hoverX, height);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    ctx.restore();
  }, [slicedPeaks, currentTime, segment.start_time, segment.end_time, segDuration, isActive, isDark, hoverTime]);

  useEffect(() => {
    drawWaveform();
  }, [drawWaveform]);

  // Handle Resize
  useEffect(() => {
    const handleResize = () => drawWaveform();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [drawWaveform]);

  // Click / Drag to scrub within phrase
  const handleScrub = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const clickX = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
    const ratio = clickX / rect.width;
    const targetTime = Number((segment.start_time + ratio * segDuration).toFixed(2));
    onSeek(targetTime);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const clickX = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
    const ratio = clickX / rect.width;
    const time = Number((segment.start_time + ratio * segDuration).toFixed(2));
    setHoverTime(time);
  };

  const formatSecs = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = (secs % 60).toFixed(1);
    return `${m}:${parseFloat(s) < 10 ? '0' : ''}${s}`;
  };

  return (
    <div
      ref={containerRef}
      onClick={handleScrub}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
        setHoverTime(null);
      }}
      className={`relative w-full h-6 rounded-lg px-1.5 py-0.5 flex items-center transition-all cursor-crosshair select-none ${
        isActive
          ? 'bg-amber-500/10 dark:bg-amber-950/40 border border-amber-500/30'
          : 'bg-stone-100 dark:bg-stone-900/60 border border-stone-200/60 dark:border-stone-800/60 hover:border-amber-400/50'
      }`}
      title={
        hoverTime !== null
          ? `Click to scrub to ${formatSecs(hoverTime)}`
          : 'Mini Waveform: Click anywhere to scrub audio'
      }
    >
      <canvas
        ref={canvasRef}
        className="w-full h-full block"
        style={{ height: '20px' }}
      />

      {/* Hover timestamp tooltip */}
      {isHovered && hoverTime !== null && (
        <div
          className="absolute -top-6 px-1.5 py-0.5 rounded bg-stone-900 text-stone-100 text-[10px] font-mono font-bold pointer-events-none shadow-md whitespace-nowrap z-20"
          style={{
            left: `${Math.max(10, Math.min(90, ((hoverTime - segment.start_time) / segDuration) * 100))}%`,
            transform: 'translateX(-50%)',
          }}
        >
          {formatSecs(hoverTime)}
        </div>
      )}
    </div>
  );
};
