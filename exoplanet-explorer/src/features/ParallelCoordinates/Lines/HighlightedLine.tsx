import { useMemo } from 'react';
import * as d3 from 'd3';

import { useHoveredDatasetItem } from '@/hooks/data';
import { useAppSelector } from '@/redux/hooks.ts';
import type { Column, DataItem, UncertaintyDataItem } from '@/types/types.ts';
import { HIGHLIGHT_COLOR } from '@/utils/constants.ts';
import { hasValue } from '@/utils/util.ts';

import type { Dimension } from '../types.ts';

import { CanvasLines, type CanvasLinesProps } from './CanvasLines.tsx';

type Props = Omit<CanvasLinesProps, 'data'> & {
  sourceData: DataItem[];
};

function formatAxisValue(value: DataItem[string]): string {
  if (value == null || value === '') {
    return 'NA';
  }

  if (typeof value === 'number') {
    if (Math.abs(value) >= 10000 || Math.abs(value) < 0.01) {
      return value.toExponential(2);
    }

    return Number(value.toFixed(2)).toString();
  }

  return String(value);
}

function buildUncertaintyAreaPath(
  item: DataItem,
  uncertainty: UncertaintyDataItem | undefined,
  dimensions: Dimension[],
  xScale: d3.ScalePoint<string>,
  yPos: (d: DataItem, dim: Dimension) => number,
  logScaleColumns: Column[]
): string | null {
  if (!uncertainty) {
    return null;
  }

  function edgeY(dim: Dimension, side: 'upper' | 'lower'): number {
    const fallback = yPos(item, dim);
    if (dim.type !== 'number' || dim.isUncertainty) {
      return fallback;
    }

    const raw = item[dim.key];
    const bound = uncertainty?.[dim.key]?.[side];
    if (!hasValue(raw) || bound == null || isNaN(Number(raw))) {
      return fallback;
    }

    const offset = Math.abs(bound);
    let value = side === 'upper' ? Number(raw) + offset : Number(raw) - offset;
    if (logScaleColumns.includes(dim.key) && value <= 0) {
      [value] = dim.scale.domain();
    }

    const [r0, r1] = dim.scale.range();
    const y = dim.scale(value);
    return Math.max(Math.min(r0, r1), Math.min(Math.max(r0, r1), y));
  }

  const points: [number, number][] = [];
  dimensions.forEach((dim) => {
    const x = xScale(dim.key);
    if (x != null) points.push([x, edgeY(dim, 'upper')]);
  });
  dimensions
    .slice()
    .reverse()
    .forEach((dim) => {
      const x = xScale(dim.key);
      if (x != null) points.push([x, edgeY(dim, 'lower')]);
    });

  return d3.line()(points);
}

export function HighlightedLine({ sourceData, ...props }: Props) {
  const itemId = useAppSelector((state) => state.local.hoveredId);
  const showText = useAppSelector(
    (state) => state.local.parallelCoordinates.settings.showTextOnHighlightedLine
  );

  const itemUncertainty = useAppSelector((state) =>
    itemId === undefined ? undefined : state.data.uncertainty[itemId]
  );
  const logScaleColumns = useAppSelector((state) => state.local.logScaleColumns);

  const itemData = useHoveredDatasetItem(sourceData);

  const { dimensions, xScale, yPos } = props;
  const areaPath = useMemo(
    () =>
      itemData
        ? buildUncertaintyAreaPath(
            itemData,
            itemUncertainty,
            dimensions,
            xScale,
            yPos,
            logScaleColumns
          )
        : null,
    [itemData, itemUncertainty, dimensions, xScale, yPos, logScaleColumns]
  );

  if (itemId === undefined || itemData === undefined) {
    return null;
  }

  const strokeWidth = 2.0 * (props.strokeWidth ?? 1.0);
  const xOffset = props.xOffset ?? 0;
  const yOffset = props.yOffset ?? 0;

  return (
    <>
      {areaPath && (
        <svg
          width={props.width}
          height={props.height}
          style={{
            position: 'absolute',
            left: xOffset,
            top: yOffset,
            pointerEvents: 'none',
            overflow: 'visible'
          }}
        >
          <path d={areaPath} fill={HIGHLIGHT_COLOR} fillOpacity={0.35} stroke={'none'} />
        </svg>
      )}
      <CanvasLines
        {...props}
        data={[itemData]}
        strokeColor={HIGHLIGHT_COLOR}
        strokeWidth={strokeWidth}
      />
      {/* Add text per axis value */}
      {showText && (
        <svg
          width={props.width}
          height={props.height}
          style={{
            position: 'absolute',
            left: xOffset,
            top: yOffset,
            pointerEvents: 'none',
            overflow: 'visible'
          }}
        >
          {props.dimensions.map((dim) => {
            const x = props.xScale(dim.key);
            if (x == null) {
              return null;
            }

            const y = props.yPos(itemData, dim);
            const value = formatAxisValue(itemData[dim.key]);

            return (
              <text
                key={`highlight-value-${dim.key}`}
                x={x + 4}
                y={y - 4}
                fontSize={12}
                fontWeight={600}
                fill={'var(--mantine-color-text)'}
                style={{
                  filter: 'drop-shadow(0 0 5px var(--mantine-color-body))'
                }}
              >
                {value}
              </text>
            );
          })}
        </svg>
      )}
    </>
  );
}
