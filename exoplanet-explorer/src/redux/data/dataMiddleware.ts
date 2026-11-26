import { createAsyncThunk, isAnyOf } from '@reduxjs/toolkit';

import { api } from '@/api/api';
import { ConnectionStatus, onOpenConnection } from '@/redux/connection/connectionSlice';
import type { AppStartListening } from '@/redux/listenerMiddleware';
import {
  initializeDatasetColumns,
  resetCornerPlotColumns,
  resetParallelCoordinates,
  setAutoSyncOpenSpaceSelection,
  setCornerPlotSelectedColumns,
  setCornerPlotSettings,
  setCrossFilteringSettings,
  setHoveredItemId,
  setLogScaleColumns,
  setObjectNameColumn,
  setParallelCoordinatesColumnOrder,
  setParallelCoordinatesSelectedColumns,
  setParallelCoordinatesSettings
} from '@/redux/local/localSlice';
import { readColumnPreferences, writeColumnPreferences } from '@/utils/columnPreferences';
import { resolveDatasetColumns } from '@/utils/datasetColumns';

import {
  initializeData,
  setFilteredPlanetsFromOpenSpace,
  setHasActiveFilters
} from './dataSlice';

export const setupPropertySubscriptions = createAsyncThunk(
  'data/setupPropertySubscriptions',
  async (_, thunkApi) => {
    // Subscribe to all the relevant OpenSpace properties we want to listen to here

    // Filtered data rows from OpenSpace's ExoplanetExplorer UI
    const subscription = api.subscribeToProperty(
      'Modules.ExoplanetExplorer.FilteredDataRows'
    );
    (async () => {
      for await (const data of subscription) {
        if (
          data &&
          data.type === 'value' &&
          Array.isArray(data.value) &&
          data.value.every(
            (id): id is number => typeof id === 'number' && Number.isInteger(id)
          )
        ) {
          thunkApi.dispatch(setFilteredPlanetsFromOpenSpace(data.value));
        }
      }
    })();

    const activeFiltersSubscription = api.subscribeToProperty(
      'Modules.ExoplanetExplorer.HasActiveFilters',
      'BoolProperty'
    );
    (async () => {
      for await (const data of activeFiltersSubscription) {
        if (data && data.type === 'value') {
          thunkApi.dispatch(setHasActiveFilters(data.value));
        }
      }
    })();

    const hoverSubscription = api.subscribeToProperty(
      'Modules.ExoplanetExplorer.HoveredIndex'
    );
    (async () => {
      for await (const data of hoverSubscription) {
        if (data && data.type === 'value') {
          const { value } = data;
          if (typeof value === 'number' && Number.isInteger(value) && value >= -1) {
            thunkApi.dispatch(setHoveredItemId(value === -1 ? undefined : value));
          }
        }
      }
    })();
  }
);

export const addDataListener = (startListening: AppStartListening) => {
  startListening({
    actionCreator: initializeData,
    effect: (_, listenerApi) => {
      const { columns, columnData, datasetKey, full } = listenerApi.getState().data;
      listenerApi.dispatch(
        initializeDatasetColumns(
          resolveDatasetColumns(
            columns,
            columnData,
            readColumnPreferences(datasetKey),
            full.length
          )
        )
      );
    }
  });

  // Listen for changes to local column preferences and persist them to local storage
  startListening({
    matcher: isAnyOf(
      setParallelCoordinatesSelectedColumns,
      setParallelCoordinatesColumnOrder,
      setCornerPlotSelectedColumns,
      setParallelCoordinatesSettings,
      setCornerPlotSettings,
      setCrossFilteringSettings,
      setLogScaleColumns,
      setObjectNameColumn,
      resetParallelCoordinates,
      resetCornerPlotColumns
    ),
    effect: (action, listenerApi) => {
      const { data, local } = listenerApi.getState();
      if (!data.datasetKey) {
        return;
      }
      const { selectedColumns: parallelColumns, ...parallelSettings } =
        local.parallelCoordinates.settings;
      const savedBrushMode = readColumnPreferences(data.datasetKey)?.parallelCoordinates
        .settings?.updateOnBrushEnd;
      const brushModeChanged =
        setParallelCoordinatesSettings.match(action) &&
        action.payload.updateOnBrushEnd !== undefined;
      const { selectedColumns: cornerColumns, ...cornerSettings } =
        local.cornerPlot.settings;
      writeColumnPreferences(data.datasetKey, {
        crossFiltering: local.crossFiltering,
        logScaleColumns: local.logScaleColumns,
        objectNameColumn: local.objectNameColumn,
        parallelCoordinates: {
          selectedColumns: parallelColumns,
          columnOrder: local.parallelCoordinates.columnOrder,
          settings: {
            ...parallelSettings,
            updateOnBrushEnd: brushModeChanged
              ? parallelSettings.updateOnBrushEnd
              : savedBrushMode
          }
        },
        cornerPlot: {
          selectedColumns: cornerColumns,
          settings: cornerSettings
        }
      });
    }
  });

  // Subscriptions only push changes, so read the current filtering when autosync is enabled
  startListening({
    actionCreator: setAutoSyncOpenSpaceSelection,
    effect: async (action, listenerApi) => {
      if (
        !action.payload ||
        listenerApi.getState().connection.connectionStatus !== ConnectionStatus.Connected
      ) {
        return;
      }
      try {
        const [rows, active] = await Promise.all([
          api.getProperty(
            'Modules.ExoplanetExplorer.FilteredDataRows',
            'IntListProperty'
          ),
          api.getProperty('Modules.ExoplanetExplorer.HasActiveFilters', 'BoolProperty')
        ]);
        if (rows.type === 'property' && Array.isArray(rows.value.value)) {
          listenerApi.dispatch(setFilteredPlanetsFromOpenSpace(rows.value.value));
        }
        if (active.type === 'property' && typeof active.value.value === 'boolean') {
          listenerApi.dispatch(setHasActiveFilters(active.value.value));
        }
      } catch (error) {
        console.error('Could not read OpenSpace filtering:', error);
      }
    }
  });

  startListening({
    actionCreator: onOpenConnection,
    effect: async (_, listenerApi) => {
      listenerApi.dispatch(setupPropertySubscriptions());
    }
  });
};
