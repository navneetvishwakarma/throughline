#!/usr/bin/env bash
# install.sh — Install throughline as a local Claude Code plugin (macOS / Linux)
#
# Copies this repo into the Claude plugin cache. Edits to source are not live
# until you re-run this script.
#
# Usage:
#   ./install.sh             # install / reinstall
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
      if (!fs.existsSync('$REGISTRY')) process.exit(0);
      const r = JSON.parse(fs.readFileSync('$REGISTRY', 'utf8'));
      r.plugins ||= {};
      delete r.plugins['$KEY'];
      fs.writeFileSync('$REGISTRY', JSON.stringify(r, null, 2) + '\n');
    "
    echo "throughline uninstalled. Restart Claude Code."
    exit 0
fi

rm -rf "$CACHE_DIR"
mkdir -p "$CACHE_DIR"
cp -R "$SCRIPT_DIR/." "$CACHE_DIR/"
rm -rf "$CACHE_DIR/.git"
if [[ ! -f "$CACHE_DIR/.claude-plugin/plugin.json" ]]; then
    echo "ERROR: Copy failed — plugin manifest not found in cache." >&2
    exit 1
fi

node -e "
  const fs = require('fs');
  const path = '$REGISTRY';
  fs.mkdirSync(require('path').dirname(path), { recursive: true });
  const r = fs.existsSync(path) ? JSON.parse(fs.readFileSync(path, 'utf8')) : { plugins: {} };
  r.plugins ||= {};
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
echo "  Mode   : copy (re-run to pick up source changes)"
echo ""
echo "Restart Claude Code to activate the plugin."
