import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';

import { createServer } from 'vite';

let server;
let reducer;
let initializeData;

before(async () => {
  server = await createServer({
    server: { middlewareMode: true },
    optimizeDeps: { noDiscovery: true },
    appType: 'custom'
  });
  const dataSlice = await server.ssrLoadModule('/src/redux/data/dataSlice.ts');
  reducer = dataSlice.default;
  initializeData = dataSlice.initializeData;
});

after(async () => {
  await server?.close();
});

test('initializes numeric columns with 300,000 rows', () => {
  const rows = Array.from({ length: 300_000 }, (_, index) => ({
    value: index - 150_000
  }));
  const state = reducer(
    undefined,
    initializeData({ rows, source: { kind: 'builtin', name: 'test' } })
  );

  assert.equal(state.full.length, 300_000);
  assert.equal(state.full[299_999].id, 299_999);
  assert.deepEqual(state.columnData.value, {
    type: 'number',
    min: -150_000,
    max: 149_999,
    isUncertainty: false
  });
});

test('preserves numeric classification, categories, and signed zero', () => {
  const rows = [
    { number: '-3', boundary: '1', zero: 0 },
    { number: '2', boundary: '2', zero: -0 },
    { number: null, boundary: '3', zero: null },
    { number: ' ', boundary: '4', zero: '' },
    { number: '1', boundary: 'other', zero: null }
  ];
  const state = reducer(
    undefined,
    initializeData({ rows, source: { kind: 'builtin', name: 'test' } })
  );

  assert.deepEqual(state.columnData.number, {
    type: 'number',
    min: -3,
    max: 2,
    isUncertainty: false
  });
  assert.deepEqual(state.columnData.boundary, {
    type: 'string',
    categories: ['1', '2', '3', '4', 'other']
  });
  assert.equal(state.columnData.zero.type, 'number');
  assert.ok(Object.is(state.columnData.zero.min, -0));
  assert.ok(Object.is(state.columnData.zero.max, 0));
});
