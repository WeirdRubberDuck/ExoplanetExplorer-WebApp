import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';

import { configureStore, createListenerMiddleware } from '@reduxjs/toolkit';
import { createServer } from 'vite';

let server;
let localSlice;
let preferences;
let resolveDatasetColumns;

before(async () => {
  server = await createServer({
    server: { middlewareMode: true, hmr: false, ws: false },
    optimizeDeps: { noDiscovery: true },
    ssr: { noExternal: ['openspace-api-js'] },
    cacheDir: 'node_modules/.vite-brush-settings-test',
    appType: 'custom'
  });
  localSlice = await server.ssrLoadModule('/src/redux/local/localSlice.ts');
  preferences = await server.ssrLoadModule('/src/utils/columnPreferences.ts');
  ({ resolveDatasetColumns } = await server.ssrLoadModule(
    '/src/utils/datasetColumns.ts'
  ));
  const storage = new Map();
  globalThis.localStorage = {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value)
  };
});

after(async () => {
  delete globalThis.localStorage;
  await server?.close();
});

test('brush updates remain live by default and can be changed', () => {
  const initial = localSlice.localSlice.reducer(undefined, { type: 'test' });
  assert.equal(initial.parallelCoordinates.settings.updateOnBrushEnd, false);

  const changed = localSlice.localSlice.reducer(
    initial,
    localSlice.setParallelCoordinatesSettings({ updateOnBrushEnd: true })
  );
  assert.equal(changed.parallelCoordinates.settings.updateOnBrushEnd, true);
});

test('saved brush mode is restored and invalid or missing values use the default', () => {
  const base = {
    parallelCoordinates: { selectedColumns: ['value'], columnOrder: ['value'] },
    cornerPlot: { selectedColumns: ['value'] }
  };
  const columnData = { value: { type: 'number', min: 0, max: 1 } };

  function initializeWith(value, key) {
    preferences.writeColumnPreferences(key, {
      ...base,
      parallelCoordinates: { ...base.parallelCoordinates, settings: value }
    });
    const saved = preferences.readColumnPreferences(key);
    return localSlice.localSlice.reducer(
      undefined,
      localSlice.initializeDatasetColumns(
        resolveDatasetColumns(['value'], columnData, saved)
      )
    ).parallelCoordinates.settings.updateOnBrushEnd;
  }

  assert.equal(initializeWith({ updateOnBrushEnd: true }, 'enabled'), true);
  assert.equal(initializeWith({ updateOnBrushEnd: false }, 'disabled'), false);
  assert.equal(initializeWith({ updateOnBrushEnd: 'true' }, 'invalid'), false);
  assert.equal(initializeWith({}, 'missing'), false);
});

test('large datasets default to updating on release unless a preference is saved', () => {
  const columnData = { value: { type: 'number', min: 0, max: 1 } };
  const saved = {
    parallelCoordinates: {
      selectedColumns: ['value'],
      columnOrder: ['value'],
      settings: { updateOnBrushEnd: false }
    },
    cornerPlot: { selectedColumns: ['value'] }
  };

  function brushMode(rowCount, preferences) {
    const resolved = resolveDatasetColumns(['value'], columnData, preferences, rowCount);
    return localSlice.localSlice.reducer(
      undefined,
      localSlice.initializeDatasetColumns(resolved)
    ).parallelCoordinates.settings.updateOnBrushEnd;
  }

  assert.equal(brushMode(10_000), false);
  assert.equal(brushMode(10_001), true);
  assert.equal(brushMode(300_000), true);
  assert.equal(brushMode(300_000, saved), false);
  saved.parallelCoordinates.settings.updateOnBrushEnd = true;
  assert.equal(brushMode(10, saved), true);
});

test('reports automatic disabling only until the user changes brush mode', () => {
  const columnData = { value: { type: 'number', min: 0, max: 1 } };
  const initialize = (rowCount, saved) =>
    localSlice.localSlice.reducer(
      undefined,
      localSlice.initializeDatasetColumns(
        resolveDatasetColumns(['value'], columnData, saved, rowCount)
      )
    );
  const automatic = initialize(10_001);
  assert.equal(automatic.parallelCoordinates.liveBrushingDisabledForLargeDataset, true);
  assert.equal(
    initialize(10_000).parallelCoordinates.liveBrushingDisabledForLargeDataset,
    false
  );

  const otherSettingChanged = localSlice.localSlice.reducer(
    automatic,
    localSlice.setParallelCoordinatesSettings({ lineOpacity: 0.5 })
  );
  assert.equal(
    otherSettingChanged.parallelCoordinates.liveBrushingDisabledForLargeDataset,
    true
  );

  const changed = localSlice.localSlice.reducer(
    automatic,
    localSlice.setParallelCoordinatesSettings({ updateOnBrushEnd: false })
  );
  assert.equal(changed.parallelCoordinates.liveBrushingDisabledForLargeDataset, false);
  const changedBack = localSlice.localSlice.reducer(
    changed,
    localSlice.setParallelCoordinatesSettings({ updateOnBrushEnd: true })
  );
  assert.equal(
    changedBack.parallelCoordinates.liveBrushingDisabledForLargeDataset,
    false
  );

  const saved = {
    parallelCoordinates: {
      selectedColumns: ['value'],
      columnOrder: ['value'],
      settings: { updateOnBrushEnd: true }
    },
    cornerPlot: { selectedColumns: ['value'] }
  };
  assert.equal(
    initialize(10_001, saved).parallelCoordinates.liveBrushingDisabledForLargeDataset,
    false
  );
});

test('only explicit brush changes are saved by the preference listener', async () => {
  const previousWindow = globalThis.window;
  globalThis.window = { location: { search: '' } };
  try {
    const { addDataListener } = await server.ssrLoadModule(
      '/src/redux/data/dataMiddleware.ts'
    );
    const dataSlice = await server.ssrLoadModule('/src/redux/data/dataSlice.ts');
    const middleware = createListenerMiddleware();
    addDataListener(middleware.startListening);
    const store = configureStore({
      reducer: { data: dataSlice.default, local: localSlice.localSlice.reducer },
      middleware: (getDefaultMiddleware) =>
        getDefaultMiddleware({ serializableCheck: false }).prepend(middleware.middleware)
    });
    const rows = Array.from({ length: 10_001 }, (_, value) => ({ value }));
    const load = (datasetRows = rows) =>
      store.dispatch(
        dataSlice.initializeData({
          rows: datasetRows,
          source: { kind: 'file', name: 'listener-test.csv' }
        })
      );

    load();
    assert.equal(
      store.getState().local.parallelCoordinates.liveBrushingDisabledForLargeDataset,
      true
    );
    store.dispatch(localSlice.setParallelCoordinatesSettings({ showGhostLines: false }));
    const key = store.getState().data.datasetKey;
    assert.equal(
      preferences.readColumnPreferences(key).parallelCoordinates.settings
        .updateOnBrushEnd,
      undefined
    );
    load();
    assert.equal(
      store.getState().local.parallelCoordinates.liveBrushingDisabledForLargeDataset,
      true
    );
    assert.equal(
      store.getState().local.parallelCoordinates.settings.showGhostLines,
      false
    );
    load(rows.slice(0, 10));
    assert.equal(
      store.getState().local.parallelCoordinates.settings.updateOnBrushEnd,
      false
    );
    load();
    assert.equal(
      store.getState().local.parallelCoordinates.liveBrushingDisabledForLargeDataset,
      true
    );

    store.dispatch(
      localSlice.setParallelCoordinatesSettings({ updateOnBrushEnd: false })
    );
    store.dispatch(localSlice.setParallelCoordinatesSettings({ showGhostLines: true }));
    load();
    assert.equal(
      store.getState().local.parallelCoordinates.settings.updateOnBrushEnd,
      false
    );
    assert.equal(
      store.getState().local.parallelCoordinates.liveBrushingDisabledForLargeDataset,
      false
    );
    store.dispatch(localSlice.setParallelCoordinatesSettings({ updateOnBrushEnd: true }));
    store.dispatch(localSlice.setParallelCoordinatesSettings({ showGhostLines: false }));
    load(rows.slice(0, 10));
    assert.equal(
      store.getState().local.parallelCoordinates.settings.updateOnBrushEnd,
      true
    );
    assert.equal(
      store.getState().local.parallelCoordinates.liveBrushingDisabledForLargeDataset,
      false
    );
  } finally {
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
  }
});
