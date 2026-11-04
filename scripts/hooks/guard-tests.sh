#!/usr/bin/env bash
# Claude Code の PostToolUse フック。
# 守る線に関わるファイルを編集したら、言い回しの検査と推奨の検査を流す。
# 落ちたら exit 2 で Claude Code に結果を返し、直すまで先に進ませない。
set -uo pipefail

file=$(jq -r '.tool_input.file_path // empty')
case "$file" in
  */web/src/engine/guard.ts | */web/src/engine/guard-cases/* | */web/src/engine/farewell.ts | \
  */web/src/engine/models.ts | */web/src/domain/farewell.ts | */web/src/knowledge/rules.json) ;;
  *) exit 0 ;;
esac

cd "${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel)}/web" || exit 0
if ! out=$(npx vitest run src/engine/guard-cases src/engine/guard.test.ts src/engine/farewell.test.ts 2>&1); then
  echo "守る線の検査に落ちました（$(basename "$file") を編集した直後）：" >&2
  echo "$out" | grep -E "×|FAIL|Expected|Received|AssertionError" | head -30 >&2
  exit 2
fi
exit 0
