/**
 * Tests for scripts/register-mcp.js
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  cursorMcpConfigPath,
  isCursorInstalled,
  mergeHelpscoutServer,
  readMcpConfig,
  registerCursorMcp,
  registerMcp,
  writeMcpConfig,
} from '../scripts/register-mcp.js';

function makeHome() {
  return mkdtempSync(path.join(tmpdir(), 'helpscout-mcp-'));
}

test('cursorMcpConfigPath returns ~/.cursor/mcp.json', () => {
  const home = '/tmp/test-home';
  assert.equal(cursorMcpConfigPath(home), path.join(home, '.cursor', 'mcp.json'));
});

test('readMcpConfig returns empty mcpServers when file is missing', () => {
  const home = makeHome();
  const configPath = cursorMcpConfigPath(home);
  assert.deepEqual(readMcpConfig(configPath), { mcpServers: {} });
});

test('registerCursorMcp creates fresh mcp.json', () => {
  const home = makeHome();
  const configPath = registerCursorMcp('/usr/local/bin/helpscout-mcp', home);

  assert.equal(configPath, cursorMcpConfigPath(home));
  const config = JSON.parse(readFileSync(configPath, 'utf8'));
  assert.deepEqual(config, {
    mcpServers: {
      helpscout: { command: '/usr/local/bin/helpscout-mcp' },
    },
  });
});

test('registerCursorMcp merges into existing config without clobbering other servers', () => {
  const home = makeHome();
  const configPath = cursorMcpConfigPath(home);
  writeMcpConfig(configPath, {
    mcpServers: {
      other: { command: '/usr/local/bin/other-mcp' },
    },
  });

  registerCursorMcp('/usr/local/bin/helpscout-mcp', home);
  const config = JSON.parse(readFileSync(configPath, 'utf8'));
  assert.deepEqual(config, {
    mcpServers: {
      other: { command: '/usr/local/bin/other-mcp' },
      helpscout: { command: '/usr/local/bin/helpscout-mcp' },
    },
  });
});

test('registerCursorMcp is idempotent and updates command path', () => {
  const home = makeHome();
  registerCursorMcp('/old/path/helpscout-mcp', home);
  registerCursorMcp('/usr/local/bin/helpscout-mcp', home);

  const config = JSON.parse(readFileSync(cursorMcpConfigPath(home), 'utf8'));
  assert.equal(config.mcpServers.helpscout.command, '/usr/local/bin/helpscout-mcp');
  assert.equal(Object.keys(config.mcpServers).length, 1);
});

test('registerCursorMcp backs up malformed JSON and throws', () => {
  const home = makeHome();
  const configPath = cursorMcpConfigPath(home);
  mkdirSync(path.dirname(configPath), { recursive: true });
  writeFileSync(configPath, '{not json', 'utf8');

  assert.throws(
    () => registerCursorMcp('/usr/local/bin/helpscout-mcp', home),
    /Invalid .* backed up/,
  );
  assert.ok(existsSync(`${configPath}.bak`));
});

test('mergeHelpscoutServer preserves unrelated top-level keys', () => {
  const merged = mergeHelpscoutServer(
    { mcpServers: { other: { command: 'x' } }, extra: true },
    '/usr/local/bin/helpscout-mcp',
  );
  assert.deepEqual(merged, {
    mcpServers: {
      other: { command: 'x' },
      helpscout: { command: '/usr/local/bin/helpscout-mcp' },
    },
    extra: true,
  });
});

test('registerMcp skips both editors when forced off', () => {
  const home = makeHome();
  const results = registerMcp('/usr/local/bin/helpscout-mcp', {
    homeDir: home,
    registerClaude: false,
    registerCursor: false,
  });

  assert.deepEqual(results, { claude: 'skipped', cursor: 'skipped' });
  assert.equal(existsSync(cursorMcpConfigPath(home)), false);
});

test('registerMcp registers Cursor when forced on', () => {
  const home = makeHome();
  const results = registerMcp('/usr/local/bin/helpscout-mcp', {
    homeDir: home,
    registerClaude: false,
    registerCursor: true,
  });

  assert.equal(results.claude, 'skipped');
  assert.equal(results.cursor, cursorMcpConfigPath(home));
});

test('isCursorInstalled returns true when ~/.cursor exists', () => {
  const home = makeHome();
  writeFileSync(path.join(home, '.cursor'), '', 'utf8');
  assert.equal(isCursorInstalled(home), true);
});

test('isCursorInstalled returns false for empty temp home without cursor signals', () => {
  const home = makeHome();
  assert.equal(isCursorInstalled(home, { hasCommand: () => false }), false);
});
