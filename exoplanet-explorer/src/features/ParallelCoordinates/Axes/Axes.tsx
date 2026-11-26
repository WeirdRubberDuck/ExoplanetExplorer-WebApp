import * as d3 from 'd3';

import type { Column, DataItem } from '@/types/types.ts';

import { useHasUncertaintyColumn } from '../hooks.ts';
import { type Dimension, NanBrushMode } from '../types.ts';

import { Axis } from './Axis.tsx';
import { AxisViolin } from './AxisViolin.tsx';
import { MissingValueAxis } from './MissingValueAxis.tsx';
import { MissingValueAxisLabel } from './MissinValueAxisLabel.tsx';
import { UncertaintyAxisCheckbox } from './UncertaintyAxisCheckbox.tsx';

interface Props {
  data: DataItem[];
  dimensions: Dimension[];
  enabledUncertaintyColumns: Column[];
  violinPlots?: {
    show?: boolean;
    showMissingValueLobe?: boolean;
  };
  xScale: d3.ScalePoint<string>;
  nanAxisYPos: number;
  handleBrush: (dimension: Dimension, y0: number, y1: number) => void;
  handleBrushClear: (dimension: Dimension) => void;
  updateOnBrushEnd: boolean;
  getBrushSelection: (dimension: Dimension) => [number, number] | undefined;
  handleNanBrush: (dimension: Dimension, mode: NanBrushMode | undefined) => void;
  onUncertaintyToggle: (dimensionKey: string, enabled: boolean) => void;
  onAxisMove: (dimensionKey: string, direction: 'previous' | 'next') => void;
}

export function Axes({
  data,
  dimensions,
  enabledUncertaintyColumns,
  violinPlots = { show: true, showMissingValueLobe: true },
  xScale,
  nanAxisYPos,
  handleBrush,
  handleBrushClear,
  updateOnBrushEnd,
  getBrushSelection,
  handleNanBrush,
  onUncertaintyToggle,
  onAxisMove
}: Props) {
  const { hasUncertaintyColumn } = useHasUncertaintyColumn();
  const internalWidth = xScale.range()[1] - xScale.range()[0];
  const missingValueY = nanAxisYPos;
  const axisLabelY = nanAxisYPos + 15;
  const uncertaintyCheckboxY = nanAxisYPos + 32;

  return (
    <>
      {dimensions.map((dim) => (
        <g key={dim.key} transform={`translate(${xScale(dim.key)},0)`}>
          {violinPlots.show && (
            <AxisViolin
              dimension={dim}
              data={data}
              missingValueY={missingValueY}
              includeMissingValueLobe={violinPlots.showMissingValueLobe}
              opacity={0.7}
              fill={'var(--mantine-color-indigo-9)'}
            />
          )}
          <Axis
            dimension={dim}
            handleBrush={handleBrush}
            handleBrushClear={handleBrushClear}
            updateOnBrushEnd={updateOnBrushEnd}
            brushSelection={getBrushSelection(dim)}
            onMovePrevious={() => onAxisMove(dim.key, 'previous')}
            onMoveNext={() => onAxisMove(dim.key, 'next')}
          />
          <MissingValueAxis dimension={dim} y={missingValueY} onBrush={handleNanBrush} />
          {hasUncertaintyColumn(dim.key) && (
            <UncertaintyAxisCheckbox
              checked={enabledUncertaintyColumns.includes(dim.key)}
              y={uncertaintyCheckboxY}
              size={14}
              strokeWidth={3}
              onChange={(checked) => onUncertaintyToggle(dim.key, checked)}
            />
          )}
        </g>
      ))}
      {/* NaN axis line and label */}
      <MissingValueAxisLabel
        lineY={axisLabelY}
        missingValueLabelY={missingValueY}
        uncertaintyLabelY={uncertaintyCheckboxY}
        width={internalWidth}
      />
    </>
  );
}
