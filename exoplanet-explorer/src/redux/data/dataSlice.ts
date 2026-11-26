import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

import type { Column, ColumnData, DataItem, UncertaintyDataItem } from '@/types/types';
import { type DatasetSource, getDatasetKey } from '@/utils/datasetColumns';
import { hasValue } from '@/utils/util';

interface DataState {
  dataFileName: string | undefined;
  /**
   * Identifies saved column preferences by source kind, source name and sorted column
   * names. Unchanged filenames and columns reuse preferences even if values change.
   */
  datasetKey: string;
  /**
   * Session-local load counter, incremented on every initialization, even for the
   * same dataset. Used as a React key to reset chart-local brushes and uncertainty
   * axes without changing the dataset's saved preferences.
   */
  datasetRevision: number;
  /**
   * Full dataset including uncertainty data for each planet.
   * The ID of each planet corresponds to the index in these lists.
   */
  full: DataItem[];
  columns: Column[];
  columnData: Record<Column, ColumnData>;

  /**
   * Just the uncertainty columns corresponding to each planet in the full dataset.
   */
  uncertainty: UncertaintyDataItem[];

  /**
   * Uncertainty domains for each column (in percentage).
   */
  uncertaintyDomains: Record<Column, { min: number; max: number }>;

  /**
   * Number of planets currently included in OpenSpace's filtered rows property.
   */
  filteredPlanetsFromOpenSpace: number[] | undefined;
  hasActiveFilters: boolean | undefined;
}

const initialState: DataState = {
  dataFileName: undefined,
  datasetKey: '',
  datasetRevision: 0,
  full: [],
  columns: [],
  columnData: {},
  uncertainty: [],
  uncertaintyDomains: {},
  filteredPlanetsFromOpenSpace: undefined,
  hasActiveFilters: undefined
};

export const dataSlice = createSlice({
  name: 'data',
  initialState,
  reducers: {
    initializeData: (
      state,
      action: PayloadAction<{
        rows: Record<string, DataItem[string]>[];
        source: DatasetSource;
        dataFileName?: string;
      }>
    ) => {
      state.uncertaintyDomains = {};
      state.filteredPlanetsFromOpenSpace = undefined;
      // Split the data into one part with the data values, and one with uncertainty
      // columns
      const fullData: DataItem[] = [];
      const uncertaintyData: UncertaintyDataItem[] = [];

      action.payload.rows.forEach((item, index: number) => {
        const newEntry: DataItem = { id: index };
        const uncertaintyEntry: UncertaintyDataItem = {};
        for (const key in item) {
          // Skip some columns completely
          if (key.endsWith('lim')) {
            continue;
          }
          // Handle uncertainty columns
          if (key.endsWith('err1') || key.endsWith('err2')) {
            const baseKey = key.slice(0, -4);
            const value = hasValue(item[key]) ? Number(item[key]) : null;

            // TODO: Compute the absolute uncertainty range (in percentage) not just the upper and lower bounds
            // err1 is the positive (upper) and err2 the negative (lower) uncertainty
            if (key.endsWith('err1')) {
              uncertaintyEntry[baseKey] = {
                ...uncertaintyEntry[baseKey],
                upper: value
              };
            } else {
              uncertaintyEntry[baseKey] = {
                ...uncertaintyEntry[baseKey],
                lower: value
              };
            }
          }
          if (key !== 'id') {
            newEntry[key] = item[key];
          }
        }

        // Compute percentage uncertainty for each column that has both upper and lower
        // bounds. keep track of the domains
        for (const col in uncertaintyEntry) {
          const value = hasValue(item[col]) ? Number(item[col]) : null;

          const { upper, lower } = uncertaintyEntry[col];
          if (
            value !== null &&
            value !== 0 &&
            lower != null &&
            upper != null &&
            [value, lower, upper].every(Number.isFinite)
          ) {
            const percentage =
              (100.0 * (Math.abs(upper) + Math.abs(lower))) / Math.abs(value);
            uncertaintyEntry[col].percentage = percentage;

            state.uncertaintyDomains[col] = {
              min: Math.min(state.uncertaintyDomains[col]?.min ?? Infinity, percentage),
              max: Math.max(state.uncertaintyDomains[col]?.max ?? -Infinity, percentage)
            };
          }
        }

        fullData.push(newEntry);
        uncertaintyData.push(uncertaintyEntry);
      });

      state.full = fullData;
      state.uncertainty = uncertaintyData;

      state.columns = [...new Set(fullData.flatMap((row) => Object.keys(row)))].filter(
        (col) => col !== 'id'
      );
      state.datasetKey = getDatasetKey(action.payload.source, state.columns);
      state.dataFileName =
        action.payload.dataFileName ??
        (action.payload.source.kind === 'file' ? action.payload.source.name : undefined);
      state.datasetRevision += 1;
      state.columnData = {};

      for (const key of state.columns) {
        const values = fullData
          .map((d) => d[key])
          .filter((v): v is string | number => {
            if (v == null) {
              return false;
            }

            if (typeof v === 'string') {
              return v.trim() !== '';
            }

            return true;
          });

        const numericValues = values
          .map((v) => Number(v))
          .filter((v): v is number => Number.isFinite(v));

        const numericRatio =
          values.length === 0 ? 0 : numericValues.length / values.length;
        const isNumeric = values.length > 0 && numericRatio > 0.8;

        if (isNumeric) {
          let min = Infinity;
          let max = -Infinity;
          for (const value of numericValues) {
            min = Math.min(min, value);
            max = Math.max(max, value);
          }

          state.columnData[key] = {
            type: 'number',
            min,
            max,
            isUncertainty: key.endsWith('err1') || key.endsWith('err2')
          };
        } else {
          const categories = Array.from(new Set(values.map((v) => String(v))));
          state.columnData[key] = { type: 'string', categories };
        }
      }
    },
    setFilteredPlanetsFromOpenSpace: (state, action: PayloadAction<number[]>) => {
      state.filteredPlanetsFromOpenSpace = [...new Set(action.payload)];
    },
    setHasActiveFilters: (state, action: PayloadAction<boolean>) => {
      state.hasActiveFilters = action.payload;
    }
  }
});

export const { initializeData, setFilteredPlanetsFromOpenSpace, setHasActiveFilters } =
  dataSlice.actions;

export default dataSlice.reducer;
