#!/bin/bash
set -e

cd "$(dirname "$0")"

echo "Building helpscout..."
npm install --silent
npm run build --silent

echo "Installing binaries to /usr/local/bin..."
sudo cp dist/helpscout /usr/local/bin/helpscout
sudo cp dist/helpscout-mcp /usr/local/bin/helpscout-mcp

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
node scripts/register-mcp.js --bin /usr/local/bin/helpscout-mcp

echo ""
echo "Done."
echo "  helpscout --version"
echo "  helpscout auth login"
