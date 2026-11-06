/**
 * Data related to the local state of the app.
 */

import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

import { isSameColumnArray } from '@/features/ParallelCoordinates/util';
import type { Column } from '@/types/types';
import {
  cornerDefaultColumns,
  pcDefaultColumns,
  resolveDatasetColumns
} from '@/utils/datasetColumns';

export interface LocalState {
  crossFiltering: {
    cornerAffectsParallel: boolean;
    parallelAffectsCorner: boolean;
  };
  parallelCoordinates: {
    /**
     * Whether the column selection is currently the default selection. This is used to
     * determine whether to show the "Reset to default" button in the column selection UI.
     */
    columnSelectionIsDefault: boolean;

    /**
     * The order of the columns in the parallel coordinates chart. This is separate from
     * the order in the data.columns because the user can reorder them in the graph.
     */
    columnOrder: Column[];

    /**
     * Default columns to show in the parallel coordinates chart.
     */
    defaultColumns: Column[];

    settings: {
      selectedColumns: Column[];
      lineOpacity: number;
      showGhostLines: boolean;
      showTextOnHighlightedLine: boolean;
      clipExtremes: boolean;
      axisViolinPlots: {
        show: boolean;
        showMissingValueLobe: boolean;
      };
    };

    /**
     * IDs currently included by active parallel coordinates filters.
     * Undefined means no active filter. The ID corresponds to the index of the planet
     * in the data.full array.
     */
    filteredIds: number[] | undefined;
  };
  cornerPlot: {
    columnSelectionIsDefault: boolean;
    defaultColumns: Column[];
    settings: {
      selectedColumns: Column[];
      renderMode: 'scatter' | 'density' | 'both';
      invertLayout: boolean;
      clipExtremes: boolean;
    };
    filteredIds: number[] | undefined;
  };
  hoveredId: number | undefined;
  autoSyncOpenSpaceSelection: boolean;
  objectNameColumn: Column;
  logScaleColumns: Column[];
}

type ParallelCoordinatesSettings = LocalState['parallelCoordinates']['settings'];
type ParallelCoordinatesVisualSettings = Omit<
  ParallelCoordinatesSettings,
  'selectedColumns'
>;
type CornerPlotSettings = LocalState['cornerPlot']['settings'];
export type CornerPlotRenderMode = CornerPlotSettings['renderMode'];
type CornerPlotVisualSettings = Omit<CornerPlotSettings, 'selectedColumns'>;

const initialState: LocalState = {
  crossFiltering: {
    cornerAffectsParallel: true,
    parallelAffectsCorner: true
  },
  parallelCoordinates: {
    columnSelectionIsDefault: true,
    settings: {
      selectedColumns: pcDefaultColumns,
      lineOpacity: 0.7,
      showGhostLines: true,
      showTextOnHighlightedLine: true,
      clipExtremes: false,
      axisViolinPlots: {
        show: true,
        showMissingValueLobe: true
      }
    },
    columnOrder: pcDefaultColumns,
    defaultColumns: pcDefaultColumns,
    filteredIds: undefined
  },
  cornerPlot: {
    columnSelectionIsDefault: true,
    settings: {
      selectedColumns: cornerDefaultColumns,
      renderMode: 'both',
      invertLayout: true,
      clipExtremes: true
    },
    defaultColumns: cornerDefaultColumns,
    filteredIds: undefined
  },
  hoveredId: undefined,
  autoSyncOpenSpaceSelection: false,
  objectNameColumn: 'pl_name',
  logScaleColumns: []
};

export const localSlice = createSlice({
  name: 'local',
  initialState,
  reducers: {
    initializeDatasetColumns: (
      state,
      action: PayloadAction<ReturnType<typeof resolveDatasetColumns>>
    ) => {
      const { parallelCoordinates, cornerPlot } = action.payload;
      const parallel = parallelCoordinates.settings;
      const corner = cornerPlot.settings;
      const parallelDefaults = initialState.parallelCoordinates.settings;
      const cornerDefaults = initialState.cornerPlot.settings;

      state.crossFiltering = {
        cornerAffectsParallel:
          action.payload.crossFiltering?.cornerAffectsParallel ??
          initialState.crossFiltering.cornerAffectsParallel,
        parallelAffectsCorner:
          action.payload.crossFiltering?.parallelAffectsCorner ??
          initialState.crossFiltering.parallelAffectsCorner
      };

      state.objectNameColumn = action.payload.objectNameColumn;
      state.parallelCoordinates.defaultColumns = parallelCoordinates.defaultColumns;

      state.parallelCoordinates.settings = {
        selectedColumns: parallelCoordinates.selectedColumns,
        lineOpacity: parallel?.lineOpacity ?? parallelDefaults.lineOpacity,
        showGhostLines: parallel?.showGhostLines ?? parallelDefaults.showGhostLines,
        showTextOnHighlightedLine:
          parallel?.showTextOnHighlightedLine ??
          parallelDefaults.showTextOnHighlightedLine,
        clipExtremes: parallel?.clipExtremes ?? parallelDefaults.clipExtremes,
        axisViolinPlots: {
          show: parallel?.axisViolinPlots?.show ?? parallelDefaults.axisViolinPlots.show,
          showMissingValueLobe:
            parallel?.axisViolinPlots?.showMissingValueLobe ??
            parallelDefaults.axisViolinPlots.showMissingValueLobe
        }
      };

      state.parallelCoordinates.columnOrder = parallelCoordinates.columnOrder;

      state.parallelCoordinates.columnSelectionIsDefault = isSameColumnArray(
        parallelCoordinates.selectedColumns,
        parallelCoordinates.defaultColumns
      );

      state.cornerPlot.defaultColumns = cornerPlot.defaultColumns;
      state.cornerPlot.settings = {
        selectedColumns: cornerPlot.selectedColumns,
        renderMode: corner?.renderMode ?? cornerDefaults.renderMode,
        invertLayout: corner?.invertLayout ?? cornerDefaults.invertLayout,
        clipExtremes: corner?.clipExtremes ?? cornerDefaults.clipExtremes
      };

      state.cornerPlot.columnSelectionIsDefault = isSameColumnArray(
        cornerPlot.selectedColumns,
        cornerPlot.defaultColumns
      );

      state.parallelCoordinates.filteredIds = undefined;
      state.cornerPlot.filteredIds = undefined;
      state.hoveredId = undefined;

      state.logScaleColumns = action.payload.logScaleColumns;
    },
    setCrossFilteringSettings: (
      state,
      action: PayloadAction<Partial<LocalState['crossFiltering']>>
    ) => {
      state.crossFiltering = {
        ...state.crossFiltering,
        ...action.payload
      };
    },
    setParallelCoordinatesSelectedColumns: (state, action) => {
      const newColumns: Column[] = action.payload;
      state.parallelCoordinates.settings.selectedColumns = newColumns;

      const columnSelectionIsDefault = isSameColumnArray(
        newColumns,
        state.parallelCoordinates.defaultColumns
      );
      state.parallelCoordinates.columnSelectionIsDefault = columnSelectionIsDefault;

      const newColumnOrder = state.parallelCoordinates.columnOrder.filter((col: Column) =>
        newColumns.includes(col)
      );
      // Add any newly selected columns to the end of the column order
      newColumns.forEach((col) => {
        if (!newColumnOrder.includes(col)) {
          newColumnOrder.push(col);
        }
      });

      // Removedeselected columns from the column order
      if (!isSameColumnArray(state.parallelCoordinates.columnOrder, newColumnOrder)) {
        state.parallelCoordinates.columnOrder = newColumnOrder;
      }
    },
    setParallelCoordinatesColumnOrder: (state, action) => {
      state.parallelCoordinates.columnOrder = action.payload;
    },
    setParallelCoordinatesFilteredIds: (state, action) => {
      const incoming: number[] | undefined = action.payload;
      const current = state.parallelCoordinates.filteredIds;

      if (incoming === undefined && current === undefined) {
        return;
      }

      if (incoming === undefined || current === undefined) {
        state.parallelCoordinates.filteredIds = incoming;
        return;
      }

      const isSame =
        current.length === incoming.length &&
        current.every((id, index) => id === incoming[index]);
      if (isSame) {
        return;
      }

      state.parallelCoordinates.filteredIds = incoming;
    },
    resetParallelCoordinates: (state) => {
      state.parallelCoordinates.settings.selectedColumns =
        state.parallelCoordinates.defaultColumns;
      state.parallelCoordinates.columnOrder = state.parallelCoordinates.defaultColumns;
      state.parallelCoordinates.columnSelectionIsDefault = true;
      state.parallelCoordinates.filteredIds = undefined;
    },
    setParallelCoordinatesSettings: (
      state,
      action: PayloadAction<Partial<ParallelCoordinatesVisualSettings>>
    ) => {
      const patch = action.payload;

      if (patch.lineOpacity !== undefined) {
        state.parallelCoordinates.settings.lineOpacity = patch.lineOpacity;
      }

      if (patch.showGhostLines !== undefined) {
        state.parallelCoordinates.settings.showGhostLines = patch.showGhostLines;
      }

      if (patch.showTextOnHighlightedLine !== undefined) {
        state.parallelCoordinates.settings.showTextOnHighlightedLine =
          patch.showTextOnHighlightedLine;
      }

      if (patch.clipExtremes !== undefined) {
        state.parallelCoordinates.settings.clipExtremes = patch.clipExtremes;
      }

      if (patch.axisViolinPlots !== undefined) {
        state.parallelCoordinates.settings.axisViolinPlots = {
          ...state.parallelCoordinates.settings.axisViolinPlots,
          ...patch.axisViolinPlots
        };
      }
    },

    setCornerPlotSelectedColumns: (state, action: PayloadAction<Column[]>) => {
      const newColumns = action.payload;
      state.cornerPlot.settings.selectedColumns = newColumns;
      state.cornerPlot.columnSelectionIsDefault = isSameColumnArray(
        newColumns,
        state.cornerPlot.defaultColumns
      );
    },
    resetCornerPlotColumns: (state) => {
      state.cornerPlot.settings.selectedColumns = state.cornerPlot.defaultColumns;
      state.cornerPlot.columnSelectionIsDefault = true;
      state.cornerPlot.filteredIds = undefined;
    },
    setCornerPlotFilteredIds: (state, action: PayloadAction<number[] | undefined>) => {
      const incoming = action.payload;
      const current = state.cornerPlot.filteredIds;

      if (incoming === undefined && current === undefined) {
        return;
      }

      if (incoming === undefined || current === undefined) {
        state.cornerPlot.filteredIds = incoming;
        return;
      }

      const isSame =
        current.length === incoming.length &&
        current.every((id, index) => id === incoming[index]);

      if (isSame) {
        return;
      }

      state.cornerPlot.filteredIds = incoming;
    },
    setCornerPlotSettings: (
      state,
      action: PayloadAction<Partial<CornerPlotVisualSettings>>
    ) => {
      const patch = action.payload;

      if (patch.renderMode !== undefined) {
        state.cornerPlot.settings.renderMode = patch.renderMode;
      }

      if (patch.invertLayout !== undefined) {
        state.cornerPlot.settings.invertLayout = patch.invertLayout;
      }

      if (patch.clipExtremes !== undefined) {
        state.cornerPlot.settings.clipExtremes = patch.clipExtremes;
      }
    },

    setHoveredItemId: (state, action) => {
      state.hoveredId = action.payload;
    },
    setAutoSyncOpenSpaceSelection: (state, action) => {
      state.autoSyncOpenSpaceSelection = action.payload;
    },
    setObjectNameColumn: (state, action) => {
      state.objectNameColumn = action.payload;
    },
    setLogScaleColumns: (state, action) => {
      state.logScaleColumns = action.payload;
    }
  }
});

export const {
  initializeDatasetColumns,
  setCrossFilteringSettings,

  setParallelCoordinatesSelectedColumns,
  setParallelCoordinatesColumnOrder,
  setParallelCoordinatesFilteredIds,
  resetParallelCoordinates,
  setParallelCoordinatesSettings,

  setCornerPlotSelectedColumns,
  resetCornerPlotColumns,
  setCornerPlotFilteredIds,
  setCornerPlotSettings,

  setHoveredItemId,
  setAutoSyncOpenSpaceSelection,
  setObjectNameColumn,
  setLogScaleColumns
} = localSlice.actions;

export default localSlice.reducer;
