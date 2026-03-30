import test from 'node:test';
import assert from 'node:assert';
import AiyifanSource from './sources/aiyifan.js';

function createFetchResponse(body, overrides = {}) {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    url: 'https://example.com/mock',
    headers: {
      entries() {
        return [];
      }
    },
    async text() {
      return typeof body === 'string' ? body : JSON.stringify(body);
    },
    ...overrides,
  };
}

test('Aiyifan requestApi tolerates fw-style responses without status/ret fields', async () => {
  const source = new AiyifanSource();
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async () => createFetchResponse(
    { data: { info: [{ result: [] }] } },
    { status: undefined }
  );

  try {
    const result = await source.requestApi(
      source.SEARCH_API,
      { tags: 'test', orderby: 4, page: 1, size: 10, desc: 1, isserial: -1 },
      '搜索'
    );
    assert.deepEqual(result, { data: { info: [{ result: [] }] } });
  } finally {
    globalThis.fetch = originalFetch;
  }
});
