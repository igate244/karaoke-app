# CLAUDE.md — 開発エージェント向けメモ

このリポジトリは、オーナーが**スマホだけ**で開発・運用している個人用PWA「カラオケ持ち歌」。
変更依頼はスマホのClaudeアプリから来る。PCで確認してもらう前提にしないこと。

## 守ること
- 変更したら `npm test` と `npm run build` が通ることを確認してから main に push する（push＝本番公開）
- 画面を変えたら、スマホ幅（390px）でスクリーンショットを撮って崩れていないか自分で見る
- 依存パッケージは増やさない（いまは react / react-dom / esbuild / tsx だけ）。どうしても必要なら理由を伝える
- データ形式（`src/types.ts` の Song / ScoreLog）を変えるときは、既存データ・Driveバックアップ・CSVとの互換を必ず保つ
- コミットメッセージは日本語でOK。何を変えたかが一行でわかるように
- オーナーへの報告は短く、くだけた日本語で。結果と「スマホで何をすればいいか」だけ

## 構成
- `src/main.tsx` 起動・Service Worker登録 / `src/App.tsx` ルーティングとボトムナビ
- `src/store.ts` IndexedDB（利用者ごとに `karaoke-<userId>` DB）。全件メモリ保持、`useStore()` で購読
- `src/normalize.ts` 検索の表記ゆれ吸収（テストあり）
- `src/itunes.ts` iTunes Search API（JSONP）
- `src/drive.ts` Googleドライブバックアップ（GIS トークン、drive.file スコープ）
- `src/csv.ts` CSV入出力（テストあり）
- `src/screens/*` 画面、`src/components/*` 共通部品、`src/styles.css` 全スタイル（ダークテーマ）
- `build.mjs` esbuild でビルド→ `dist/`、`src/sw.template.js` から sw.js を生成
- `.github/workflows/deploy.yml` main への push で test→build→Firebase Hosting（https://karaoke-mochiuta.web.app）に公開。GitHub Pages は旧URLの案内ページ（`redirect/`）だけ
- `firebase.json` / `.firebaserc` KEEP の Firebase プロジェクト（keep-app-30128）のサイト `karaoke-mochiuta`

## 確認方法
```
npm install
npm test
npm run dev   # http://localhost:5173/ で確認（ビルド済みを配信）
```
画面確認は Playwright（あれば）で 390x844 のスクショを撮る。

## 要件
`docs/requirements.md` が最新の要件。方針変更があったらそこも更新する。
