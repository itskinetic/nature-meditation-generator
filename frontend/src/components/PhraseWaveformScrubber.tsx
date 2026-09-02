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

  // Sliced & high-resolution resampled peaks for this phrase
  const displayPeaks = useMemo(() => {
    if (!peaks || peaks.length === 0 || totalDuration <= 0) return [];

    const startRatio = Math.max(0, Math.min(1, segment.start_time / totalDuration));
    const endRatio = Math.max(0, Math.min(1, segment.end_time / totalDuration));
    const startIdx = Math.floor(startRatio * peaks.length);
    const endIdx = Math.ceil(endRatio * peaks.length);
    
    // Slice raw peaks belonging to this phrase
    const rawSlice = peaks.slice(startIdx, Math.max(startIdx + 4, endIdx));
    if (rawSlice.length === 0) return [];

    // Target between 60 and 90 bars for studio-grade density matching waveform UI
    const targetBars = Math.min(90, Math.max(48, Math.round(segDuration * 12)));

    // Smooth interpolation across peaks
    const resampled: number[] = [];
    for (let i = 0; i < targetBars; i++) {
      const t = (i / (targetBars - 1)) * (rawSlice.length - 1);
      const low = Math.floor(t);
      const high = Math.min(rawSlice.length - 1, Math.ceil(t));
      const frac = t - low;
      const val = (rawSlice[low] || 0) * (1 - frac) + (rawSlice[high] || 0) * frac;
      resampled.push(val);
    }

    // Local Auto-Gain Normalization:
    // Ensures speech bursts pop as tall spikes while background silence stays at baseline
    const maxVal = Math.max(0.02, ...resampled);
    return resampled.map((v) => {
      const norm = Math.min(1, Math.max(0, v / maxVal));
      // Dynamic power curve: lifts speech volume while keeping silent pauses flat
      return Math.pow(norm, 0.75);
    });
  }, [peaks, segment.start_time, segment.end_time, segDuration, totalDuration]);

  // Draw waveform on canvas (Matching Image 2 style: centered symmetrical bars & dashed playhead)
  const drawWaveform = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const width = container.clientWidth;
    const height = 36; // Increased from 24 to 36 for dramatic vertical amplitude

    if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
      canvas.width = width * dpr;
      canvas.height = height * dpr;
    }

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    const centerY = height / 2;

    // Draw subtle horizontal center baseline
    ctx.strokeStyle = isDark ? 'rgba(120, 113, 108, 0.25)' : 'rgba(214, 211, 209, 0.6)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, centerY);
    ctx.lineTo(width, centerY);
    ctx.stroke();

    if (displayPeaks.length === 0) {
      ctx.restore();
      return;
    }

    // Playback progress ratio within this segment
    let progressRatio = 0;
    if (currentTime >= segment.start_time) {
      progressRatio = Math.min(1, (currentTime - segment.start_time) / segDuration);
    }
    const currentPixel = progressRatio * width;

    const numBars = displayPeaks.length;
    const step = width / numBars;
    const barWidth = Math.max(1.8, step - 1.2);

    for (let i = 0; i < numBars; i++) {
      const x = i * step + (step - barWidth) / 2;
      const peakVal = displayPeaks[i];
      // Max height up to 88% of canvas height for clear speech spikes
      const barHeight = Math.max(2.5, peakVal * (height * 0.88));
      const top = centerY - barHeight / 2;

      const hasPlayed = isActive && x <= currentPixel;

      if (hasPlayed) {
        ctx.fillStyle = isDark ? '#f59e0b' : '#d97706'; // Amber played audio
      } else if (isActive) {
        ctx.fillStyle = isDark ? '#a8a29e' : '#78716c'; // Active phrase unplayed speech
      } else {
        ctx.fillStyle = isDark ? '#57534e' : '#a8a29e'; // Inactive card speech
      }

      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(x, top, barWidth, barHeight, 1.2);
      } else {
        ctx.rect(x, top, barWidth, barHeight);
      }
      ctx.fill();
    }

    // Draw dashed playhead line (Matching Image 2 dashed vertical line)
    if (isActive && progressRatio > 0 && progressRatio < 1) {
      ctx.strokeStyle = isDark ? '#fbbf24' : '#d97706'; // Amber dashed playhead
      ctx.lineWidth = 1.5;
      ctx.setLineDash([3, 2.5]);
      ctx.beginPath();
      ctx.moveTo(currentPixel, 0);
      ctx.lineTo(currentPixel, height);
      ctx.stroke();
      ctx.setLineDash([]);

      // Top playhead marker dot
      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      ctx.arc(currentPixel, 3.5, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw dashed hover preview line
    if (hoverTime !== null && hoverTime >= segment.start_time && hoverTime <= segment.end_time) {
      const hoverRatio = (hoverTime - segment.start_time) / segDuration;
      const hoverX = hoverRatio * width;
      ctx.strokeStyle = isDark ? '#38bdf8' : '#0284c7';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([3, 2]);
      ctx.beginPath();
      ctx.moveTo(hoverX, 0);
      ctx.lineTo(hoverX, height);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    ctx.restore();
  }, [displayPeaks, currentTime, segment.start_time, segment.end_time, segDuration, isActive, isDark, hoverTime]);

  useEffect(() => {
    drawWaveform();
  }, [drawWaveform]);

  useEffect(() => {
    const handleResize = () => drawWaveform();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [drawWaveform]);

  // Click to scrub audio within phrase
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
      className={`relative w-full h-9 rounded-xl px-2 py-1 flex items-center transition-all cursor-crosshair select-none ${
        isActive
          ? 'bg-amber-500/10 dark:bg-amber-950/40 border border-amber-500/40 shadow-2xs'
          : 'bg-stone-100/90 dark:bg-stone-900/80 border border-stone-200/80 dark:border-stone-800 hover:border-amber-400/60'
      }`}
      title={
        hoverTime !== null
          ? `Click to scrub to ${formatSecs(hoverTime)}`
          : 'Speech Waveform: Click anywhere to scrub audio'
      }
    >
      <canvas
        ref={canvasRef}
        className="w-full h-full block"
        style={{ height: '36px' }}
      />

      {/* Live hover timecode tooltip */}
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
