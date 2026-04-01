#!/bin/bash
set -e

cd "$(dirname "$0")"

echo "Building helpscout..."
npm install --silent
npm run build --silent

echo "Installing binaries to /usr/local/bin..."
sudo cp dist/helpscout /usr/local/bin/helpscout
sudo cp dist/helpscout-mcp /usr/local/bin/helpscout-mcp

echo "Registering MCP server with Claude Code..."
claude mcp add helpscout -s user -- /usr/local/bin/helpscout-mcp

echo ""
echo "Done."
echo "  helpscout --version"
echo "  helpscout auth login"
