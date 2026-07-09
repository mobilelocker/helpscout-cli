/**
 * Ensures MCP tools and CLI commands expose every catalog body/query/form field.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { DOCS_FIELD_COVERAGE } from '../src/docs-api-field-map.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

async function loadCatalog() {
  const raw = await readFile(path.join(ROOT, 'docs', 'docs-api-endpoints.json'), 'utf8');
  return JSON.parse(raw);
}

function flattenEndpoints(catalog) {
  return catalog.groups.flatMap((g) => g.endpoints);
}

function extractMcpToolBlock(source, toolName) {
  const start = source.indexOf(`'${toolName}'`);
  assert.ok(start >= 0, `tool ${toolName} not found`);
  const schemaStart = source.indexOf('inputSchema:', start);
  const nextTool = source.indexOf('server.registerTool(', schemaStart + 1);
  return source.slice(schemaStart, nextTool > 0 ? nextTool : undefined);
}

function assertFieldsInBlock(block, fields, label) {
  for (const field of fields) {
    assert.match(block, new RegExp(`\\b${field}\\b`), `${label} missing field ${field}`);
  }
}

function cliPatternsForField(field) {
  const kebab = field
    .replace(/([A-Z])/g, '-$1')
    .toLowerCase()
    .replace(/^-/, '');
  return [`--${kebab}`, `--${field}`, `opts.${field}`, `'${field}'`, `"${field}"`];
}

function assertCliFields(source, fields) {
  for (const field of fields) {
    const patterns = cliPatternsForField(field);
    const found = patterns.some((p) => source.includes(p));
    assert.ok(found, `CLI missing field ${field} (tried ${patterns.join(', ')})`);
  }
}

test('catalog endpoints with fields have coverage entries', async () => {
  const catalog = await loadCatalog();
  const endpoints = flattenEndpoints(catalog).filter(
    (e) => e.bodyFields?.length || e.queryParams?.length || e.formFields?.length,
  );

  for (const endpoint of endpoints) {
    assert.ok(
      DOCS_FIELD_COVERAGE[endpoint.id],
      `${endpoint.id} has catalog fields but no DOCS_FIELD_COVERAGE entry`,
    );
  }
});

test('MCP tools expose all mapped body/query/form fields', async () => {
  const mcpSource = await readFile(path.join(ROOT, 'src', 'mcp-server-docs.js'), 'utf8');
  const schemaSource = await readFile(path.join(ROOT, 'src', 'docs-api-schemas.js'), 'utf8');

  for (const [endpointId, map] of Object.entries(DOCS_FIELD_COVERAGE)) {
    let block = extractMcpToolBlock(mcpSource, map.mcpTool);
    if (block.includes('...siteOptionalFields')) {
      block = `${block}\n${schemaSource}`;
    }
    if (map.mcpBody?.length) assertFieldsInBlock(block, map.mcpBody, `${endpointId} MCP body`);
    if (map.mcpQuery?.length) assertFieldsInBlock(block, map.mcpQuery, `${endpointId} MCP query`);
    if (map.mcpForm?.length) assertFieldsInBlock(block, map.mcpForm, `${endpointId} MCP form`);
  }
});

test('CLI commands expose all mapped body/query/form fields', async () => {
  const cache = new Map();

  async function loadCli(relativePath) {
    if (!cache.has(relativePath)) {
      cache.set(relativePath, await readFile(path.join(ROOT, relativePath), 'utf8'));
    }
    return cache.get(relativePath);
  }

  const helpersSource = await loadCli('src/docs-cli-helpers.js');

  for (const [endpointId, map] of Object.entries(DOCS_FIELD_COVERAGE)) {
    let source = await loadCli(map.cliFile);
    if (source.includes('addSiteBodyOptions')) {
      source = `${source}\n${helpersSource}`;
    }
    if (map.cliBody?.length) assertCliFields(source, map.cliBody);
    if (map.cliQuery?.length) assertCliFields(source, map.cliQuery);
    if (map.cliForm?.length) assertCliFields(source, map.cliForm);
    void endpointId;
  }
});

test('catalog field lists match coverage map API names', async () => {
  const catalog = await loadCatalog();
  const endpoints = flattenEndpoints(catalog);

  for (const [endpointId, map] of Object.entries(DOCS_FIELD_COVERAGE)) {
    const endpoint = endpoints.find((e) => e.id === endpointId);
    assert.ok(endpoint, `unknown endpoint ${endpointId}`);

    if (endpoint.bodyFields) {
      for (const field of endpoint.bodyFields) {
        assert.ok(
          map.body?.includes(field),
          `${endpointId} catalog body field ${field} not in map.body`,
        );
      }
    }
    if (endpoint.queryParams) {
      for (const field of endpoint.queryParams) {
        assert.ok(
          map.query?.includes(field),
          `${endpointId} catalog query ${field} not in map.query`,
        );
      }
    }
    if (endpoint.formFields) {
      for (const field of endpoint.formFields) {
        assert.ok(
          map.formFields?.includes(field),
          `${endpointId} catalog form ${field} not in map.formFields`,
        );
      }
    }
  }
});
