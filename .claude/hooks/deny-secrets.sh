#!/usr/bin/env bash
# PreToolUse hook for Bash: block any command whose text references
# .dev.vars / .dev.vars.e2e* (but NOT .dev.vars.example — that's a
# committed template with no secrets).
#
# Catches the common escape hatches that a plain permissions.deny list
# can't pattern-match: pipes, redirects, `bash -c '...'`, flag reorders,
# and less-usual readers (awk/sed/diff/dd/...).
set -euo pipefail

cmd="$(jq -r '.tool_input.command // empty')"
# Match ".dev.vars" followed by end-of-string, any non-dot char (so a
# space, semicolon, quote, redirect, etc.), or ".e2e" (covering
# .dev.vars.e2e and .dev.vars.e2e-backup). ".dev.vars.example" is not
# matched because "." is explicitly excluded by [^.] and .example != .e2e.
if printf '%s' "$cmd" | grep -qE '\.dev\.vars(\.e2e|[^.]|$)'; then
	cat <<'JSON'
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "deny",
    "permissionDecisionReason": "Bash access to .dev.vars* (secrets) is blocked by .claude/hooks/deny-secrets.sh"
  }
}
JSON
fi
