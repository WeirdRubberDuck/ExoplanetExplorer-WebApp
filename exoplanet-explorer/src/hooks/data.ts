// Use either the full dataset in redux, or a filtered dataset from OpenSpace,

import { useMemo } from 'react';
import { createSelector } from '@reduxjs/toolkit';

import { useAppSelector } from '@/redux/hooks';
import type { RootState } from '@/redux/store';

// depending on the autoSyncOpenSpaceSelection setting in redux
const selectBaseDataset = createSelector(
  [
    (state: RootState) => state.local.autoSyncOpenSpaceSelection,
    (state: RootState) => state.data.full,
    (state: RootState) => state.data.filteredPlanetsFromOpenSpace,
    (state: RootState) => state.data.hasActiveFilters
  ],
  (autoSyncOpenSpaceSelection, fullDataset, filteredIds, hasActiveFilters) => {
    if (
      !autoSyncOpenSpaceSelection ||
      hasActiveFilters !== true ||
      filteredIds === undefined
    ) {
      return fullDataset;
    }
    const filteredIdSet = new Set(filteredIds);
    return fullDataset.filter((planet) => filteredIdSet.has(planet.id));
  }
);

export function useBaseDataset() {
  return useAppSelector(selectBaseDataset);
}

export function useHoveredDatasetItem(data: ReturnType<typeof useBaseDataset>) {
  const fullDataset = useAppSelector((state) => state.data.full);
  const hoveredId = useAppSelector((state) => state.local.hoveredId);
  const filteredIdSet = useMemo(
    () => (data === fullDataset ? undefined : new Set(data.map((row) => row.id))),
    [data, fullDataset]
  );

  if (hoveredId === undefined || (filteredIdSet && !filteredIdSet.has(hoveredId))) {
    return undefined;
  }
  return fullDataset[hoveredId];
}

export function useFilteredIds() {
  const crossFiltering = useAppSelector((state) => state.local.crossFiltering);
  const parallelCoordinatesFilteredIds = useAppSelector(
    (state) => state.local.parallelCoordinates.filteredIds
  );
  const cornerPlotFilteredIds = useAppSelector(
    (state) => state.local.cornerPlot.filteredIds
  );

  const filteredIds = useMemo(() => {
    const includeParallel = crossFiltering.parallelAffectsCorner;
    const includeCorner = crossFiltering.cornerAffectsParallel;

    const effectiveParallel = includeParallel
      ? parallelCoordinatesFilteredIds
      : undefined;
    const effectiveCorner = includeCorner ? cornerPlotFilteredIds : undefined;

    if (effectiveParallel === undefined && effectiveCorner === undefined) {
      return undefined;
    }

    if (effectiveParallel === undefined) {
      return effectiveCorner;
    }

    if (effectiveCorner === undefined) {
      return effectiveParallel;
    }

    const cornerIdSet = new Set(effectiveCorner);
    return effectiveParallel.filter((id) => cornerIdSet.has(id));
  }, [cornerPlotFilteredIds, crossFiltering, parallelCoordinatesFilteredIds]);

  const count = filteredIds ? filteredIds.length : undefined;
  return { filteredIds, count };
}
