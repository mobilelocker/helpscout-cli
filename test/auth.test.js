/**
 * Tests for src/auth.js — status() and logout() return shapes.
 * login() is not tested as it requires browser interaction.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFile, mkdir, unlink } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const CACHE_DIR = path.join(os.homedir(), '.cache', 'helpscout');
const CACHE_FILE = path.join(CACHE_DIR, 'token.json');

async function writeToken(overrides = {}) {
  await mkdir(CACHE_DIR, { recursive: true });
  await writeFile(
    CACHE_FILE,
    JSON.stringify({
      access_token: 'test-token',
      refresh_token: 'test-refresh',
      expires_at: Date.now() + 3_600_000, // 1 hour from now
      ...overrides,
    }),
  );
}

async function removeToken() {
  if (existsSync(CACHE_FILE)) await unlink(CACHE_FILE);
}

test('status() returns authenticated:false when no token cached', async () => {
  await removeToken();
  const { status } = await import('../src/auth.js');
  const result = await status();
  assert.equal(result.authenticated, false);
  assert.ok(result.message);
});

test('status() returns authenticated:true with expiresInMinutes when token is valid', async () => {
  await writeToken();
  const { status } = await import('../src/auth.js');
  const result = await status();
  assert.equal(result.authenticated, true);
  assert.ok(result.expiresInMinutes > 0);
  assert.ok(result.message);
});

test('status() returns authenticated:false when token is expired', async () => {
  await writeToken({ expires_at: Date.now() - 1000 });
  const { status } = await import('../src/auth.js');
  const result = await status();
  assert.equal(result.authenticated, false);
  assert.ok(result.message);
});

test('logout() returns ok:true and removes the token file', async () => {
  await writeToken();
  const { logout } = await import('../src/auth.js');
  const result = await logout();
  assert.equal(result.ok, true);
  assert.ok(result.message);
  assert.equal(existsSync(CACHE_FILE), false);
});

test('logout() returns ok:true even when no token exists', async () => {
  await removeToken();
  const { logout } = await import('../src/auth.js');
  const result = await logout();
  assert.equal(result.ok, true);
  assert.ok(result.message);
});
