import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';

import { useAppDispatch, useAppSelector } from '@/redux/hooks';
import { setParallelCoordinatesFilteredIds } from '@/redux/local/localSlice';
import type { Column, DataItem } from '@/types/types';
import { hasValue } from '@/utils/util';

import { type BrushFilter, type Dimension, NanBrushMode } from './types';
import { addToMap, getClippedDomain, inferDimensions, removeFromMap } from './util';

export interface FilteredDataView {
  rows: DataItem[];
}

export function useHasUncertaintyColumn() {
  const uncertaintyDomains = useAppSelector((state) => state.data.uncertaintyDomains);

  function hasUncertaintyColumn(column: Column): boolean {
    return uncertaintyDomains[column] !== undefined;
  }
  return { hasUncertaintyColumn };
}

export function useChartScales(
  data: DataItem[],
  orderedColumns: Column[],
  enabledUncertaintyColumns: Column[],
  width: number,
  height: number,
  nanAxisYPos: number,
  clipExtremes: boolean
) {
  const uncertaintyDomains = useAppSelector((state) => state.data.uncertaintyDomains);
  const columnData = useAppSelector((state) => state.data.columnData);

  const logScaleColumns = useAppSelector((state) => state.local.logScaleColumns);

  const dimensions: Dimension[] = useMemo(
    () =>
      inferDimensions(
        data,
        orderedColumns.filter((column) => Object.hasOwn(columnData, column)),
        logScaleColumns,
        columnData,
        height,
        clipExtremes
      ),
    [data, orderedColumns, logScaleColumns, columnData, height, clipExtremes]
  );

  const combinedDimensions = useMemo(() => {
    const finalDimensions: Dimension[] = [];
    dimensions.forEach((dim) => {
      finalDimensions.push(dim);

      if (
        enabledUncertaintyColumns.includes(dim.key) &&
        dim.type === 'number' &&
        uncertaintyDomains[dim.key]
      ) {
        const { min, max } = uncertaintyDomains[dim.key];
        const uncertaintyDomain = clipExtremes
          ? getClippedDomain(
              data
                .map((row) => row[`${dim.key}_err`])
                .filter(hasValue)
                .map(Number)
                .filter(Number.isFinite),
              [min, max]
            )
          : [min, max];
        const scale = d3
          .scaleLinear()
          .domain(uncertaintyDomain)
          .nice()
          .range([height, 0]);

        finalDimensions.push({
          key: `${dim.key}_err`,
          type: 'number',
          scale,
          isUncertainty: true
        });
      }
    });
    return finalDimensions;
  }, [
    data,
    dimensions,
    enabledUncertaintyColumns,
    uncertaintyDomains,
    height,
    clipExtremes
  ]);

  const xScale = useMemo(
    () =>
      d3
        .scalePoint<string>()
        .domain(combinedDimensions.map((d) => d.key))
        .range([0, width]),
    [combinedDimensions, width]
  );

  const yPos = useCallback(
    (d: DataItem, dim: Dimension): number => {
      if (dim.type === 'number') {
        const isMissing = !hasValue(d[dim.key]) || isNaN(Number(d[dim.key]));
        return isMissing ? nanAxisYPos : dim.scale(Number(d[dim.key]));
      }

      const isEmpty = d[dim.key] == null || String(d[dim.key]) === '';
      return isEmpty ? nanAxisYPos : dim.scale(String(d[dim.key]))!;
    },
    [nanAxisYPos]
  );

  return { dimensions: combinedDimensions, xScale, yPos };
}

export function useBrushing(data: DataItem[]) {
  const dispatch = useAppDispatch();
  const cornerAffectsParallel = useAppSelector(
    (state) => state.local.crossFiltering.cornerAffectsParallel
  );
  const cornerPlotFilteredIds = useAppSelector(
    (state) => state.local.cornerPlot.filteredIds
  );
  const [brushes, setBrushes] = useState<Record<Column, BrushFilter>>({});
  const [nanBrushes, setNanBrushes] = useState<Record<Column, NanBrushMode>>({});

  function isSameStringArray(a: string[], b: string[]): boolean {
    return a.length === b.length && a.every((value, index) => value === b[index]);
  }

  function clearBrushes() {
    setBrushes({});
    setNanBrushes({});
  }

  function handleBrush(dimension: Dimension, y0: number, y1: number) {
    if (dimension.type === 'number') {
      const { scale } = dimension;

      const min = scale.invert(y1);
      const max = scale.invert(y0);

      setBrushes((prev) =>
        addToMap(prev, dimension.key, {
          type: 'number',
          extent: [min, max]
        })
      );
      return;
    }

    const rawMinY = Math.min(y0, y1);
    const rawMaxY = Math.max(y0, y1);
    const range = dimension.scale.range();
    const rangeMin = Math.min(...range);
    const rangeMax = Math.max(...range);
    const rangeSpan = Math.max(1e-9, rangeMax - rangeMin);

    const normalizedExtent: [number, number] = [
      (rawMinY - rangeMin) / rangeSpan,
      (rawMaxY - rangeMin) / rangeSpan
    ];

    const selectedCategories = dimension.scale.domain().filter((cat) => {
      const y = dimension.scale(cat);
      return y != null && y >= rawMinY && y <= rawMaxY;
    });

    setBrushes((prev) => {
      const current = prev[dimension.key];
      if (current?.type === 'string') {
        const sameSelection = isSameStringArray(current.selected, selectedCategories);
        if (sameSelection) {
          const sameExtent =
            Math.abs(current.normalizedExtent[0] - normalizedExtent[0]) < 1e-6 &&
            Math.abs(current.normalizedExtent[1] - normalizedExtent[1]) < 1e-6;
          if (sameExtent) {
            return prev;
          }
        }
      }

      return addToMap(prev, dimension.key, {
        type: 'string',
        selected: selectedCategories,
        normalizedExtent
      });
    });
  }

  function handleBrushClear(dimension: Dimension) {
    setBrushes((prev) => removeFromMap(prev, dimension.key));
  }

  function handleNanBrush(dimension: Dimension, mode: NanBrushMode | undefined) {
    if (mode === undefined) {
      setNanBrushes((prev) => removeFromMap(prev, dimension.key));
      return;
    }
    setNanBrushes((prev) => addToMap(prev, dimension.key, mode));
  }

  const nanBrushEntries = useMemo(() => Object.entries(nanBrushes), [nanBrushes]);
  const axisBrushEntries = useMemo(
    () =>
      Object.entries(brushes).map(([key, filter]) => ({
        key,
        filter,
        selected: filter.type === 'string' ? new Set(filter.selected) : undefined
      })),
    [brushes]
  );

  const passesNanBrushes = useCallback(
    (row: DataItem) => {
      return nanBrushEntries.every(([key, mode]) => {
        const value = row[key];
        const hasVal = hasValue(value);
        if (mode === NanBrushMode.Block) {
          return hasVal;
        }
        if (mode === NanBrushMode.Filter) {
          return !hasVal;
        }
        return true;
      });
    },
    [nanBrushEntries]
  );

  const passesAxisBrushes = useCallback(
    (row: DataItem) => {
      return axisBrushEntries.every(({ key, filter, selected }) => {
        const value = row[key];
        const hasVal = hasValue(value);

        if (filter.type === 'number') {
          const numericValue = Number(value);
          return (
            hasVal && numericValue >= filter.extent[0] && numericValue <= filter.extent[1]
          );
        }

        return hasVal && selected!.has(String(value));
      });
    },
    [axisBrushEntries]
  );

  const hasActiveFilters = useMemo(
    () => Object.keys(brushes).length > 0 || Object.keys(nanBrushes).length > 0,
    [brushes, nanBrushes]
  );

  const cornerFilterIdSet = useMemo(() => {
    if (!cornerAffectsParallel || cornerPlotFilteredIds === undefined) {
      return undefined;
    }
    return new Set(cornerPlotFilteredIds);
  }, [cornerAffectsParallel, cornerPlotFilteredIds]);

  const localFilteredRows = useMemo(() => {
    if (!hasActiveFilters) {
      return data;
    }

    return data.filter((row) => passesNanBrushes(row) && passesAxisBrushes(row));
  }, [data, hasActiveFilters, passesAxisBrushes, passesNanBrushes]);

  const localFilteredIds = useMemo(() => {
    if (!hasActiveFilters) {
      return undefined;
    }
    return localFilteredRows.map((row) => row.id);
  }, [hasActiveFilters, localFilteredRows]);

  const filteredRows = useMemo(() => {
    if (cornerFilterIdSet === undefined) {
      return localFilteredRows;
    }

    return localFilteredRows.filter((row) => cornerFilterIdSet.has(row.id));
  }, [cornerFilterIdSet, localFilteredRows]);

  const filteredData = useMemo<FilteredDataView>(() => {
    return { rows: filteredRows };
  }, [filteredRows]);

  const getBrushSelection = useCallback(
    (dimension: Dimension): [number, number] | undefined => {
      const filter = brushes[dimension.key];
      if (!filter) {
        return undefined;
      }

      if (dimension.type === 'number' && filter.type === 'number') {
        const y0 = dimension.scale(filter.extent[1]);
        const y1 = dimension.scale(filter.extent[0]);
        return [Math.min(y0, y1), Math.max(y0, y1)];
      }

      if (dimension.type === 'string' && filter.type === 'string') {
        const range = dimension.scale.range();
        const rangeMin = Math.min(...range);
        const rangeMax = Math.max(...range);
        const rangeSpan = rangeMax - rangeMin;

        if (!isFinite(rangeSpan) || rangeSpan <= 0) {
          return undefined;
        }

        const y0 = rangeMin + filter.normalizedExtent[0] * rangeSpan;
        const y1 = rangeMin + filter.normalizedExtent[1] * rangeSpan;
        return [Math.min(y0, y1), Math.max(y0, y1)];
      }

      return undefined;
    },
    [brushes]
  );

  const previousDispatchedIdsRef = useRef<number[] | undefined>(undefined);

  useEffect(() => {
    const nextIds = localFilteredIds;
    const prevIds = previousDispatchedIdsRef.current;

    if (nextIds === undefined && prevIds === undefined) {
      return;
    }

    if (nextIds === undefined || prevIds === undefined) {
      previousDispatchedIdsRef.current = nextIds;
      dispatch(setParallelCoordinatesFilteredIds(nextIds));
      return;
    }

    const isSame =
      prevIds.length === nextIds.length &&
      prevIds.every((id, index) => id === nextIds[index]);
    if (isSame) {
      return;
    }

    previousDispatchedIdsRef.current = nextIds;
    dispatch(setParallelCoordinatesFilteredIds(nextIds));
  }, [dispatch, localFilteredIds]);

  return {
    nActiveBrushes: Object.keys(brushes).length + Object.keys(nanBrushes).length,
    clearBrushes,
    handleBrush,
    handleBrushClear,
    handleNanBrush,
    filteredData,
    getBrushSelection
  };
}
