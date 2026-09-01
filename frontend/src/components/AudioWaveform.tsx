import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Play, Pause, RotateCcw, Volume2, VolumeX, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
import { AudioSegment } from '../types';

interface AudioWaveformProps {
  peaks: number[];
  duration: number;
  currentTime: number;
  isPlaying: boolean;
  onSeek: (time: number) => void;
  onTogglePlay: () => void;
  segments?: AudioSegment[];
  activeSegmentId?: string | null;
  audioUrl?: string;
  isDark?: boolean;
}

export const AudioWaveform: React.FC<AudioWaveformProps> = ({
  peaks,
  duration,
  currentTime,
  isPlaying,
  onSeek,
  onTogglePlay,
  segments = [],
  activeSegmentId = null,
  isDark = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [playbackRate, setPlaybackRate] = useState<number>(1.0);

  // Format time mm:ss or mm:ss.d
  const formatTime = (seconds: number) => {
    if (isNaN(seconds) || seconds < 0) return '00:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 10);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms}`;
  };

  // Render waveform onto canvas
  const drawWaveform = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    if (!peaks || peaks.length === 0 || duration <= 0) {
      // Empty waveform placeholder
      ctx.fillStyle = isDark ? '#334155' : '#cbd5e1';
      ctx.fillRect(0, height / 2 - 1, width, 2);
      return;
    }

    const progressRatio = Math.min(1, Math.max(0, currentTime / duration));
    const currentPixel = progressRatio * width;

    // Draw segment background regions (speech vs pause)
    segments.forEach((seg, i) => {
      const startX = (seg.start_time / duration) * width;
      const endX = (seg.end_time / duration) * width;
      const segWidth = Math.max(1, endX - startX);

      const isActive = seg.id === activeSegmentId;

      // Subtle background alternating tint
      if (isActive) {
        ctx.fillStyle = isDark ? 'rgba(217, 119, 6, 0.22)' : 'rgba(245, 158, 11, 0.25)';
        ctx.fillRect(startX, 0, segWidth, height);
      } else if (i % 2 === 0) {
        ctx.fillStyle = isDark ? 'rgba(30, 41, 59, 0.35)' : 'rgba(241, 245, 249, 0.45)';
        ctx.fillRect(startX, 0, segWidth, height);
      }

      // Draw segment split delimiter line
      const splitX = (seg.split_time / duration) * width;
      ctx.strokeStyle = isDark ? 'rgba(148, 163, 184, 0.3)' : 'rgba(203, 213, 225, 0.7)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.setLineDash([3, 3]);
      ctx.moveTo(splitX, 0);
      ctx.lineTo(splitX, height);
      ctx.stroke();
      ctx.setLineDash([]);
    });

    // Draw waveform bars
    const barWidth = Math.max(1.5, width / peaks.length);
    const gap = 1;
    const usableBarWidth = Math.max(1, barWidth - gap);

    for (let i = 0; i < peaks.length; i++) {
      const x = i * barWidth;
      const peak = peaks[i];
      const barHeight = Math.max(3, peak * (height * 0.85));
      const y = (height - barHeight) / 2;

      const isPlayed = x <= currentPixel;

      if (isPlayed) {
        // Played audio bar color (warm amber gradient)
        ctx.fillStyle = isDark ? '#f59e0b' : '#d97706';
      } else {
        // Unplayed audio bar color
        ctx.fillStyle = isDark ? '#475569' : '#94a3b8';
      }

      // Draw rounded bar
      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(x, y, usableBarWidth, barHeight, 1.5);
      } else {
        ctx.rect(x, y, usableBarWidth, barHeight);
      }
      ctx.fill();
    }

    // Draw playhead line
    ctx.strokeStyle = '#ef4444'; // Red playhead
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(currentPixel, 0);
    ctx.lineTo(currentPixel, height);
    ctx.stroke();

    // Playhead head handle (triangle)
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.moveTo(currentPixel - 5, 0);
    ctx.lineTo(currentPixel + 5, 0);
    ctx.lineTo(currentPixel, 8);
    ctx.closePath();
    ctx.fill();
  }, [peaks, duration, currentTime, segments, activeSegmentId, isDark]);

  // Redraw on canvas resize or state changes
  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;

      const rect = container.getBoundingClientRect();
      const targetWidth = rect.width * zoomLevel;
      canvas.width = targetWidth;
      canvas.height = 120;
      drawWaveform();
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [drawWaveform, zoomLevel]);

  useEffect(() => {
    drawWaveform();
  }, [drawWaveform]);

  // Handle click / drag to seek
  const handleSeekFromEvent = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || duration <= 0) return;
    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, clickX / rect.width));
    const seekTime = ratio * duration;
    onSeek(seekTime);
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDragging(true);
    handleSeekFromEvent(e);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isDragging) {
      handleSeekFromEvent(e);
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  return (
    <div className="flex flex-col gap-2 w-full bg-stone-50 dark:bg-[#12151c] border border-stone-200 dark:border-stone-800 rounded-2xl p-4 transition-colors">
      {/* Waveform Controls Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          {/* Play / Pause button */}
          <button
            type="button"
            onClick={onTogglePlay}
            className="w-10 h-10 rounded-xl bg-amber-500 hover:bg-amber-600 active:scale-95 text-stone-950 flex items-center justify-center font-bold transition-all shadow-sm cursor-pointer"
            title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
          >
            {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
          </button>

          {/* Reset button */}
          <button
            type="button"
            onClick={() => onSeek(0)}
            className="w-8 h-8 rounded-lg bg-stone-200/80 dark:bg-stone-800 hover:bg-stone-300 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 flex items-center justify-center transition-all cursor-pointer"
            title="Restart from beginning"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          {/* Timecode display */}
          <div className="flex items-baseline gap-1.5 ml-2 font-mono text-sm font-semibold">
            <span className="text-amber-600 dark:text-amber-400">{formatTime(currentTime)}</span>
            <span className="text-stone-400">/</span>
            <span className="text-stone-600 dark:text-stone-400">{formatTime(duration)}</span>
          </div>
        </div>

        {/* Zoom & Speed controls */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setZoomLevel((z) => Math.max(1, z - 0.5))}
            disabled={zoomLevel <= 1}
            className="p-1.5 rounded-lg bg-stone-200/60 dark:bg-stone-800/80 hover:bg-stone-300 dark:hover:bg-stone-700 disabled:opacity-40 text-stone-600 dark:text-stone-400 transition-all cursor-pointer"
            title="Zoom Out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setZoomLevel(1)}
            className="px-2 py-1 rounded-lg text-xs font-mono font-medium bg-stone-200/60 dark:bg-stone-800/80 hover:bg-stone-300 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 transition-all cursor-pointer"
            title="Reset Zoom"
          >
            {zoomLevel}x
          </button>
          <button
            type="button"
            onClick={() => setZoomLevel((z) => Math.min(3, z + 0.5))}
            disabled={zoomLevel >= 3}
            className="p-1.5 rounded-lg bg-stone-200/60 dark:bg-stone-800/80 hover:bg-stone-300 dark:hover:bg-stone-700 disabled:opacity-40 text-stone-600 dark:text-stone-400 transition-all cursor-pointer"
            title="Zoom In"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Interactive Waveform Canvas Container */}
      <div
        ref={containerRef}
        className="w-full overflow-x-auto relative rounded-xl bg-white dark:bg-[#0a0c10] border border-stone-200/80 dark:border-stone-800/80 select-none shadow-inner"
        style={{ height: '124px' }}
      >
        <canvas
          ref={canvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          className="cursor-crosshair block"
          style={{ height: '120px' }}
        />
      </div>

      {/* Legend & Segment Count */}
      <div className="flex items-center justify-between text-xs text-stone-500 dark:text-stone-400 px-1">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
            <span>Spoken Phrase</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm border border-dashed border-stone-400 dark:border-stone-600" />
            <span>Silence Midpoint</span>
          </span>
        </div>
        <span>{segments.length} Speech Segments Detected</span>
      </div>
    </div>
  );
};
