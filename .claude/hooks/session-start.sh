#!/bin/bash
# Cloud sessions start from a fresh container: install the tools the skills in .claude/skills rely on.
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

if ! command -v graphify >/dev/null 2>&1; then
  pip install -q graphifyy
fi
graphify install
