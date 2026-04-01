/**
 * Help Scout Mailbox API v2 client.
 * Base URL: https://api.helpscout.net/v2
 * Auth: Bearer token (OAuth)
 * Rate limiting: X-RateLimit-Retry-After (seconds until reset)
 * Pagination: HAL _embedded with page.totalPages
 */
import { getAccessToken, forceRefreshToken } from './auth.js';

const BASE_URL = 'https://api.helpscout.net/v2';
const MAX_RETRIES = 3;

/**
 * Make an authenticated request to the Mailbox API.
 * Handles 401 (token refresh via getAccessToken) and 429 (rate limit wait).
 */
async function request(method, path, { body, params } = {}) {
  let url = `${BASE_URL}${path}`;
  if (params) {
    const qs = new URLSearchParams(params);
    url += `?${qs.toString()}`;
  }

  let tokenRefreshed = false;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const token = await getAccessToken();

    const options = {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'User-Agent': 'helpscout-cli/1.0.0',
      },
    };

    if (body !== null && body !== undefined) {
      options.body = JSON.stringify(body);
    }

    const res = await fetch(url, options);

    if (res.status === 401 && !tokenRefreshed) {
      tokenRefreshed = true;
      await forceRefreshToken();
      continue;
    }

    if (res.status === 429) {
      const retryAfter = parseInt(res.headers.get('X-RateLimit-Retry-After') ?? '60', 10);
      process.stderr.write(`Rate limited. Waiting ${retryAfter}s...\n`);
      await sleep(retryAfter * 1000);
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

    return res.json();
  }

  throw new Error('Exceeded maximum retries due to rate limiting.');
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Public API ──────────────────────────────────────────────────────────────

export const mailbox = {
  /**
   * GET a single page. Returns raw API response.
   */
  async get(path, params) {
    return request('GET', path, { params });
  },

  /**
   * GET all pages of a collection.
   * Merges the _embedded array from each page into a flat array.
   * `embedKey` is the key inside `_embedded` (e.g. 'conversations', 'customers').
   */
  async getAll(path, embedKey, params = {}) {
    const results = [];
    let page = 1;

    while (true) {
      const data = await request('GET', path, { params: { ...params, page } });
      const items = data?._embedded?.[embedKey] ?? [];
      results.push(...items);

      const totalPages = data?.page?.totalPages ?? 1;
      if (page >= totalPages) break;
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

  async patch(path, body) {
    return request('PATCH', path, { body });
  },

  async delete(path) {
    return request('DELETE', path);
  },
};
