# 祭壇イメージの検品の記録

標準祭壇1種のイメージ（画像モデルで作ったサンプル）を、画像モデルで生花の色合いだけ編集し、Opus が元の画像と見比べて検品した記録です（`npm run altar:check`）。

| 回 | 結果 | 記録 |
| --- | --- | --- |
| 1回目 | 紫・青・黄は合格。**ピンクは不合格**：祭壇の台が濃い黒茶から明るい木目調の別の意匠に変わり、花の種類も変わっていた | [check-1.json](check-1.json)、不合格の画像 [pink-rejected-1.webp](pink-rejected-1.webp) |
| 2回目 | ピンクを「木の色と素材は変えない」と指示して作り直し、合格。5色すべて合格 | `web/src/data/altar-images.json` |

不合格の画像は画面に出しません（`web/src/domain/altar.ts` の `altarImageFor`）。
