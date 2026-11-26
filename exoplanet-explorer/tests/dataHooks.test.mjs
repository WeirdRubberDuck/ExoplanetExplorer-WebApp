import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';

import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { Provider } from 'react-redux';
import { createServer } from 'vite';

let server;
let useBaseDataset;
let useHoveredDatasetItem;

before(async () => {
  server = await createServer({
    server: { middlewareMode: true, hmr: false, ws: false },
    optimizeDeps: { noDiscovery: true },
    appType: 'custom'
  });
  ({ useBaseDataset, useHoveredDatasetItem } =
    await server.ssrLoadModule('/src/hooks/data.ts'));
});

after(async () => {
  await server?.close();
});

function renderDataHooks(state) {
  let result;
  const store = {
    getState: () => state,
    subscribe: () => () => {},
    dispatch: () => {}
  };

  function TestComponent() {
    const data = useBaseDataset();
    result = { data, hovered: useHoveredDatasetItem(data) };
    return null;
  }

  renderToString(createElement(Provider, { store }, createElement(TestComponent)));
  return result;
}

test('skips filtering when OpenSpace synchronization is inactive', () => {
  const rows = [{ id: 0 }, { id: 1 }];
  const ids = [1];
  ids[Symbol.iterator] = () => {
    throw new Error('Inactive filters must not be traversed');
  };
  const state = {
    data: { full: rows, filteredPlanetsFromOpenSpace: ids, hasActiveFilters: true },
    local: { autoSyncOpenSpaceSelection: false, hoveredId: 0 }
  };

  const result = renderDataHooks(state);
  assert.equal(result.data, rows);
  assert.equal(result.hovered, rows[0]);
});

test('shares filtered rows and only highlights IDs in the base dataset', () => {
  const rows = Array.from({ length: 300_000 }, (_, id) => ({ id }));
  const ids = [299_999, 0, 0];
  ids.includes = () => {
    throw new Error('Filtering must not scan the ID array per row');
  };
  const state = {
    data: { full: rows, filteredPlanetsFromOpenSpace: ids, hasActiveFilters: true },
    local: { autoSyncOpenSpaceSelection: true, hoveredId: 299_999 }
  };

  const result = renderDataHooks(state);
  assert.deepEqual(result.data, [rows[0], rows[299_999]]);
  assert.equal(result.hovered, rows[299_999]);
  assert.equal(renderDataHooks(state).data, result.data);

  const otherHover = { ...state, local: { ...state.local, hoveredId: 1 } };
  assert.equal(renderDataHooks(otherHover).hovered, undefined);
});

test('preserves empty and unavailable OpenSpace filter semantics', () => {
  const rows = [{ id: 0 }, { id: 1 }];
  const state = {
    data: { full: rows, filteredPlanetsFromOpenSpace: [], hasActiveFilters: true },
    local: { autoSyncOpenSpaceSelection: true, hoveredId: 0 }
  };

  assert.deepEqual(renderDataHooks(state).data, []);
  assert.equal(renderDataHooks(state).hovered, undefined);
  const unavailable = {
    ...state,
    data: { ...state.data, filteredPlanetsFromOpenSpace: undefined }
  };
  assert.equal(renderDataHooks(unavailable).data, rows);
  const inactive = {
    ...state,
    data: { ...state.data, filteredPlanetsFromOpenSpace: [1], hasActiveFilters: false }
  };
  assert.equal(renderDataHooks(inactive).data, rows);
});
