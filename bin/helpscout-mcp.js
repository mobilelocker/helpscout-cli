#!/usr/bin/env node
/**
 * helpscout-mcp — Help Scout MCP server
 * Exposes Help Scout as MCP tools for use with Claude Code and Claude Desktop.
 *
 * Usage in .mcp.json:
 *   { "mcpServers": { "helpscout": { "command": "/usr/local/bin/helpscout-mcp" } } }
 *
 * Credentials: set HELPSCOUT_* env vars or put them in ~/.config/helpscout/env
 */
import '../src/load-env.js';
import { startMcpServer } from '../src/mcp-server.js';

startMcpServer().catch((err) => {
  process.stderr.write(`Fatal: ${err.message}\n`);
  process.exit(1);
});
