import { useCallback, useMemo, useState } from 'react';
import { Box, Button, Group, Loader, Stack, Text } from '@mantine/core';
import { useResizeObserver, useThrottledValue } from '@mantine/hooks';

import { useAppDispatch, useAppSelector } from '@/redux/hooks.ts';
import { setParallelCoordinatesColumnOrder } from '@/redux/local/localSlice.ts';
import type { Column, DataItem, UncertaintyDataItem } from '@/types/types.ts';
import { ACTIVE_COLOR } from '@/utils/constants.ts';

import { Axes } from './Axes/Axes.tsx';
import { CanvasLines } from './Lines/CanvasLines.tsx';
import { GhostLines } from './Lines/GhostLines.tsx';
import { HighlightedLine } from './Lines/HighlightedLine.tsx';
import { SettingsParallelCoordinates } from './Settings/Settings.tsx';
import { useBrushing, useChartScales } from './hooks.ts';

interface Props {
  data: DataItem[];
  hideTopBar?: boolean;
  standalone?: boolean;
  initialUncertaintyColumns?: Column[];
  uncertaintyData?: Record<Column, UncertaintyDataItem>[];
  defaultWidth?: number;
  defaultHeight?: number;
  maxHeight?: number;
  cfg?: {
    strokeWidth?: number;
    lineOpacity?: number;
    showGhostLines?: boolean;
    showMissingValueViolin?: boolean;
  };
}

const margin = { top: 50, right: 50, bottom: 50, left: 50 };
const extraLeftMargin = 100;
const extraRightMargin = 50;

function useChartLayout(containerWidth: number, containerHeight: number) {
  const extraHeight = 0.1 * containerHeight;
  const internalWidth =
    containerWidth - margin.left - extraLeftMargin - margin.right - extraRightMargin;
  const internalHeight = containerHeight - margin.top - margin.bottom - extraHeight;
  const heightWithNanAxis = containerHeight - extraHeight;
  const nanAxisYPos = 1.1 * internalHeight;

  return { internalWidth, internalHeight, heightWithNanAxis, nanAxisYPos };
}

export function ParallelCoordinatesChart({
  data,
  standalone = false,
  hideTopBar = false,
  initialUncertaintyColumns = [],
  defaultWidth = 800,
  defaultHeight = 400,
  maxHeight = 1000,
  cfg = {
    strokeWidth: 1,
    lineOpacity: 1.0,
    showGhostLines: false,
    showMissingValueViolin: true
  }
}: Props) {
  const [axisRenderKey, setAxisRenderKey] = useState(0);
  const [enabledUncertaintyColumns, setEnabledUncertaintyColumns] = useState<Column[]>(
    () => [...initialUncertaintyColumns]
  );

  const orderedColumns = useAppSelector(
    (state) => state.local.parallelCoordinates.columnOrder
  );

  const settings = useAppSelector((state) => state.local.parallelCoordinates.settings);

  const dispatch = useAppDispatch();

  const {
    nActiveBrushes,
    clearBrushes,
    handleBrush,
    handleBrushClear,
    handleNanBrush,
    filteredData,
    getBrushSelection
  } = useBrushing(data);

  const [containerRef, container] = useResizeObserver();

  const rawChartHeight = container ? container.height : defaultHeight;
  const rawChartWidth = container ? container.width : defaultWidth;

  const chartHeight = useThrottledValue(rawChartHeight, 16);
  const chartWidth = useThrottledValue(rawChartWidth, 16);

  const isLoading = !container || chartWidth === 0 || chartHeight === 0;

  const { internalWidth, internalHeight, heightWithNanAxis, nanAxisYPos } =
    useChartLayout(chartWidth, chartHeight);

  // Dimensions are the diimensions to render, including uncertainty axes if enabled
  const { dimensions, xScale, yPos } = useChartScales(
    data,
    orderedColumns,
    enabledUncertaintyColumns,
    internalWidth,
    internalHeight,
    nanAxisYPos,
    settings.clipExtremes
  );

  function handleResetFilter() {
    clearBrushes();
    setAxisRenderKey((current) => current + 1);
  }

  function onAxisMove(dimensionKey: string, direction: 'previous' | 'next') {
    const currentIndex = orderedColumns.findIndex((col: Column) => col === dimensionKey);
    if (currentIndex === -1) return;

    let newIndex;
    if (direction === 'previous') {
      newIndex = currentIndex === 0 ? orderedColumns.length - 1 : currentIndex - 1;
    } else {
      newIndex = currentIndex === orderedColumns.length - 1 ? 0 : currentIndex + 1;
    }

    const newColumns = [...orderedColumns];
    [newColumns[currentIndex], newColumns[newIndex]] = [
      newColumns[newIndex],
      newColumns[currentIndex]
    ];
    dispatch(setParallelCoordinatesColumnOrder(newColumns));
  }

  const onUncertaintyToggle = useCallback((dimensionKey: string, enabled: boolean) => {
    setEnabledUncertaintyColumns((prev) => {
      const alreadyEnabled = prev.includes(dimensionKey);
      if (enabled) {
        return alreadyEnabled ? prev : [...prev, dimensionKey];
      }
      return alreadyEnabled ? prev.filter((col) => col !== dimensionKey) : prev;
    });
  }, []);

  const linesProps = useMemo(
    () => ({
      dimensions,
      xScale,
      yPos,
      xOffset: margin.left + extraLeftMargin,
      yOffset: margin.top,
      opacity: cfg.lineOpacity,
      strokeWidth: cfg.strokeWidth,
      width: internalWidth,
      height: heightWithNanAxis
    }),
    [
      dimensions,
      xScale,
      yPos,
      cfg.lineOpacity,
      cfg.strokeWidth,
      internalWidth,
      heightWithNanAxis
    ]
  );

  return (
    <Stack gap={'xs'} style={standalone ? { height: '100%', minHeight: 450 } : undefined}>
      {!hideTopBar && (
        <Group gap={'xs'} align={'center'}>
          <SettingsParallelCoordinates />
          <Button variant={'default'} size={'sm'} onClick={handleResetFilter}>
            Clear filter
          </Button>
          <Group gap={5}>
            <Text size={'md'} fw={500}>
              {filteredData.rows.length}{' '}
            </Text>
            <Text size={'xs'} c={'dimmed'}>
              / {data.length} planets shown
            </Text>
            <Text size={'xs'} c={'dimmed'} ml={'xs'}>
              {nActiveBrushes} brush{nActiveBrushes === 1 ? '' : 'es'}
            </Text>
          </Group>
        </Group>
      )}
      <Box
        style={{
          resize: standalone ? 'none' : 'both',
          flex: standalone ? 1 : undefined,
          height: standalone ? undefined : defaultHeight,
          maxHeight: standalone ? undefined : maxHeight,
          minHeight: 200,
          width: standalone ? '100%' : defaultWidth,
          minWidth: standalone ? Math.max(600, dimensions.length * 90 + 250) : undefined,
          overflow: 'hidden'
        }}
        ref={containerRef}
      >
        {isLoading ? (
          <Loader size={'xl'} style={{ display: 'block', margin: '100px auto' }} />
        ) : (
          <div style={{ position: 'relative' }}>
            {/* Lines */}
            {cfg.showGhostLines && <GhostLines {...linesProps} data={data} />}
            <CanvasLines
              {...linesProps}
              data={filteredData.rows}
              strokeColor={ACTIVE_COLOR}
            />

            {/* Axes */}
            <svg
              width={chartWidth}
              height={chartHeight}
              style={{ position: 'absolute', inset: 0 }}
            >
              <g transform={`translate(${margin.left + extraLeftMargin}, ${margin.top})`}>
                <Axes
                  data={filteredData.rows}
                  key={axisRenderKey}
                  dimensions={dimensions}
                  enabledUncertaintyColumns={enabledUncertaintyColumns}
                  violinPlots={settings.axisViolinPlots}
                  xScale={xScale}
                  nanAxisYPos={nanAxisYPos}
                  handleBrush={handleBrush}
                  handleBrushClear={handleBrushClear}
                  getBrushSelection={getBrushSelection}
                  handleNanBrush={handleNanBrush}
                  onAxisMove={onAxisMove}
                  onUncertaintyToggle={onUncertaintyToggle}
                />
              </g>
            </svg>

            {/* Highlighted item */}
            <HighlightedLine {...linesProps} sourceData={data} />
          </div>
        )}
      </Box>
    </Stack>
  );
}
