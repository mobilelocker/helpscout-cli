/**
 * Shared HTTP helpers for the Mailbox and Docs API clients.
 */
import pkg from '../package.json' with { type: 'json' };

export const USER_AGENT = `helpscout-cli/${pkg.version}`;

/**
 * Parse a fetch Response body as JSON, tolerating a 200/201 response with an
 * empty body (some Help Scout write endpoints return no payload, just a
 * Location header).
 */
export async function parseJsonBody(res) {
  const text = await res.text();
  if (!text.trim()) return null;
  return JSON.parse(text);
}

/**
 * Extract resource id from a Help Scout Location header URL.
 */
export function parseLocationId(location) {
  if (!location) return null;
  const trimmed = location.replace(/\/$/, '');
  const id = trimmed.split('/').pop();
  return id || null;
}

/**
 * Unwrap Docs API single-item envelopes such as { article: { id, ... } }.
 */
export function unwrapSingleItemEnvelope(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return data;
  if ('id' in data) return data;

  for (const value of Object.values(data)) {
    if (value && typeof value === 'object' && !Array.isArray(value) && 'id' in value) {
      return value;
    }
  }

  return data;
}

/**
 * Build a create-response object from headers when the body is empty.
 * Mailbox API uses Resource-ID; Docs API uses Location.
 */
export function parseCreatedResponse(res, parsedBody) {
  if (parsedBody !== null && parsedBody !== undefined) {
    return unwrapSingleItemEnvelope(parsedBody);
  }

  if (res.status !== 201) return null;

  const resourceId = res.headers.get('Resource-ID');
  const location = res.headers.get('Location');

  if (resourceId) {
    const numericId = Number(resourceId);
    return {
      id: Number.isNaN(numericId) ? resourceId : numericId,
      ...(location ? { location } : {}),
    };
  }

  if (location) {
    const id = parseLocationId(location);
    return id ? { id, location } : null;
  }

  return null;
}

/**
 * Normalize Docs/Mailbox write responses for CLI and MCP output.
 */
export function normalizeWriteResponse(data, fallback = { ok: true }) {
  if (data === null || data === undefined) return fallback;
  const unwrapped = unwrapSingleItemEnvelope(data);
  if (unwrapped && typeof unwrapped === 'object' && 'id' in unwrapped) return unwrapped;
  if (unwrapped && typeof unwrapped === 'object' && Object.keys(unwrapped).length > 0) {
    return unwrapped;
  }
  return fallback;
}
