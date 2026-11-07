# CLAUDE.md

Built with Claude: Japan 2026 の提出作品。葬儀の打合せで、遺族が数日のうちに迫られる絡み合った決定を、ベテランの判断と実データで支える。仕様は `docs/spec.md`、タスクは `docs/tasks.md`。

## 守る線（コードを書くときに必ず守る）
- **まず寄り添い、提案は信頼のあとで**。ご遺族への配慮を先に出し、有料の選択肢・お金の話はお気持ちを伺い終えてから
- **高いプランへ誘導しない**。推奨には予算を抑える選択肢を含める。金額は `web/src/domain/pricing.ts` で計算し、モデルに金額を作らせない
- **不安をあおらない**。遺体の変化（菌・匂い・変色）を持ち出して有料の選択肢を勧める言い回しを出さない
- **似た家族の選び方は参考として示す**。数字は `web/src/data/similar-families.json` から取り、モデルに作らせない。多数派に合わせるよう促さない
- **確定は人が行う**。AI が作るのは候補まで。遺族の窓口は評価や推奨をしない
- **推奨には根拠を添える**（会話のどの発言・どの知見・どの集計か）

## 個人情報と機密
- `docs/private/` は公開しない（`.gitignore` 済み）。実在の社名・取引先・社内の営業のやり方を公開ファイルに書かない。公開物では「東北地方の互助会系葬儀社」と表記する
- 基幹システムのデータベースはリポジトリの外にある。集計は `scripts/build_similar_families.py`（環境変数 `CORE_DB_PATH`）で行い、集計値の JSON だけを置く。30件未満の区分は出さない
- デモの家族・人物・発言はすべて架空。金額は基幹システムの集計値（品目ごとの単価の中央値を丸めたもの。`scripts/build_product_catalog.py` → `web/src/data/product-catalog.json`）で、実在の商品名・会場名は持たない

## コマンド（`web/` で実行）
- `npm run dev` / `npm run build`
- `npm test`（Vitest）／ `npm run typecheck`

## 技術
Next.js 16（App Router。書く前に `web/node_modules/next/dist/docs/` を確認する）、TypeScript、Anthropic SDK（打合せ中にリアルタイムで出すもの＝いまの見立て・寄り添いと提案・プランの見立て・窓口の案内役・ロールプレイのご遺族役・抽出・話者の聞き分けは `claude-haiku-5-5`。守る線の判定役と、打合せのあとの書類・判断の取り出しは `claude-opus-5-5`）、zod。
