#!/usr/bin/env node
/**
 * Register the helpscout MCP server with Claude Code and/or Cursor.
 *
 * Usage: node scripts/register-mcp.js --bin /usr/local/bin/helpscout-mcp
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SERVER_NAME = 'helpscout';

export function commandExists(command) {
  const result = spawnSync('which', [command], { stdio: 'ignore' });
  return result.status === 0;
}

export function isCursorInstalled(homeDir = os.homedir(), options = {}) {
  const hasCommand = options.hasCommand ?? commandExists;
  if (existsSync(path.join(homeDir, '.cursor'))) return true;
  if (process.platform === 'darwin' && existsSync('/Applications/Cursor.app')) return true;
  if (existsSync(path.join(homeDir, '.local', 'share', 'cursor'))) return true;
  return hasCommand('cursor');
}

export function cursorMcpConfigPath(homeDir = os.homedir()) {
  return path.join(homeDir, '.cursor', 'mcp.json');
}

export function readMcpConfig(configPath) {
  if (!existsSync(configPath)) {
    return { mcpServers: {} };
  }

  const raw = readFileSync(configPath, 'utf8');
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('mcp.json must be a JSON object');
  }
  if (
    !parsed.mcpServers ||
    typeof parsed.mcpServers !== 'object' ||
    Array.isArray(parsed.mcpServers)
  ) {
    parsed.mcpServers = {};
  }
  return parsed;
}

export function helpscoutEnvFilePath(homeDir = os.homedir()) {
  return path.join(homeDir, '.config', 'helpscout', 'env');
}

export function mergeHelpscoutServer(config, binPath, homeDir = os.homedir()) {
  return {
    ...config,
    mcpServers: {
      ...config.mcpServers,
      [SERVER_NAME]: {
        command: binPath,
        envFile: helpscoutEnvFilePath(homeDir),
      },
    },
  };
}

export function writeMcpConfig(configPath, config) {
  mkdirSync(path.dirname(configPath), { recursive: true });
  writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`, 'utf8');
}

export function registerCursorMcp(binPath, homeDir = os.homedir()) {
  const configPath = cursorMcpConfigPath(homeDir);

  let config;
  try {
    config = readMcpConfig(configPath);
  } catch (err) {
    const backupPath = `${configPath}.bak`;
    copyFileSync(configPath, backupPath);
    throw new Error(`Invalid ${configPath}; backed up to ${backupPath}: ${err.message}`, {
      cause: err,
    });
  }

  const merged = mergeHelpscoutServer(config, binPath, homeDir);
  writeMcpConfig(configPath, merged);
  return configPath;
}

export function parseClaudeMcpGetOutput(output) {
  const match = output.match(/^\s*Command:\s*(.+)$/m);
  return match?.[1]?.trim() ?? null;
}

export function getClaudeMcpCommand() {
  const result = spawnSync('claude', ['mcp', 'get', SERVER_NAME], { encoding: 'utf8' });
  if (result.status !== 0) return null;
  return parseClaudeMcpGetOutput(result.stdout);
}

export function registerClaudeMcp(binPath) {
  const existing = getClaudeMcpCommand();
  if (existing === binPath) return 'unchanged';

  spawnSync('claude', ['mcp', 'remove', SERVER_NAME, '-s', 'user'], { stdio: 'ignore' });

  const result = spawnSync('claude', ['mcp', 'add', SERVER_NAME, '-s', 'user', '--', binPath], {
    stdio: 'inherit',
  });
  if (result.status !== 0) {
    throw new Error(`claude mcp add failed with exit code ${result.status}`);
  }

  return existing ? 'updated' : 'registered';
}

export function registerMcp(binPath, options = {}) {
  const homeDir = options.homeDir ?? os.homedir();
  const results = {
    claude: 'skipped',
    cursor: 'skipped',
  };

  if (options.registerClaude ?? commandExists('claude')) {
    results.claude = registerClaudeMcp(binPath);
  }

  if (options.registerCursor ?? isCursorInstalled(homeDir)) {
    const configPath = registerCursorMcp(binPath, homeDir);
    results.cursor = configPath;
  }

  return results;
}

function parseArgs(argv) {
  let binPath = '/usr/local/bin/helpscout-mcp';
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--bin' && argv[i + 1]) {
      binPath = argv[++i];
    }
  }
  return { binPath };
}

function main() {
  const { binPath } = parseArgs(process.argv);
  const results = registerMcp(binPath);

  if (results.claude === 'registered') {
    console.log('  Claude Code: registered (user scope)');
  } else if (results.claude === 'updated') {
    console.log('  Claude Code: updated (user scope)');
  } else if (results.claude === 'unchanged') {
    console.log('  Claude Code: already registered (user scope)');
  } else {
    console.log('  Claude Code: skipped (claude not found)');
  }

  if (results.cursor !== 'skipped') {
    console.log(`  Cursor: registered (${results.cursor})`);
  } else {
    console.log('  Cursor: skipped (not detected)');
  }
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMain) {
  main();
}
