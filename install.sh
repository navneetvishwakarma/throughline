#!/usr/bin/env bash
# install.sh — Install throughline as a local Claude Code plugin (macOS / Linux)
#
# Creates a symlink from the Claude plugin cache to this repo so
# edits are immediately live without re-installing.
#
# Usage:
#   ./install.sh             # install
#   ./install.sh --uninstall # remove

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NAME="throughline"
MARKETPLACE="local"
VERSION=$(node -p "require('$SCRIPT_DIR/package.json').version")
GIT_SHA=$(git -C "$SCRIPT_DIR" rev-parse HEAD 2>/dev/null || echo "unknown")
CACHE_DIR="$HOME/.claude/plugins/cache/$MARKETPLACE/$NAME/$VERSION"
REGISTRY="$HOME/.claude/plugins/installed_plugins.json"
KEY="${NAME}@${MARKETPLACE}"
NOW=$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")

if [[ "${1:-}" == "--uninstall" ]]; then
    rm -rf "$CACHE_DIR"
    node -e "
      const fs = require('fs');
      const r = JSON.parse(fs.readFileSync('$REGISTRY', 'utf8'));
      delete r.plugins['$KEY'];
      fs.writeFileSync('$REGISTRY', JSON.stringify(r, null, 2) + '\n');
    "
    echo "throughline uninstalled. Restart Claude Code."
    exit 0
fi

mkdir -p "$(dirname "$CACHE_DIR")"
rm -rf "$CACHE_DIR"
ln -s "$SCRIPT_DIR" "$CACHE_DIR"

node -e "
  const fs = require('fs');
  const r = JSON.parse(fs.readFileSync('$REGISTRY', 'utf8'));
  r.plugins['$KEY'] = [{
    scope: 'user',
    installPath: '$CACHE_DIR',
    version: '$VERSION',
    installedAt: '$NOW',
    lastUpdated: '$NOW',
    gitCommitSha: '$GIT_SHA'
  }];
  fs.writeFileSync('$REGISTRY', JSON.stringify(r, null, 2) + '\n');
"

echo ""
echo "throughline $VERSION installed."
echo "  Source : $SCRIPT_DIR"
echo "  Cache  : $CACHE_DIR"
echo "  Mode   : symlink (edits are live)"
echo ""
echo "Restart Claude Code to activate the plugin."
