import { useEffect, useRef } from 'react';
import * as d3 from 'd3';

import { useInactiveColor } from '@/hooks/colors';
import type { CornerPlotRenderMode } from '@/redux/local/localSlice';
import type { Column } from '@/types/types';
import { ACTIVE_COLOR } from '@/utils/constants';

import {
  buildDensityBins,
  type CornerPoint,
  getCellKey,
  getCellRenderMode
} from '../helpers';

const SCATTER_POINT_SIZE = 2;
const SCATTER_RENDER_CHUNK_SIZE = 500;

interface Margin {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

interface Props {
  chartWidth: number;
  chartHeight: number;
  margin: Margin;
  selectedNumericColumns: Column[];
  cellSize: number;
  cellPointsByKey: Map<string, CornerPoint[]>;
  renderMode: CornerPlotRenderMode;
  invertLayout: boolean;
  hasActiveCornerFilter: boolean;
  visiblePointIdSet: Set<number> | undefined;
}

export function CanvasLayer({
  chartWidth,
  chartHeight,
  margin,
  selectedNumericColumns,
  cellSize,
  cellPointsByKey,
  renderMode,
  invertLayout,
  hasActiveCornerFilter,
  visiblePointIdSet
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const inactiveColor = useInactiveColor();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || selectedNumericColumns.length < 2) {
      return;
    }

    const context = canvas.getContext('2d');
    if (!context) {
      return;
    }

    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.floor(chartWidth * dpr);
    canvas.height = Math.floor(chartHeight * dpr);
    canvas.style.width = `${chartWidth}px`;
    canvas.style.height = `${chartHeight}px`;

    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.clearRect(0, 0, chartWidth, chartHeight);
    context.save();
    context.translate(margin.left, margin.top);

    const renderedCells = selectedNumericColumns.flatMap((yColumn, rowIndex) => {
      return selectedNumericColumns
        .map((xColumn, colIndex) => {
          const cellRenderMode = getCellRenderMode(
            rowIndex,
            colIndex,
            renderMode,
            invertLayout
          );

          if (cellRenderMode === undefined) {
            return undefined;
          }
          return {
            renderMode: cellRenderMode,
            xColumn,
            yColumn,
            xCellOffset: colIndex * cellSize,
            yCellOffset: rowIndex * cellSize,
            points: cellPointsByKey.get(getCellKey(xColumn, yColumn)) ?? []
          };
        })
        .filter((cell): cell is NonNullable<typeof cell> => cell !== undefined);
    });

    const scatterCells = renderedCells.filter((cell) => cell.renderMode === 'scatter');
    const densityCells = renderedCells.filter((cell) => cell.renderMode === 'density');
    let rafId: number | undefined;

    if (densityCells.length > 0) {
      densityCells.forEach((cell) => {
        const { points, xCellOffset, yCellOffset } = cell;
        const selectedPoints =
          visiblePointIdSet === undefined
            ? points
            : points.filter((point) => visiblePointIdSet.has(point.id));

        context.save();
        context.beginPath();
        context.rect(xCellOffset, yCellOffset, cellSize, cellSize);
        context.clip();

        const allBins = buildDensityBins(
          points.map((point) => ({ x: point.x, y: point.y })),
          cellSize
        );
        const selectedBins = buildDensityBins(
          selectedPoints.map((point) => ({ x: point.x, y: point.y })),
          cellSize
        );
        const maxCount = d3.max(allBins, (bin) => bin.count) ?? 1;
        const densityScale = d3
          .scaleSequential(d3.interpolateYlOrRd)
          .domain([1, maxCount]);

        allBins.forEach((bin) => {
          context.fillStyle = densityScale(bin.count);
          context.globalAlpha = hasActiveCornerFilter ? 0.18 : 0.88;
          context.fillRect(xCellOffset + bin.x, yCellOffset + bin.y, bin.size, bin.size);
        });

        if (hasActiveCornerFilter) {
          selectedBins.forEach((bin) => {
            context.fillStyle = densityScale(bin.count);
            context.globalAlpha = 0.92;
            context.fillRect(
              xCellOffset + bin.x,
              yCellOffset + bin.y,
              bin.size,
              bin.size
            );
          });
        }

        context.restore();
      });
    }

    if (scatterCells.length === 0) {
      context.restore();
      context.globalAlpha = 1;
      return;
    }

    const maxPointsInAnyCell = d3.max(scatterCells, (cell) => cell.points.length) ?? 0;
    const ctx = context;
    let chunkStart = 0;

    function renderScatterChunk() {
      rafId = undefined;
      const chunkEnd = Math.min(
        chunkStart + SCATTER_RENDER_CHUNK_SIZE,
        maxPointsInAnyCell
      );

      scatterCells.forEach((cell) => {
        const { points, xCellOffset, yCellOffset } = cell;
        const chunk = points.slice(chunkStart, chunkEnd);

        ctx.save();
        ctx.beginPath();
        ctx.rect(xCellOffset, yCellOffset, cellSize, cellSize);
        ctx.clip();

        if (hasActiveCornerFilter) {
          ctx.globalAlpha = 0.6;
          ctx.fillStyle = inactiveColor;
          chunk.forEach((point) => {
            if (visiblePointIdSet?.has(point.id)) {
              return;
            }
            ctx.fillRect(
              xCellOffset + point.x - SCATTER_POINT_SIZE / 2,
              yCellOffset + point.y - SCATTER_POINT_SIZE / 2,
              SCATTER_POINT_SIZE,
              SCATTER_POINT_SIZE
            );
          });
        }

        ctx.globalAlpha = hasActiveCornerFilter ? 0.72 : 0.6;
        ctx.fillStyle = ACTIVE_COLOR;
        chunk.forEach((point) => {
          if (hasActiveCornerFilter && !visiblePointIdSet?.has(point.id)) {
            return;
          }
          ctx.fillRect(
            xCellOffset + point.x - SCATTER_POINT_SIZE / 2,
            yCellOffset + point.y - SCATTER_POINT_SIZE / 2,
            SCATTER_POINT_SIZE,
            SCATTER_POINT_SIZE
          );
        });

        ctx.restore();
      });

      chunkStart = chunkEnd;
      if (chunkStart < maxPointsInAnyCell) {
        rafId = requestAnimationFrame(renderScatterChunk);
      } else {
        ctx.restore();
        ctx.globalAlpha = 1;
      }
    }

    renderScatterChunk();

    return () => {
      if (rafId !== undefined) {
        cancelAnimationFrame(rafId);
        context.restore();
      }
      context.globalAlpha = 1;
    };
  }, [
    cellPointsByKey,
    cellSize,
    chartHeight,
    chartWidth,
    hasActiveCornerFilter,
    inactiveColor,
    margin.left,
    margin.top,
    renderMode,
    invertLayout,
    selectedNumericColumns,
    visiblePointIdSet
  ]);

  return (
    <canvas
      ref={canvasRef}
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
    />
  );
}
