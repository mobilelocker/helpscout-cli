/**
 * Help Scout Docs API v1 client.
 * Base URL: https://docsapi.helpscout.net/v1
 * Auth: HTTP Basic (HELPSCOUT_API_KEY : X)
 * Rate limiting: X-RateLimit-Reset (Unix timestamp for reset), 429 on limit
 * Pagination: { page, pages, count, items } envelope
 */
import { USER_AGENT, parseJsonBody } from './http.js';

const BASE_URL = 'https://docsapi.helpscout.net/v1';
const MAX_RETRIES = 3;

function getApiKey() {
  const key = process.env.HELPSCOUT_API_KEY;
  if (!key) {
    throw new Error('HELPSCOUT_API_KEY environment variable is not set.');
  }
  return key;
}

function buildBasicAuth(apiKey) {
  // Docs API uses API key as username, 'X' as password
  return 'Basic ' + Buffer.from(`${apiKey}:X`).toString('base64');
}

async function request(method, path, { body, params } = {}) {
  let url = `${BASE_URL}${path}`;
  if (params) {
    const qs = new URLSearchParams(params);
    url += `?${qs.toString()}`;
  }

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const apiKey = getApiKey();

    const options = {
      method,
      headers: {
        Authorization: buildBasicAuth(apiKey),
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'User-Agent': USER_AGENT,
      },
    };

    if (body !== null && body !== undefined) {
      options.body = JSON.stringify(body);
    }

    const res = await fetch(url, options);

    if (res.status === 429) {
      const resetAt = parseInt(res.headers.get('X-RateLimit-Reset') ?? '0', 10);
      const waitMs = resetAt ? Math.max(0, resetAt * 1000 - Date.now()) : 60000;
      const waitSec = Math.ceil(waitMs / 1000);
      process.stderr.write(`Rate limited. Waiting ${waitSec}s until reset...\n`);
      await sleep(waitMs);
      continue;
    }

    if (res.status === 204) return null;

    if (!res.ok) {
      let message = `HTTP ${res.status}`;
      try {
        const data = await res.json();
        message = data.message ?? data.error ?? message;
      } catch {
        // ignore parse error
      }
      throw Object.assign(new Error(message), { status: res.status });
    }

    return parseJsonBody(res);
  }

  throw new Error('Exceeded maximum retries due to rate limiting.');
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Docs list/search responses wrap items in a resource envelope, e.g.
 * { articles: { page, pages, count, items } } or { collections: { ... } }.
 */
export function extractPagedItems(data) {
  if (!data) return { items: [], pages: 1 };
  if (Array.isArray(data.items)) {
    return { items: data.items, pages: data.pages ?? 1 };
  }
  for (const value of Object.values(data)) {
    if (value && typeof value === 'object' && Array.isArray(value.items)) {
      return { items: value.items, pages: value.pages ?? 1 };
    }
  }
  return { items: [], pages: 1 };
}

// ─── Public API ──────────────────────────────────────────────────────────────

export const docs = {
  /**
   * GET a single page. Returns raw API response.
   */
  async get(path, params) {
    return request('GET', path, { params });
  },

  /**
   * GET all pages of a paginated collection.
   * Docs API uses { page, pages, items } envelope.
   */
  async getAll(path, params = {}) {
    const results = [];
    let page = 1;

    while (true) {
      const data = await request('GET', path, { params: { ...params, page } });
      const { items, pages } = extractPagedItems(data);
      results.push(...items);

      if (page >= pages) break;
      page++;
    }

    return results;
  },

  async post(path, body) {
    return request('POST', path, { body });
  },

  async put(path, body) {
    return request('PUT', path, { body });
  },

  async delete(path) {
    return request('DELETE', path);
  },
};
