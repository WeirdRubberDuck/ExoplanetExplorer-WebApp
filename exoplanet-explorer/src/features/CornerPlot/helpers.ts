import type { CornerPlotRenderMode } from '@/redux/local/localSlice';
import type { Column, DataItem } from '@/types/types';

import { getNumericValue, type NumericScale } from './util';

export interface CornerPoint {
  id: number;
  xValue: number;
  yValue: number;
  x: number;
  y: number;
}

export interface BrushDraft {
  cellKey: string;
  xColumn: Column;
  yColumn: Column;
  xOffset: number;
  yOffset: number;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  appendToExisting: boolean;
}

export interface ActiveBrush {
  cellKey: string;
  xColumn: Column;
  yColumn: Column;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface MovingBrushDraft {
  brushIndex: number;
  startPlotX: number;
  startPlotY: number;
  originBrush: ActiveBrush;
  dx: number;
  dy: number;
}

export function getCellKey(xColumn: Column, yColumn: Column): string {
  return `${xColumn}-${yColumn}`;
}

export function getCellRenderMode(
  rowIndex: number,
  colIndex: number,
  renderMode: CornerPlotRenderMode,
  invertLayout: boolean
): 'scatter' | 'density' | undefined {
  if (rowIndex === colIndex) {
    return undefined;
  }

  const isPrimaryTriangle = invertLayout ? rowIndex < colIndex : rowIndex > colIndex;
  if (renderMode === 'both') {
    return isPrimaryTriangle ? 'scatter' : 'density';
  }
  return isPrimaryTriangle ? renderMode : undefined;
}

export function clampToCell(value: number, cellSize: number): number {
  return Math.max(0, Math.min(cellSize, value));
}

export function getTranslatedBrush(
  draft: MovingBrushDraft,
  cellSize: number
): ActiveBrush {
  const minDx = -draft.originBrush.minX;
  const maxDx = cellSize - draft.originBrush.maxX;
  const minDy = -draft.originBrush.minY;
  const maxDy = cellSize - draft.originBrush.maxY;

  const clampedDx = Math.max(minDx, Math.min(maxDx, draft.dx));
  const clampedDy = Math.max(minDy, Math.min(maxDy, draft.dy));

  return {
    ...draft.originBrush,
    minX: draft.originBrush.minX + clampedDx,
    maxX: draft.originBrush.maxX + clampedDx,
    minY: draft.originBrush.minY + clampedDy,
    maxY: draft.originBrush.maxY + clampedDy
  };
}

export function getCellPointsFromRows(
  rows: DataItem[],
  xColumn: Column,
  yColumn: Column,
  scales: Map<Column, NumericScale>
): CornerPoint[] {
  const xScaleMeta = scales.get(xColumn);
  const yScaleMeta = scales.get(yColumn);

  if (!xScaleMeta || !yScaleMeta) {
    return [];
  }

  return rows
    .map((item) => {
      const x = getNumericValue(item, xColumn);
      const y = getNumericValue(item, yColumn);

      if (x === undefined || y === undefined) {
        return undefined;
      }

      if (xScaleMeta.isLogScale && x <= 0) {
        return undefined;
      }

      if (yScaleMeta.isLogScale && y <= 0) {
        return undefined;
      }

      return {
        id: item.id,
        xValue: x,
        yValue: y,
        x: xScaleMeta.xScale(x),
        y: yScaleMeta.scale(y)
      };
    })
    .filter((point): point is CornerPoint => point !== undefined);
}

export function getBrushSelectedIds(
  brush: ActiveBrush,
  data: DataItem[],
  scales: Map<Column, NumericScale>
): number[] {
  const xScaleMeta = scales.get(brush.xColumn);
  const yScaleMeta = scales.get(brush.yColumn);

  if (!xScaleMeta || !yScaleMeta) {
    return [];
  }

  const selected: number[] = [];
  for (const row of data) {
    const xValue = getNumericValue(row, brush.xColumn);
    const yValue = getNumericValue(row, brush.yColumn);

    if (xValue === undefined || yValue === undefined) {
      continue;
    }

    if (xScaleMeta.isLogScale && xValue <= 0) {
      continue;
    }

    if (yScaleMeta.isLogScale && yValue <= 0) {
      continue;
    }

    const x = xScaleMeta.xScale(xValue);
    const y = yScaleMeta.scale(yValue);

    if (x >= brush.minX && x <= brush.maxX && y >= brush.minY && y <= brush.maxY) {
      selected.push(row.id);
    }
  }

  return selected;
}

export function combineBrushes(
  brushes: ActiveBrush[],
  data: DataItem[],
  scales: Map<Column, NumericScale>
): number[] | undefined {
  if (!brushes.length) {
    return undefined;
  }

  const idLists = brushes.map((brush) => getBrushSelectedIds(brush, data, scales));
  const [first, ...rest] = idLists;

  if (!first) {
    return undefined;
  }

  const intersection = new Set(first);
  rest.forEach((list) => {
    const listSet = new Set(list);
    Array.from(intersection).forEach((id) => {
      if (!listSet.has(id)) {
        intersection.delete(id);
      }
    });
  });

  return Array.from(intersection);
}

export function buildDensityBins(
  points: Array<{ x: number; y: number }>,
  cellSize: number,
  gridSize = 18
): Array<{ x: number; y: number; size: number; count: number }> {
  const bins = new Map<string, number>();

  points.forEach((point) => {
    if (point.x < 0 || point.x > cellSize || point.y < 0 || point.y > cellSize) {
      return;
    }
    const xIndex = Math.max(
      0,
      Math.min(gridSize - 1, Math.floor((point.x / cellSize) * gridSize))
    );
    const yIndex = Math.max(
      0,
      Math.min(gridSize - 1, Math.floor((point.y / cellSize) * gridSize))
    );
    const key = `${xIndex}:${yIndex}`;
    bins.set(key, (bins.get(key) ?? 0) + 1);
  });

  const binSize = cellSize / gridSize;
  return Array.from(bins.entries()).map(([key, count]) => {
    const [xIndex, yIndex] = key.split(':').map(Number);
    return {
      x: xIndex * binSize,
      y: yIndex * binSize,
      size: binSize,
      count
    };
  });
}
