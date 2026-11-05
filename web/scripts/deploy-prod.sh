#!/bin/bash
# 本番への反映。必ず web/ を、リンク済みのプロジェクトに固定して送る。
# 2026-11-05 に、リポジトリの根から別のプロジェクトが作られ、非公開のフォルダが公開されたことがあるため。
set -euo pipefail
WEB="$(cd "$(dirname "$0")/.." && pwd)"
LINK="$WEB/.vercel/project.json"
if [ ! -f "$LINK" ]; then
  echo "web/.vercel/project.json がありません。先に web/ で vercel link をしてください" >&2
  exit 1
fi
VERCEL_ORG_ID="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["orgId"])' "$LINK")"
VERCEL_PROJECT_ID="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["projectId"])' "$LINK")"
NAME="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["projectName"])' "$LINK")"
export VERCEL_ORG_ID VERCEL_PROJECT_ID
LOG="$(mktemp)"
vercel deploy --prod --yes --cwd "$WEB" > "$LOG" 2>&1 || true
if grep -q "Created" "$LOG"; then
  echo "新しいプロジェクトが作られました。止めます。ログ：$LOG" >&2
  exit 2
fi
grep -E "Production|Inspect|Error" "$LOG" | grep -v -i token || true
grep -q "$NAME" "$LOG" || { echo "ログにプロジェクト名 $NAME が見当たりません。ログ：$LOG" >&2; exit 3; }
echo "反映先：$NAME"
