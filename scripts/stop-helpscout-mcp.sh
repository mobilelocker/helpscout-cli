#!/bin/bash
# Stop running helpscout-mcp processes so a reinstall is not shadowed by an old in-memory server.
#
# Usage: scripts/stop-helpscout-mcp.sh [/path/to/helpscout-mcp]
# Exit 0 always (install should not fail if nothing is running or stop fails).

set +e

MCP_BIN="${1:-/usr/local/bin/helpscout-mcp}"

# Match only Node serving the MCP binary (e.g. "node /usr/local/bin/helpscout-mcp").
# Do not match this script's own argv, which also contains the path.
PATTERN="node ${MCP_BIN}"

if ! command -v pgrep >/dev/null 2>&1; then
  echo "  Note: pgrep not available; skip stopping helpscout-mcp processes."
  exit 0
fi

if ! pgrep -f "$PATTERN" >/dev/null 2>&1; then
  exit 0
fi

count=$(pgrep -f "$PATTERN" 2>/dev/null | wc -l | tr -d ' ')
echo "Stopping ${count} running helpscout-mcp process(es)..."

if pkill -f "$PATTERN" 2>/dev/null; then
  sleep 0.3
  if pgrep -f "$PATTERN" >/dev/null 2>&1; then
    echo "  Warning: some helpscout-mcp processes are still running."
    echo "  Stop them manually or reconnect Help Scout MCP in your editor."
  else
    echo "  Stopped. Reconnect Help Scout MCP in Cursor/Claude/Grok if a session was open"
    echo "  (or it will start the new binary on next use)."
  fi
else
  echo "  Warning: could not stop helpscout-mcp (permission or process state)."
  echo "  Reconnect Help Scout MCP in your editor after install, or run:"
  echo "    pkill -f '$PATTERN'"
fi

exit 0
