/**
 * Tests for src/docs-client.js
 * Stubs global fetch. No OAuth needed — uses Basic Auth.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

function makeFetchStub(responses) {
  let callIndex = 0;
  return mock.fn(async () => {
    const resp = responses[callIndex++] ?? responses[responses.length - 1];
    return {
      ok: resp.ok ?? true,
      status: resp.status ?? 200,
      headers: { get: (h) => resp.headers?.[h] ?? null },
      json: async () => resp.body,
      text: async () => JSON.stringify(resp.body),
    };
  });
}

import { mock } from 'node:test';

test('docs.get returns parsed body', async () => {
  const expectedBody = { articles: { items: [{ id: 'abc', name: 'Test' }], pages: 1 } };
  globalThis.fetch = makeFetchStub([{ body: expectedBody }]);
  process.env.HELPSCOUT_API_KEY = 'test-api-key';

  const { docs } = await import('../src/docs-client.js');
  const result = await docs.get('/articles');
  assert.deepEqual(result, expectedBody);
});

test('docs.getAll fetches all pages', async () => {
  const page1 = { items: [{ id: 'a' }, { id: 'b' }], pages: 2, page: 1 };
  const page2 = { items: [{ id: 'c' }], pages: 2, page: 2 };
  globalThis.fetch = makeFetchStub([{ body: page1 }, { body: page2 }]);
  process.env.HELPSCOUT_API_KEY = 'test-api-key';

  const { docs } = await import('../src/docs-client.js');
  const results = await docs.getAll('/articles');
  assert.equal(results.length, 3);
});

test('docs.getAll unwraps nested resource envelopes', async () => {
  const page1 = {
    articles: { items: [{ id: 'a' }, { id: 'b' }], pages: 2, page: 1 },
  };
  const page2 = {
    articles: { items: [{ id: 'c' }], pages: 2, page: 2 },
  };
  globalThis.fetch = makeFetchStub([{ body: page1 }, { body: page2 }]);
  process.env.HELPSCOUT_API_KEY = 'test-api-key';

  const { docs } = await import('../src/docs-client.js');
  const results = await docs.getAll('/search/articles', { query: 'fax' });
  assert.equal(results.length, 3);
});

test('extractPagedItems finds items in nested envelopes', async () => {
  const { extractPagedItems } = await import('../src/docs-client.js');
  assert.deepEqual(extractPagedItems({ articles: { items: [{ id: 1 }], pages: 3 } }), {
    items: [{ id: 1 }],
    pages: 3,
  });
});

test('docs.get handles 429 and waits for reset', async () => {
  const past = Math.floor((Date.now() - 1000) / 1000); // 1 second ago = no wait
  const rateLimitResponse = {
    ok: false,
    status: 429,
    headers: { 'X-RateLimit-Reset': String(past) },
  };
  const successResponse = { body: { articles: { items: [] } } };
  globalThis.fetch = makeFetchStub([rateLimitResponse, successResponse]);
  process.env.HELPSCOUT_API_KEY = 'test-api-key';

  const { docs } = await import('../src/docs-client.js');
  const result = await docs.get('/articles');
  assert.ok(result);
});

test('docs.get sends correct Basic Auth header', async () => {
  const fetchStub = makeFetchStub([{ body: {} }]);
  globalThis.fetch = fetchStub;
  process.env.HELPSCOUT_API_KEY = 'mykey';

  const { docs } = await import('../src/docs-client.js');
  await docs.get('/articles');

  const expected = 'Basic ' + Buffer.from('mykey:X').toString('base64');
  assert.equal(fetchStub.mock.calls[0].arguments[1].headers.Authorization, expected);
});

function makeEmptyBodyFetchStub(responses) {
  let callIndex = 0;
  return mock.fn(async () => {
    const resp = responses[callIndex++] ?? responses[responses.length - 1];
    const text = resp.text ?? (resp.body !== undefined ? JSON.stringify(resp.body) : '');
    return {
      ok: resp.ok ?? true,
      status: resp.status ?? 200,
      headers: { get: (h) => resp.headers?.[h] ?? null },
      json: async () => (text.trim() ? JSON.parse(text) : null),
      text: async () => text,
    };
  });
}

test('docs.post returns id from Location header on 201 empty body', async () => {
  globalThis.fetch = makeEmptyBodyFetchStub([
    {
      status: 201,
      headers: { Location: 'https://docsapi.helpscout.net/v1/articles/abc123' },
      text: '',
    },
  ]);
  process.env.HELPSCOUT_API_KEY = 'test-api-key';

  const { docs } = await import('../src/docs-client.js');
  const result = await docs.post('/articles', { collectionId: 'c1', name: 'Test' });
  assert.deepEqual(result, {
    id: 'abc123',
    location: 'https://docsapi.helpscout.net/v1/articles/abc123',
  });
});

test('docs.post passes reload=true query param', async () => {
  const fetchStub = makeEmptyBodyFetchStub([
    {
      status: 201,
      body: { article: { id: 'full-id', name: 'Reloaded' } },
    },
  ]);
  globalThis.fetch = fetchStub;
  process.env.HELPSCOUT_API_KEY = 'test-api-key';

  const { docs } = await import('../src/docs-client.js');
  const result = await docs.post(
    '/articles',
    { collectionId: 'c1', name: 'Test' },
    { reload: 'true' },
  );
  assert.deepEqual(result, { id: 'full-id', name: 'Reloaded' });
  const url = fetchStub.mock.calls[0].arguments[0];
  assert.match(url, /reload=true/);
});

test('docs.upload returns JSON body for asset upload', async () => {
  const assetBody = { filelink: 'https://cdn.example.com/img.png', filename: 'img.png' };
  globalThis.fetch = makeEmptyBodyFetchStub([{ status: 201, body: assetBody }]);
  process.env.HELPSCOUT_API_KEY = 'test-api-key';

  const { docs } = await import('../src/docs-client.js');
  const form = new FormData();
  form.append('file', new Blob(['x']), 'img.png');
  const result = await docs.upload('/assets/article', form);
  assert.deepEqual(result, assetBody);
});
