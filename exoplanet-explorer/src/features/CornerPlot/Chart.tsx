import { useEffect, useMemo, useRef } from 'react';
import { Box, Button, Group, Loader, Stack, Text } from '@mantine/core';
import { useResizeObserver, useThrottledValue } from '@mantine/hooks';

import { useAppDispatch, useAppSelector } from '@/redux/hooks';
import { setCornerPlotFilteredIds } from '@/redux/local/localSlice';
import type { Column, DataItem } from '@/types/types';

import { CanvasLayer } from './rendering/CanvasLayer';
import { SvgLayer } from './rendering/SvgLayer';
import { CornerPlotSettings } from './Settings/Settings';
import { getCellKey, getCellPointsFromRows, getCellRenderMode } from './helpers';
import { useCornerPlotBrushing } from './useCornerPlotBrushing';
import { useCornerPlotFilterSync } from './useCornerPlotFilterSync';
import { buildNumericScale, getScaleDomain, type NumericScale } from './util';

interface Props {
  data: DataItem[];
  standalone?: boolean;
  hideTopBar?: boolean;
  defaultWidth?: number;
  defaultHeight?: number;
}

const margin = { top: 20, right: 0, bottom: 20, left: 72 };

export function CornerPlotChart({
  data,
  standalone = false,
  hideTopBar = false,
  defaultWidth = 820,
  defaultHeight = 760
}: Props) {
  const dispatch = useAppDispatch();
  const { columns, columnData } = useAppSelector((state) => state.data);
  const settings = useAppSelector((state) => state.local.cornerPlot.settings);
  const hoveredId = useAppSelector((state) => state.local.hoveredId);
  const hoveredUncertainty = useAppSelector((state) =>
    hoveredId === undefined ? undefined : state.data.uncertainty[hoveredId]
  );
  const parallelAffectsCorner = useAppSelector(
    (state) => state.local.crossFiltering.parallelAffectsCorner
  );
  const cornerPlotFilteredIds = useAppSelector(
    (state) => state.local.cornerPlot.filteredIds
  );
  const parallelCoordinatesFilteredIds = useAppSelector(
    (state) => state.local.parallelCoordinates.filteredIds
  );

  const logScaleColumns = useAppSelector((state) => state.local.logScaleColumns);

  const selectedNumericColumns = useMemo(() => {
    return settings.selectedColumns.filter((col) => {
      return columns.includes(col) && columnData[col]?.type === 'number';
    });
  }, [settings.selectedColumns, columns, columnData]);

  const previousSelectedColumnsRef = useRef<string>('');

  const [containerRef, container] = useResizeObserver();

  const rawChartHeight = container ? container.height : defaultHeight;
  const rawChartWidth = container ? container.width : defaultWidth;

  const chartHeight = useThrottledValue(rawChartHeight, 16);
  const chartWidth = useThrottledValue(rawChartWidth, 16);

  const isLoading = !container || chartWidth === 0 || chartHeight === 0;

  const size = Math.min(
    chartWidth - margin.left - margin.right,
    chartHeight - margin.top - margin.bottom
  );

  const cellCount = selectedNumericColumns.length;
  const cellSize = cellCount > 0 ? size / cellCount : 0;

  const {
    brushDraft,
    activeBrushes,
    movingBrushDraft,
    onBrushStart,
    onBrushMove,
    onBrushDragStart,
    onBrushEnd,
    clearBrushesForCell,
    resetBrushing
  } = useCornerPlotBrushing({
    cellSize,
    marginLeft: margin.left,
    marginTop: margin.top
  });

  const scales = useMemo(() => {
    const next = new Map<Column, NumericScale>();

    selectedNumericColumns.forEach((column) => {
      const isLogScale = logScaleColumns.includes(column);
      const domain = getScaleDomain(data, column, isLogScale, settings.clipExtremes);

      if (!domain) {
        return;
      }

      next.set(column, {
        column,
        isLogScale,
        domain,
        scale: buildNumericScale(domain, [cellSize - 8, 8], isLogScale),
        xScale: buildNumericScale(domain, [8, cellSize - 8], isLogScale)
      });
    });

    return next;
  }, [selectedNumericColumns, logScaleColumns, data, cellSize, settings.clipExtremes]);

  useCornerPlotFilterSync({ activeBrushes, data, scales });

  const visiblePointIds = useMemo(() => {
    if (
      cornerPlotFilteredIds === undefined &&
      parallelCoordinatesFilteredIds === undefined
    ) {
      return undefined;
    }

    if (cornerPlotFilteredIds === undefined) {
      return parallelAffectsCorner ? parallelCoordinatesFilteredIds : undefined;
    }

    if (!parallelAffectsCorner || parallelCoordinatesFilteredIds === undefined) {
      return cornerPlotFilteredIds;
    }

    const parallelIdSet = new Set(parallelCoordinatesFilteredIds);
    return cornerPlotFilteredIds.filter((id) => parallelIdSet.has(id));
  }, [cornerPlotFilteredIds, parallelAffectsCorner, parallelCoordinatesFilteredIds]);

  const visiblePointIdSet = useMemo(() => {
    if (visiblePointIds === undefined) {
      return undefined;
    }
    return new Set(visiblePointIds);
  }, [visiblePointIds]);

  const hasActiveCornerFilter = visiblePointIdSet !== undefined;

  const cellPointsByKey = useMemo(() => {
    const entries: Array<[string, ReturnType<typeof getCellPointsFromRows>]> = [];

    selectedNumericColumns.forEach((yColumn, rowIndex) => {
      selectedNumericColumns.forEach((xColumn, colIndex) => {
        const shouldIncludeCell =
          rowIndex === colIndex ||
          getCellRenderMode(
            rowIndex,
            colIndex,
            settings.renderMode,
            settings.invertLayout
          ) !== undefined;

        if (!shouldIncludeCell) {
          return;
        }
        const key = getCellKey(xColumn, yColumn);
        entries.push([key, getCellPointsFromRows(data, xColumn, yColumn, scales)]);
      });
    });

    return new Map(entries);
  }, [data, selectedNumericColumns, scales, settings.invertLayout, settings.renderMode]);

  useEffect(() => {
    const brushes = [
      ...activeBrushes,
      ...(brushDraft ? [brushDraft] : []),
      ...(movingBrushDraft ? [movingBrushDraft.originBrush] : [])
    ];

    brushes.forEach((brush) => {
      const rowIndex = selectedNumericColumns.indexOf(brush.yColumn);
      const colIndex = selectedNumericColumns.indexOf(brush.xColumn);
      if (
        rowIndex < 0 ||
        colIndex < 0 ||
        getCellRenderMode(
          rowIndex,
          colIndex,
          settings.renderMode,
          settings.invertLayout
        ) === undefined
      ) {
        clearBrushesForCell(brush.xColumn, brush.yColumn);
      }
    });
  }, [
    activeBrushes,
    brushDraft,
    movingBrushDraft,
    clearBrushesForCell,
    selectedNumericColumns,
    settings.invertLayout,
    settings.renderMode
  ]);

  useEffect(() => {
    const selectedColumnsKey = selectedNumericColumns.join('|');

    if (previousSelectedColumnsRef.current === '') {
      previousSelectedColumnsRef.current = selectedColumnsKey;
      return;
    }

    if (previousSelectedColumnsRef.current === selectedColumnsKey) {
      return;
    }

    previousSelectedColumnsRef.current = selectedColumnsKey;
    resetBrushing();
    dispatch(setCornerPlotFilteredIds(undefined));
  }, [dispatch, resetBrushing, selectedNumericColumns]);

  function clearCornerFilter() {
    dispatch(setCornerPlotFilteredIds(undefined));
    resetBrushing();
  }

  return (
    <Stack
      gap={'xs'}
      style={
        standalone
          ? { height: '100%', minHeight: 520 }
          : { maxWidth: '100%', minWidth: 0 }
      }
    >
      {!hideTopBar && (
        <>
          <Group gap={'xs'}>
            <CornerPlotSettings />
            <Button variant={'default'} size={'sm'} onClick={clearCornerFilter}>
              Clear filter
            </Button>
            <Text size={'xs'} c={'dimmed'}>
              {visiblePointIds
                ? `${visiblePointIds.length} selected`
                : 'No corner filter'}
            </Text>
            <Text size={'xs'} c={'dimmed'}>
              {activeBrushes.length} brush{activeBrushes.length === 1 ? '' : 'es'}
            </Text>
          </Group>
          <Text size={'xs'} c={'dimmed'}>
            • Hold Alt while dragging to replace previous brushes • Double-click cell to
            clear brushes for that cell
          </Text>
        </>
      )}
      <Box
        style={{
          resize: standalone ? 'none' : 'both',
          flex: standalone ? 1 : undefined,
          height: standalone ? undefined : defaultHeight,
          minHeight: 420,
          width: standalone ? '100%' : defaultWidth,
          maxWidth: standalone ? undefined : '100%',
          minWidth: standalone
            ? Math.max(420, selectedNumericColumns.length * 90 + 72)
            : undefined,
          overflow: 'hidden'
        }}
        ref={containerRef}
      >
        {isLoading ? (
          <Loader size={'xl'} style={{ display: 'block', margin: '100px auto' }} />
        ) : selectedNumericColumns.length < 2 ? (
          <Text size={'sm'} c={'dimmed'} mt={'md'}>
            Choose at least two numeric columns in corner plot settings.
          </Text>
        ) : (
          <div style={{ position: 'relative', width: chartWidth, height: chartHeight }}>
            <CanvasLayer
              chartWidth={chartWidth}
              chartHeight={chartHeight}
              margin={margin}
              selectedNumericColumns={selectedNumericColumns}
              cellSize={cellSize}
              cellPointsByKey={cellPointsByKey}
              renderMode={settings.renderMode}
              invertLayout={settings.invertLayout}
              hasActiveCornerFilter={hasActiveCornerFilter}
              visiblePointIdSet={visiblePointIdSet}
            />
            <SvgLayer
              chartWidth={chartWidth}
              chartHeight={chartHeight}
              margin={margin}
              selectedNumericColumns={selectedNumericColumns}
              scales={scales}
              cellSize={cellSize}
              cellPointsByKey={cellPointsByKey}
              hoveredId={hoveredId}
              hoveredUncertainty={hoveredUncertainty}
              renderMode={settings.renderMode}
              invertLayout={settings.invertLayout}
              brushDraft={brushDraft}
              activeBrushes={activeBrushes}
              movingBrushDraft={movingBrushDraft}
              onBrushMove={onBrushMove}
              onBrushEnd={onBrushEnd}
              onBrushStart={onBrushStart}
              onBrushDragStart={onBrushDragStart}
              onClearBrushesForCell={clearBrushesForCell}
            />
          </div>
        )}
      </Box>
    </Stack>
  );
}
