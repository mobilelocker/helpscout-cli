/**
 * Integration tests for the Mailbox API client.
 * Requires HELPSCOUT_APP_ID, HELPSCOUT_APP_SECRET, and a valid cached token
 * (~/.cache/helpscout/token.json). Run `helpscout auth login` first.
 * Tests are skipped automatically when credentials are absent so they don't break CI.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const tokenCached = existsSync(path.join(os.homedir(), '.cache', 'helpscout', 'token.json'));
const skip = !process.env.HELPSCOUT_APP_ID || !process.env.HELPSCOUT_APP_SECRET || !tokenCached;

test('list_mailboxes returns at least one mailbox', { skip }, async () => {
  const { mailbox } = await import('../../src/mailbox-client.js');
  const mailboxes = await mailbox.getAll('/mailboxes', 'mailboxes');
  assert.ok(Array.isArray(mailboxes));
  assert.ok(mailboxes.length > 0, 'expected at least one mailbox');
  assert.ok(mailboxes[0].id, 'mailbox should have an id');
  assert.ok(mailboxes[0].name, 'mailbox should have a name');
});

test('list_conversations returns an array', { skip }, async () => {
  const { mailbox } = await import('../../src/mailbox-client.js');
  const result = await mailbox.get('/conversations');
  assert.ok(Array.isArray(result?._embedded?.conversations ?? []));
});

test('list_users returns at least one user', { skip }, async () => {
  const { mailbox } = await import('../../src/mailbox-client.js');
  const users = await mailbox.getAll('/users', 'users');
  assert.ok(Array.isArray(users));
  assert.ok(users.length > 0, 'expected at least one user');
  assert.ok(users[0].id, 'user should have an id');
  assert.ok(users[0].email, 'user should have an email');
});

test('get_current_user returns the authenticated user', { skip }, async () => {
  const { mailbox } = await import('../../src/mailbox-client.js');
  const user = await mailbox.get('/users/me');
  assert.ok(user.id, 'user should have an id');
  assert.ok(user.email, 'user should have an email');
});
