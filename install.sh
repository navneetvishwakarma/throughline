#!/usr/bin/env bash
# Install throughline for a supported AI platform.
#
# Usage:
#   ./install.sh                         # Claude Code
#   ./install.sh codex                   # Codex
#   ./install.sh antigravity             # Antigravity skills folder
#   ./install.sh codex --uninstall

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLATFORM="${1:-claude}"
shift || true

node "$SCRIPT_DIR/scripts/install.mjs" "$PLATFORM" "$@"
