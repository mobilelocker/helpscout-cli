#!/bin/bash
# Creates a clean, shareable tarball of the helpscout CLI+MCP,
# excluding internal docs and scrubbing proprietary examples.
set -e

cd "$(dirname "$0")"

VERSION=$(node -p "require('./package.json').version")
OUT="helpscout-cli-${VERSION}.tar.gz"
STAGING=$(mktemp -d)

echo "Packaging helpscout-cli v${VERSION}..."

# ── Export tracked files via git archive (respects .gitignore) ────────────────
git archive HEAD | tar -x -C "$STAGING"

# ── Scrub proprietary examples from docs ──────────────────────────────────────

# README.md: repo directory name and real mailbox ID
sed -i '' \
  -e 's|mobilelocker-helpscout-cli|helpscout-cli|g' \
  -e 's|189283|<mailbox-id>|g' \
  "$STAGING/README.md"

# CLAUDE.md: real mailbox ID/name and dotfiles reference
sed -i '' \
  -e 's|189283|<mailbox-id>|g' \
  -e 's|"Mobile Locker Support"|"<your-mailbox-name>"|g' \
  -e 's|.*dotfiles.*\.env.*|These must be set in your shell environment before running the CLI or MCP server.|' \
  -e 's|Full reference:.*|Full reference: CLAUDE.md|' \
  "$STAGING/CLAUDE.md"

# ── Build the tarball ─────────────────────────────────────────────────────────
tar -czf "$OUT" -C "$STAGING" .
rm -rf "$STAGING"

echo "Created: ${OUT} ($(du -sh "$OUT" | cut -f1))"

# ── Upload to S3 ──────────────────────────────────────────────────────────────
S3_KEY="helpscout-cli/${OUT}"
aws s3 cp "$OUT" "s3://assets.mobilelocker.com/${S3_KEY}" --profile mobilelocker

echo ""
echo "S3:  s3://assets.mobilelocker.com/${S3_KEY}"
echo "CDN: https://assets.mobilelocker.com/${S3_KEY}"
