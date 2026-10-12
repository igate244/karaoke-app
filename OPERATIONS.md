# 運用ガイド（スマホだけで回す）

## 全体の流れ
```
スマホのClaudeアプリで「〇〇を直して」
   ↓ Claudeがコードを直してテスト・ビルド確認 → GitHubにpush
GitHub Actions が自動でテスト → ビルド → GitHub Pages に公開（2〜3分）
   ↓
スマホのアプリを開き直すと新しい版になる
```
PCは不要。GitHubの操作はスマホのブラウザ（またはGitHubアプリ）でできる。

## アプリのURL
`https://igate244.github.io/karaoke-app/`
→ Safari/Chromeで開いて「ホーム画面に追加」するとアプリとして使える（オフラインでも動く）。

---

## 最初に1回だけやること

### 1. GitHub Pages を有効にする
GitHubでリポジトリを開く → **Settings → Pages → Build and deployment → Source を「GitHub Actions」** にする。

### 2. 公開できたか確認
リポジトリの **Actions** タブで `deploy` が緑のチェックになっていればOK。
赤い×のときは、その画面のURLをClaudeに貼って「直して」と言えばいい。

### 3. Googleドライブバックアップ（設定済み）
読書記録アプリの Google Cloud プロジェクト（reading-log-igate）の OAuth クライアント「読書記録 PWA」を共用している。
- 承認済みの JavaScript 生成元に `https://igate244.github.io` を追加済み
- クライアントIDは `.github/workflows/deploy.yml` に記入済み（ビルド時に埋め込まれる）
- Google Drive API は有効
- 同意画面に出るアプリ名は読書アプリと同じになる

使い方：アプリの 設定 → 「Googleに接続」→ 自分のGoogleアカウントで許可。

---

## ふだんの運用

| やりたいこと | やり方 |
|---|---|
| 機能を足す・直す | Claudeに頼むだけ。push までやってくれる |
| 公開されたか見る | GitHubの Actions タブ、またはアプリの 設定 → 「ビルド」の日時 |
| 新しい版にならない | アプリの 設定 → 「再読み込み」。それでもダメならアプリを一度閉じて開き直す |
| データを守る | 設定 → Googleに接続 → 自動バックアップON。大きな変更前は「今すぐバックアップ」 |
| 機種変更 | 新しいスマホで開く → 設定 → Googleに接続 → 復元… → 「自動」か日時のファイルを選ぶ |
| 一括で編集したい | 設定 → CSV書き出し → スプレッドシートで編集 → CSV取り込み |
| 家族も使う | URLを教えるだけ。データは各自の端末に入る。1台を共有するなら 設定 → 利用者を追加 |

## 困ったとき
- **Actions が赤い**：失敗した画面のURLか、エラーのスクショをClaudeに渡す
- **Googleに接続できない**：「承認済みの JavaScript 生成元」に `https://igate244.github.io` が入っているか確認
- **データが消えた気がする**：別の利用者になっていないか（設定 → 利用者）。それでもなければDriveから復元
- **iPhoneで長く使わないとデータが消えることがある**：Safariの仕様。ホーム画面に追加して使う＋自動バックアップで防ぐ
