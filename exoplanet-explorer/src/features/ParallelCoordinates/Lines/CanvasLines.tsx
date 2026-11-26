import { useEffect, useRef } from 'react';
import * as d3 from 'd3';

import type { DataItem } from '@/types/types.ts';

import { type Dimension } from '../types.ts';

export interface CanvasLinesProps {
  data: DataItem[];
  dimensions: Dimension[];

  xScale: d3.ScalePoint<string>;
  yPos: (d: DataItem, dim: Dimension) => number;

  width: number;
  height: number;
  xOffset?: number;
  yOffset?: number;

  opacity?: number;
  strokeWidth?: number;
  strokeColor?: string;
}

export function CanvasLines({
  data,
  dimensions,
  xScale,
  yPos,
  width,
  height,
  xOffset = 0,
  yOffset = 0,
  opacity = 1.0,
  strokeWidth = 1,
  strokeColor = 'steelblue'
}: CanvasLinesProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    ctx.strokeStyle = strokeColor;
    ctx.globalAlpha = opacity;
    ctx.lineWidth = strokeWidth;

    // Pre-compute x positions to avoid repeated scale lookups in the inner loop
    const xPositions = dimensions.map((dim) => xScale(dim.key) ?? 0);

    let chunkSize = 300;
    let chunkIndex = 0;
    let rafId: number;

    function renderChunk() {
      const startTime = performance.now();
      const end = Math.min(chunkIndex + chunkSize, data.length);

      ctx!.beginPath();
      for (let i = chunkIndex; i < end; i++) {
        const row = data[i];
        dimensions.forEach((dim, idx) => {
          const x = xPositions[idx];
          const y = yPos(row, dim);
          if (idx === 0) {
            ctx!.moveTo(x, y);
          } else {
            ctx!.lineTo(x, y);
          }
        });
      }
      ctx!.stroke();

      chunkIndex = end;
      if (chunkIndex < data.length) {
        const elapsed = Math.max(performance.now() - startTime, 1);
        chunkSize = Math.max(100, Math.min(8000, Math.round((chunkSize * 8) / elapsed)));
        rafId = requestAnimationFrame(renderChunk);
      } else {
        ctx!.globalAlpha = 1;
      }
    }

    renderChunk();

    return () => {
      cancelAnimationFrame(rafId);
      ctx.globalAlpha = 1;
    };
  }, [data, dimensions, xScale, yPos, width, height, opacity, strokeWidth, strokeColor]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        left: xOffset,
        top: yOffset,
        pointerEvents: 'none'
      }}
    />
  );
}
