/**
 * Tests for src/mailbox-client.js
 * Stubs global fetch and the auth module's getAccessToken.
 */
import { test, mock, before } from 'node:test';
import assert from 'node:assert/strict';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeFetchStub(responses) {
  let callIndex = 0;
  return mock.fn(async () => {
    const resp = responses[callIndex++] ?? responses[responses.length - 1];
    return {
      ok: resp.ok ?? true,
      status: resp.status ?? 200,
      headers: {
        get: (h) => resp.headers?.[h] ?? null,
      },
      json: async () => resp.body,
      text: async () => JSON.stringify(resp.body),
    };
  });
}

// ─── Setup ────────────────────────────────────────────────────────────────────

before(async () => {
  const { writeFile, mkdir } = await import('node:fs/promises');
  const os = await import('node:os');
  const path = await import('node:path');
  const cacheDir = path.join(os.homedir(), '.cache', 'helpscout');
  await mkdir(cacheDir, { recursive: true });
  await writeFile(
    path.join(cacheDir, 'token.json'),
    JSON.stringify({
      access_token: 'test-token',
      refresh_token: 'test-refresh',
      expires_at: Date.now() + 3_600_000,
    }),
  );
});

// ─── Tests ────────────────────────────────────────────────────────────────────

test('mailbox.get returns parsed JSON body', async () => {
  const expectedBody = { _embedded: { conversations: [{ id: 1 }] }, page: { totalPages: 1 } };

  // Patch globals before importing the module under test
  globalThis.fetch = makeFetchStub([{ body: expectedBody }]);

  // auth.js calls getAccessToken — patch the module by overriding env
  process.env.HELPSCOUT_APP_ID = 'test-app-id';
  process.env.HELPSCOUT_APP_SECRET = 'test-app-secret';

  const { mailbox } = await import('../src/mailbox-client.js');
  const result = await mailbox.get('/conversations');
  assert.deepEqual(result, expectedBody);
});

test('mailbox.getAll fetches all pages and flattens', async () => {
  const page1 = {
    _embedded: { conversations: [{ id: 1 }, { id: 2 }] },
    page: { totalPages: 2 },
  };
  const page2 = {
    _embedded: { conversations: [{ id: 3 }] },
    page: { totalPages: 2 },
  };

  globalThis.fetch = makeFetchStub([{ body: page1 }, { body: page2 }]);

  const { mailbox } = await import('../src/mailbox-client.js');
  const results = await mailbox.getAll('/conversations', 'conversations');
  assert.equal(results.length, 3);
  assert.equal(results[2].id, 3);
});

test('mailbox.get handles 429 and retries after wait', async () => {
  const rateLimitResponse = {
    ok: false,
    status: 429,
    headers: { 'X-RateLimit-Retry-After': '0' }, // 0 seconds so test doesn't wait
  };
  const successResponse = { body: { id: 1 } };

  globalThis.fetch = makeFetchStub([rateLimitResponse, successResponse]);

  const { mailbox } = await import('../src/mailbox-client.js');
  const result = await mailbox.get('/conversations/1');
  assert.deepEqual(result, { id: 1 });
});

test('mailbox.get retries once on 401 by refreshing the token', async () => {
  // First call returns 401, second succeeds after token refresh
  const unauthorizedResponse = {
    ok: false,
    status: 401,
    body: { error: 'invalid_token' },
  };
  const successResponse = { body: { id: 42 } };

  let fetchCallCount = 0;
  globalThis.fetch = mock.fn(async (url, _opts) => {
    fetchCallCount++;
    // Stub the token refresh endpoint to succeed
    if (url.includes('oauth2/token')) {
      return {
        ok: true,
        status: 200,
        headers: { get: () => null },
        json: async () => ({
          access_token: 'refreshed-token',
          refresh_token: 'new-refresh',
          expires_in: 172800,
        }),
      };
    }
    const resp = fetchCallCount === 1 ? unauthorizedResponse : successResponse;
    return {
      ok: resp.ok ?? true,
      status: resp.status ?? 200,
      headers: { get: () => null },
      json: async () => resp.body,
      text: async () => JSON.stringify(resp.body),
    };
  });

  const { mailbox } = await import('../src/mailbox-client.js');
  const result = await mailbox.get('/conversations/42');
  assert.deepEqual(result, { id: 42 });
  assert.equal(fetchCallCount, 3); // 1 failing API call + 1 token refresh + 1 retry
});

test('mailbox requests include correct User-Agent header', async () => {
  let capturedUserAgent = null;
  globalThis.fetch = mock.fn(async (url, opts) => {
    capturedUserAgent = opts.headers['User-Agent'];
    return {
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: async () => ({}),
    };
  });

  const { mailbox } = await import('../src/mailbox-client.js');
  await mailbox.get('/conversations');
  assert.equal(capturedUserAgent, 'helpscout-cli/1.0.0');
});
