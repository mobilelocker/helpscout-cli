import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shouldPretty, makeTable, makeMarkdownTable, getOutputFormat } from '../src/output.js';

test('shouldPretty: returns false when --json flag is set', () => {
  assert.equal(shouldPretty({ json: true }), false);
});

test('shouldPretty: returns true when --pretty flag is set', () => {
  assert.equal(shouldPretty({ pretty: true }), true);
});

test('shouldPretty: --json takes priority over --pretty', () => {
  assert.equal(shouldPretty({ json: true, pretty: true }), false);
});

test('shouldPretty: defaults to process.stdout.isTTY when no flags set', () => {
  const expected = Boolean(process.stdout.isTTY);
  assert.equal(shouldPretty({}), expected);
});

test('makeTable: renders rows with correct column mapping', () => {
  const rows = [
    { id: 1, name: 'Alice', email: 'alice@example.com' },
    { id: 2, name: 'Bob', email: 'bob@example.com' },
  ];
  const columns = [
    { key: 'id', header: 'ID' },
    { key: 'name', header: 'Name' },
    { key: 'email', header: 'Email' },
  ];
  const result = makeTable(rows, columns);
  assert.ok(result.includes('Alice'));
  assert.ok(result.includes('bob@example.com'));
  assert.ok(result.includes('ID'));
  assert.ok(result.includes('Name'));
});

test('makeTable: handles missing values gracefully', () => {
  const rows = [{ id: 1 }];
  const columns = [
    { key: 'id', header: 'ID' },
    { key: 'missing', header: 'Missing' },
  ];
  const result = makeTable(rows, columns);
  assert.ok(result.includes('1'));
});

test('makeTable: serializes object values as JSON', () => {
  const rows = [{ id: 1, meta: { key: 'val' } }];
  const columns = [
    { key: 'id', header: 'ID' },
    { key: 'meta', header: 'Meta' },
  ];
  const result = makeTable(rows, columns);
  assert.ok(result.includes('"key"'));
});

// ─── getOutputFormat ──────────────────────────────────────────────────────────

test('getOutputFormat: returns json when --json flag is set', () => {
  assert.equal(getOutputFormat({ json: true }), 'json');
});

test('getOutputFormat: json takes priority over markdown and pretty', () => {
  assert.equal(getOutputFormat({ json: true, markdown: true, pretty: true }), 'json');
});

test('getOutputFormat: returns markdown when --markdown flag is set', () => {
  assert.equal(getOutputFormat({ markdown: true }), 'markdown');
});

test('getOutputFormat: markdown takes priority over pretty', () => {
  assert.equal(getOutputFormat({ markdown: true, pretty: true }), 'markdown');
});

test('getOutputFormat: returns pretty when --pretty flag is set', () => {
  assert.equal(getOutputFormat({ pretty: true }), 'pretty');
});

test('shouldPretty: returns true when --markdown flag is set', () => {
  assert.equal(shouldPretty({ markdown: true }), true);
});

// ─── makeMarkdownTable ────────────────────────────────────────────────────────

test('makeMarkdownTable: renders GFM pipe table with header and divider', () => {
  const rows = [
    { id: 1, name: 'Alice' },
    { id: 2, name: 'Bob' },
  ];
  const columns = [
    { key: 'id', header: 'ID' },
    { key: 'name', header: 'Name' },
  ];
  const result = makeMarkdownTable(rows, columns);
  const lines = result.split('\n');
  assert.equal(lines[0], '| ID | Name |');
  assert.equal(lines[1], '| --- | --- |');
  assert.ok(lines[2].includes('Alice'));
  assert.ok(lines[3].includes('Bob'));
});

test('makeMarkdownTable: escapes pipe characters in cell values', () => {
  const rows = [{ id: 1, name: 'A|B' }];
  const columns = [
    { key: 'id', header: 'ID' },
    { key: 'name', header: 'Name' },
  ];
  const result = makeMarkdownTable(rows, columns);
  assert.ok(result.includes('A\\|B'));
});

test('makeMarkdownTable: handles missing values as empty cells', () => {
  const rows = [{ id: 1 }];
  const columns = [
    { key: 'id', header: 'ID' },
    { key: 'missing', header: 'Missing' },
  ];
  const result = makeMarkdownTable(rows, columns);
  assert.ok(result.includes('| 1 |  |'));
});

test('makeMarkdownTable: serializes object values as JSON', () => {
  const rows = [{ id: 1, meta: { key: 'val' } }];
  const columns = [
    { key: 'id', header: 'ID' },
    { key: 'meta', header: 'Meta' },
  ];
  const result = makeMarkdownTable(rows, columns);
  assert.ok(result.includes('"key"'));
});
