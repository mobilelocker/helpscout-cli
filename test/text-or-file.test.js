import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { resolveTextOrFile } from '../src/text-or-file.js';

test('resolveTextOrFile returns inline text when provided', async () => {
  const text = await resolveTextOrFile({ text: '<p>Hello</p>' });
  assert.equal(text, '<p>Hello</p>');
});

test('resolveTextOrFile allows empty string inline text', async () => {
  const text = await resolveTextOrFile({ text: '' });
  assert.equal(text, '');
});

test('resolveTextOrFile returns undefined when neither source is set and not required', async () => {
  const text = await resolveTextOrFile({});
  assert.equal(text, undefined);
});

test('resolveTextOrFile requires text or file when required', async () => {
  await assert.rejects(
    () => resolveTextOrFile({ required: true }),
    /Either text or filePath is required/,
  );
});

test('resolveTextOrFile rejects both text and filePath', async () => {
  await assert.rejects(
    () => resolveTextOrFile({ text: '<p>x</p>', filePath: '/tmp/body.html' }),
    /Provide either text or filePath, not both/,
  );
});

test('resolveTextOrFile uses custom param names in errors', async () => {
  await assert.rejects(
    () =>
      resolveTextOrFile({
        text: 'a',
        filePath: '/tmp/a.html',
        paramNames: { text: '--body', file: '--file' },
      }),
    /Provide either --body or --file, not both/,
  );
  await assert.rejects(
    () =>
      resolveTextOrFile({
        required: true,
        paramNames: { text: '--text', file: '--file' },
      }),
    /Either --text or --file is required/,
  );
});

test('resolveTextOrFile reads body from file', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'helpscout-text-or-file-'));
  const filePath = join(dir, 'body.html');
  try {
    writeFileSync(filePath, '<p>From file</p>\n', 'utf8');
    const text = await resolveTextOrFile({ filePath });
    assert.equal(text, '<p>From file</p>\n');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('resolveTextOrFile errors clearly when file is missing', async () => {
  await assert.rejects(
    () => resolveTextOrFile({ filePath: '/tmp/helpscout-no-such-text-file-xyz.html' }),
    /File not found/,
  );
});

test('resolveTextOrFile treats empty filePath as unset', async () => {
  const text = await resolveTextOrFile({ filePath: '', text: '<p>fallback</p>' });
  assert.equal(text, '<p>fallback</p>');
});

test('resolveTextOrFile treats null text as unset when required with file', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'helpscout-text-or-file-null-'));
  const filePath = join(dir, 'body.html');
  try {
    writeFileSync(filePath, 'from-file', 'utf8');
    const text = await resolveTextOrFile({ text: null, filePath, required: true });
    assert.equal(text, 'from-file');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('resolveTextOrFile can use body param name for conversation create errors', async () => {
  await assert.rejects(
    () =>
      resolveTextOrFile({
        text: 'a',
        filePath: '/tmp/x.html',
        paramNames: { text: 'body', file: 'filePath' },
      }),
    /Provide either body or filePath, not both/,
  );
});
