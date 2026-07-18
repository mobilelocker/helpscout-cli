#!/bin/bash
set -e

cd "$(dirname "$0")"

MCP_BIN="/usr/local/bin/helpscout-mcp"
CLI_BIN="/usr/local/bin/helpscout"

echo "Building helpscout..."
npm install --silent
npm run build --silent

echo "Installing binaries to /usr/local/bin..."
sudo cp dist/helpscout "$CLI_BIN"
sudo cp dist/helpscout-mcp "$MCP_BIN"

# Drop in-memory servers still running the previous binary (issue #12).
bash scripts/stop-helpscout-mcp.sh "$MCP_BIN"

ENV_FILE="$HOME/.config/helpscout/env"
if [ ! -f "$ENV_FILE" ]; then
  echo "Creating credentials file at $ENV_FILE..."
  mkdir -p "$(dirname "$ENV_FILE")"
  {
    echo "# Help Scout credentials for CLI and MCP server"
    echo "# Used when editors launch helpscout-mcp without your shell profile"
    [ -n "$HELPSCOUT_APP_ID" ] && echo "HELPSCOUT_APP_ID=$HELPSCOUT_APP_ID"
    [ -n "$HELPSCOUT_APP_SECRET" ] && echo "HELPSCOUT_APP_SECRET=$HELPSCOUT_APP_SECRET"
    [ -n "$HELPSCOUT_API_KEY" ] && echo "HELPSCOUT_API_KEY=$HELPSCOUT_API_KEY"
    if [ -z "$HELPSCOUT_APP_ID$HELPSCOUT_APP_SECRET$HELPSCOUT_API_KEY" ]; then
      echo "# HELPSCOUT_APP_ID="
      echo "# HELPSCOUT_APP_SECRET="
      echo "# HELPSCOUT_API_KEY="
    fi
  } > "$ENV_FILE"
  chmod 600 "$ENV_FILE"
fi

echo "Registering MCP server..."
node scripts/register-mcp.js --bin "$MCP_BIN"

echo ""
echo "Done."
echo "  helpscout --version"
echo "  helpscout auth login"
echo "  If an editor had Help Scout MCP open, reconnect it so it loads the new binary."
