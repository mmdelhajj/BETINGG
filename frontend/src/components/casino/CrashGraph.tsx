'use client';

import React, { useRef, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CrashStatus = 'waiting' | 'running' | 'crashed';

export interface CrashGraphProps {
  multiplier: number;
  status: CrashStatus;
  crashPoint?: number;
  className?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const COLORS = {
  background: '#0D1117',
  grid: '#1C2128',
  gridLine: '#21262D',
  axisText: '#8B949E',
  curveRunning: '#10B981',
  curveRunningGlow: 'rgba(16, 185, 129, 0.3)',
  curveCrashed: '#EF4444',
  curveCrashedGlow: 'rgba(239, 68, 68, 0.3)',
  multiplierText: '#E6EDF3',
  waitingText: '#8B949E',
  crashedBg: 'rgba(239, 68, 68, 0.08)',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function CrashGraph({
  multiplier,
  status,
  crashPoint,
  className,
}: CrashGraphProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number>(0);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Handle HiDPI displays
    const dpr = window.devicePixelRatio || 1;
    const rect = container.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;
    const padding = { top: 20, right: 20, bottom: 40, left: 60 };
    const graphWidth = width - padding.left - padding.right;
    const graphHeight = height - padding.top - padding.bottom;

    // Clear canvas
    ctx.fillStyle = COLORS.background;
    ctx.fillRect(0, 0, width, height);

    // Crashed background tint
    if (status === 'crashed') {
      ctx.fillStyle = COLORS.crashedBg;
      ctx.fillRect(0, 0, width, height);
    }

    // Draw grid lines
    const maxMultiplier = Math.max(multiplier * 1.3, 2);
    const gridSteps = calculateGridSteps(maxMultiplier);

    ctx.strokeStyle = COLORS.gridLine;
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);

    // Horizontal grid lines
    for (let step = 1; step <= maxMultiplier; step += gridSteps) {
      const y = padding.top + graphHeight - ((step - 1) / (maxMultiplier - 1)) * graphHeight;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(width - padding.right, y);
      ctx.stroke();

      // Y axis labels
      ctx.fillStyle = COLORS.axisText;
      ctx.font = '11px JetBrains Mono, monospace';
      ctx.textAlign = 'right';
      ctx.fillText(`${step.toFixed(1)}x`, padding.left - 8, y + 4);
    }

    // Vertical grid lines (time-based)
    const timeSteps = 5;
    for (let i = 0; i <= timeSteps; i++) {
      const x = padding.left + (i / timeSteps) * graphWidth;
      ctx.beginPath();
      ctx.moveTo(x, padding.top);
      ctx.lineTo(x, height - padding.bottom);
      ctx.stroke();
    }

    ctx.setLineDash([]);

    // Draw curve if running or crashed
    if (status !== 'waiting' && multiplier > 1) {
      const isRunning = status === 'running';
      const curveColor = isRunning ? COLORS.curveRunning : COLORS.curveCrashed;
      const glowColor = isRunning ? COLORS.curveRunningGlow : COLORS.curveCrashedGlow;

      // Number of points on the curve
      const points = 200;
      const xScale = graphWidth / points;

      // Draw glow effect
      ctx.beginPath();
      ctx.moveTo(padding.left, padding.top + graphHeight);

      for (let i = 0; i <= points; i++) {
        const t = i / points;
        // Exponential curve: mult = e^(k*t) where k determines how fast it grows
        const displayMult = multiplier;
        const k = Math.log(displayMult);
        const m = Math.exp(k * t);
        const x = padding.left + i * xScale;
        const y =
          padding.top +
          graphHeight -
          ((m - 1) / (maxMultiplier - 1)) * graphHeight;
        ctx.lineTo(x, Math.max(y, padding.top));
      }

      // Close path for fill
      const lastX = padding.left + points * xScale;
      ctx.lineTo(lastX, padding.top + graphHeight);
      ctx.closePath();

      // Gradient fill under curve
      const gradient = ctx.createLinearGradient(
        0,
        padding.top,
        0,
        padding.top + graphHeight
      );
      gradient.addColorStop(0, glowColor);
      gradient.addColorStop(1, 'transparent');
      ctx.fillStyle = gradient;
      ctx.fill();

      // Draw the curve line
      ctx.beginPath();
      ctx.moveTo(padding.left, padding.top + graphHeight);

      for (let i = 0; i <= points; i++) {
        const t = i / points;
        const displayMult = multiplier;
        const k = Math.log(displayMult);
        const m = Math.exp(k * t);
        const x = padding.left + i * xScale;
        const y =
          padding.top +
          graphHeight -
          ((m - 1) / (maxMultiplier - 1)) * graphHeight;
        ctx.lineTo(x, Math.max(y, padding.top));
      }

      ctx.strokeStyle = curveColor;
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();

      // Draw dot at the end of curve
      const endX = padding.left + points * xScale;
      const endY =
        padding.top +
        graphHeight -
        ((multiplier - 1) / (maxMultiplier - 1)) * graphHeight;

      // Pulsing glow circle
      ctx.beginPath();
      ctx.arc(endX, Math.max(endY, padding.top), 8, 0, Math.PI * 2);
      ctx.fillStyle = glowColor;
      ctx.fill();

      // Solid dot
      ctx.beginPath();
      ctx.arc(endX, Math.max(endY, padding.top), 4, 0, Math.PI * 2);
      ctx.fillStyle = curveColor;
      ctx.fill();
    }

    // Draw axes
    ctx.strokeStyle = COLORS.gridLine;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padding.left, padding.top);
    ctx.lineTo(padding.left, height - padding.bottom);
    ctx.lineTo(width - padding.right, height - padding.bottom);
    ctx.stroke();

    // Draw center multiplier text
    const centerX = width / 2;
    const centerY = height / 2;

    if (status === 'waiting') {
      ctx.fillStyle = COLORS.waitingText;
      ctx.font = 'bold 18px Inter, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('STARTING...', centerX, centerY);

      // Loading dots animation
      const dotCount = 3;
      const dotRadius = 3;
      const dotSpacing = 16;
      const dotY = centerY + 28;
      const time = Date.now() / 600;

      for (let i = 0; i < dotCount; i++) {
        const alpha = 0.3 + 0.7 * Math.abs(Math.sin(time + i * 0.8));
        ctx.beginPath();
        ctx.arc(
          centerX + (i - 1) * dotSpacing,
          dotY,
          dotRadius,
          0,
          Math.PI * 2
        );
        ctx.fillStyle = `rgba(139, 148, 158, ${alpha})`;
        ctx.fill();
      }
    } else if (status === 'crashed') {
      // Crashed label
      ctx.fillStyle = COLORS.curveCrashed;
      ctx.font = 'bold 14px Inter, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('CRASHED', centerX, centerY - 28);

      // Crash point
      ctx.fillStyle = COLORS.curveCrashed;
      ctx.font = 'bold 48px JetBrains Mono, monospace';
      ctx.fillText(`${(crashPoint || multiplier).toFixed(2)}x`, centerX, centerY + 12);
    }
  }, [multiplier, status, crashPoint]);

  // Animation loop
  useEffect(() => {
    const animate = () => {
      draw();
      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [draw]);

  // Handle resize
  useEffect(() => {
    const handleResize = () => draw();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [draw]);

  return (
    <div className={cn('relative', className)}>
      <div
        ref={containerRef}
        className="w-full h-full min-h-[300px] rounded-card overflow-hidden border border-[#30363D]"
      >
        <canvas ref={canvasRef} className="w-full h-full" />
      </div>

      {/* Multiplier Overlay for running state */}
      {status === 'running' && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center">
            <div
              className="text-6xl md:text-7xl font-bold font-mono tabular-nums"
              style={{
                color: multiplier >= 2 ? COLORS.curveRunning : COLORS.multiplierText,
                textShadow:
                  multiplier >= 2
                    ? '0 0 30px rgba(16, 185, 129, 0.4)'
                    : 'none',
              }}
            >
              {multiplier.toFixed(2)}x
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function calculateGridSteps(maxMultiplier: number): number {
  if (maxMultiplier <= 2) return 0.25;
  if (maxMultiplier <= 5) return 0.5;
  if (maxMultiplier <= 10) return 1;
  if (maxMultiplier <= 50) return 5;
  if (maxMultiplier <= 100) return 10;
  return 50;
}
