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
  let capturedAuth = null;
  globalThis.fetch = mock.fn(async (url, opts) => {
    capturedAuth = opts.headers.Authorization;
    return {
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: async () => ({}),
    };
  });
  process.env.HELPSCOUT_API_KEY = 'mykey';

  const { docs } = await import('../src/docs-client.js');
  await docs.get('/articles');

  const expected = 'Basic ' + Buffer.from('mykey:X').toString('base64');
  assert.equal(capturedAuth, expected);
});
