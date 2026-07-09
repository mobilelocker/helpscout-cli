/**
 * Load Help Scout credentials from ~/.config/helpscout/env.
 * Cursor and other editors launch MCP servers without shell profile env vars;
 * this file lets the CLI and MCP share the same credentials as a user's shell.
 *
 * Existing process.env values are never overwritten.
 */
import { existsSync, readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const ENV_FILE = path.join(os.homedir(), '.config', 'helpscout', 'env');

export function loadEnvFile(envFile = ENV_FILE) {
  if (!existsSync(envFile)) return false;

  const content = readFileSync(envFile, 'utf8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;

    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }

  return true;
}

loadEnvFile();
