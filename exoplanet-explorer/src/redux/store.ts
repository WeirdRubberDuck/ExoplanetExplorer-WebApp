import { configureStore } from '@reduxjs/toolkit';

import { startupConfig } from '@/utils/urlConfig';

import { connectionReducer } from './connection/connectionSlice';
import { dataSlice, setFilteredPlanetsFromOpenSpace } from './data/dataSlice';
import {
  localSlice,
  setAutoSyncOpenSpaceSelection,
  setCornerPlotFilteredIds,
  setParallelCoordinatesFilteredIds
} from './local/localSlice';
import { listenerMiddleware } from './listenerMiddleware';

export const store = configureStore({
  reducer: {
    data: dataSlice.reducer,
    connection: connectionReducer,
    local: localSlice.reducer
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredPaths: [
          'data.full',
          'data.uncertainty',
          'data.columnData',
          'data.filteredPlanetsFromOpenSpace',
          'local.parallelCoordinates.filteredIds',
          'local.cornerPlot.filteredIds'
        ],
        ignoredActionPaths: ['meta.arg', 'meta.baseQueryMeta', 'payload.rows'],
        ignoredActions: [
          setFilteredPlanetsFromOpenSpace.type,
          setParallelCoordinatesFilteredIds.type,
          setCornerPlotFilteredIds.type
        ]
      }
    }).concat([listenerMiddleware.middleware])
});

if (startupConfig.autoSync !== undefined) {
  store.dispatch(setAutoSyncOpenSpaceSelection(startupConfig.autoSync));
}

// Infer the `RootState` and `AppDispatch` types from the store itself
export type RootState = ReturnType<typeof store.getState>;
// Inferred type: {posts: PostsState, comments: CommentsState, users: UsersState}
export type AppDispatch = typeof store.dispatch;
