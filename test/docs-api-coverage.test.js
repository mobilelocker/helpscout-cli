/**
 * Ensures docs/docs-api-endpoints.json matches implemented CLI commands and MCP tools.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

async function loadCatalog() {
  const raw = await readFile(path.join(ROOT, 'docs', 'docs-api-endpoints.json'), 'utf8');
  return JSON.parse(raw);
}

function flattenEndpoints(catalog) {
  return catalog.groups.flatMap((g) => g.endpoints);
}

async function loadMcpDocsTools() {
  const source = await readFile(path.join(ROOT, 'src', 'mcp-server-docs.js'), 'utf8');
  const matches = [...source.matchAll(/registerTool\(\s*\n\s*'([a-z_]+)'/g)];
  return new Set(matches.map((m) => m[1]));
}

test('all Docs API endpoints are marked implemented in catalog', async () => {
  const catalog = await loadCatalog();
  const endpoints = flattenEndpoints(catalog);
  assert.equal(endpoints.length, 39);

  const missing = endpoints.filter((e) => !e.implemented);
  assert.deepEqual(
    missing.map((e) => e.id),
    [],
  );
});

test('every catalog endpoint has cliCommand and mcpTool', async () => {
  const catalog = await loadCatalog();
  const endpoints = flattenEndpoints(catalog);

  for (const endpoint of endpoints) {
    assert.ok(endpoint.cliCommand, `${endpoint.id} missing cliCommand`);
    assert.ok(endpoint.mcpTool, `${endpoint.id} missing mcpTool`);
  }
});

test('catalog mcpTool names exist in mcp-server-docs.js', async () => {
  const catalog = await loadCatalog();
  const mcpTools = await loadMcpDocsTools();
  const endpoints = flattenEndpoints(catalog);

  for (const endpoint of endpoints) {
    assert.ok(
      mcpTools.has(endpoint.mcpTool),
      `MCP tool ${endpoint.mcpTool} for ${endpoint.id} not found in mcp-server-docs.js`,
    );
  }

  assert.equal(mcpTools.size, 39);
});

test('CLI docs commands are registered in bin/helpscout.js', async () => {
  const binSource = await readFile(path.join(ROOT, 'bin', 'helpscout.js'), 'utf8');
  for (const cmd of [
    'makeArticleCommand',
    'makeCollectionCommand',
    'makeCategoryCommand',
    'makeRedirectCommand',
    'makeSiteCommand',
    'makeAssetCommand',
  ]) {
    assert.match(binSource, new RegExp(cmd));
  }
});
