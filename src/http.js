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
