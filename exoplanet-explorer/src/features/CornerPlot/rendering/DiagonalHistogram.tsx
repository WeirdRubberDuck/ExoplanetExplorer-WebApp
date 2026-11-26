import { memo } from 'react';
import * as d3 from 'd3';

import type { CornerPoint } from '../helpers';
import type { NumericScale } from '../util';

const DIAGONAL_HISTOGRAM_BINS = 64;

interface Props {
  points: CornerPoint[];
  xScaleMeta: NumericScale;
  cellSize: number;
}

export const DiagonalHistogram = memo(function DiagonalHistogram({
  points,
  xScaleMeta,
  cellSize
}: Props) {
  const domainMin = Math.min(...xScaleMeta.domain);
  const domainMax = Math.max(...xScaleMeta.domain);

  const values = points
    .map((point) => point.xValue)
    .filter((value) => value >= domainMin && value <= domainMax);

  const bins = d3.bin().thresholds(DIAGONAL_HISTOGRAM_BINS)(values);
  const maxCount = d3.max(bins, (bin) => bin.length) ?? 1;
  const yScale = d3
    .scaleLinear()
    .domain([0, maxCount])
    .range([cellSize - 8, 8]);

  return (
    <>
      {bins.map((bin, idx) => {
        const x0 = Math.max(domainMin, Math.min(domainMax, bin.x0 ?? domainMin));
        const x1 = Math.max(domainMin, Math.min(domainMax, bin.x1 ?? domainMax));

        const leftPx = xScaleMeta.xScale(x0);
        const rightPx = xScaleMeta.xScale(x1);
        const barX = Math.min(leftPx, rightPx);
        const barWidth = Math.max(1, Math.abs(rightPx - leftPx));
        const barY = yScale(bin.length);
        const barHeight = cellSize - 8 - barY;

        return (
          <rect
            key={`diag-hist-${idx}`}
            x={barX}
            y={barY}
            width={barWidth}
            height={Math.max(1, barHeight)}
            fill={'#7aa5d2'}
            opacity={0.8}
          />
        );
      })}
    </>
  );
});
