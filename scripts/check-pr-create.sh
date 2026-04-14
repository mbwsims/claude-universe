#!/bin/bash
# PreToolUse hook: nudge user to run /orbit pr before creating a pull request.
#
# This is a command-type hook that runs on every Bash tool call.
# - If the command is `gh pr create`, it blocks with an "ask" decision
#   so the user can choose to run /orbit pr first.
# - For all other commands, it exits silently (no output = allow).
#
# Why command instead of prompt:
# - Deterministic: no LLM call needed for a simple string match
# - Truly silent on non-matching commands (prompt hooks emit reasoning text)
# - Fast: bash check vs ~2s LLM inference on every Bash call
# - Structured: returns proper permissionDecision JSON

set -euo pipefail

# Read the tool input from stdin
input=$(cat)

# Extract the command string from the tool input JSON
command=$(echo "$input" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    # tool_input.command is the Bash command being executed
    cmd = data.get('tool_input', {}).get('command', '')
    print(cmd)
except:
    print('')
" 2>/dev/null)

# Check if this is an actual `gh pr create` invocation.
# We check that `gh pr create` appears as a command, not inside a string literal.
# Strategy: strip quoted strings first, then check for the command.
is_pr_create=$(echo "$command" | python3 -c "
import sys, re
cmd = sys.stdin.read().strip()
# Remove single-quoted strings (content between single quotes)
stripped = re.sub(r\"'[^']*'\", '', cmd)
# Remove double-quoted strings (content between double quotes, handling escapes)
stripped = re.sub(r'\"(?:[^\"\\\\]|\\\\.)*\"', '', stripped)
# Remove comments (# to end of line)
stripped = re.sub(r'#.*$', '', stripped, flags=re.MULTILINE)
# Now check if 'gh pr create' appears in the unquoted portion
if 'gh pr create' in stripped:
    print('yes')
else:
    print('no')
" 2>/dev/null)

if [ "$is_pr_create" = "yes" ]; then
    # Block with an "ask" decision — user sees the message and can approve or deny
    cat <<'EOF'
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "ask",
    "permissionDecisionReason": "💡 About to create a pull request. Want to run `/orbit pr` first? It reviews your branch diff for security issues, test coverage gaps, impact, and rule conformance — takes 30-60 seconds.\n\nReply **yes** to run `/orbit pr` before creating the PR, or **proceed** to create the PR without it."
  }
}
EOF
    exit 0
fi

# Not a PR creation command — exit silently (no output = allow)
exit 0
