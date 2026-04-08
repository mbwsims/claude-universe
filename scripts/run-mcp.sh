#!/bin/sh
# Portable node resolver for claude-universe MCP servers.
# Handles: system installs, Homebrew (Apple Silicon + Intel), volta, nvm, fnm, asdf.
# Usage: sh run-mcp.sh <path-to-server-bundle.mjs>

NODE=$(command -v node 2>/dev/null)

# Check common locations (Homebrew on Apple Silicon + Intel, volta)
if [ -z "$NODE" ]; then
  for candidate in \
    /opt/homebrew/bin/node \
    /usr/local/bin/node \
    "$HOME/.volta/bin/node"; do
    if [ -x "$candidate" ]; then
      NODE="$candidate"
      break
    fi
  done
fi

# Fallback: ask the user's login shell (picks up nvm, fnm, asdf, brew shellenv, etc.)
if [ -z "$NODE" ]; then
  NODE=$("${SHELL:-/bin/sh}" -l -c 'command -v node' 2>/dev/null)
fi

if [ -z "$NODE" ] || [ ! -x "$NODE" ]; then
  echo "claude-universe: node not found. Install Node.js 18+ (https://nodejs.org)" >&2
  exit 1
fi

exec "$NODE" "$@"
