# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## コアコンセプト

日常の予定をロケット打ち上げのミッション風に扱うサービス。「実用的な予約管理をシネマティックな打ち上げ系 UI で包む」のがコア体験で、ここがブレるとプロダクトが意味を失う。

## 開発方針

### デザインの方針

cinematic launch-style UI の一貫性を維持する。既存の design token は意味があって選ばれた spec なので、個別に根拠なく調整しない:

- `src/style.css` の color palette / `letter-spacing` / `cubic-bezier` 等の非丸め値は意図的な値なので、既存値を尊重する
- D-DIN 系フォント、reveal-on-scroll animation の timing・easing は design spec。「より良い案」で差し替えるより、まず既存 spec に従う
- `scripts/screenshot.mjs` / `firstview.mjs` で見た目の変化を確認できる (`--auth` で要ログインページ)

### 「実用」を犠牲にしない

ガワは派手だが中身は本物の予約管理。スケジュール調整 (poll)、参加者管理、可視性制御は本当に動く必要がある。デモ用の見せかけ実装は禁止。

### TDD で書く

新機能・バグ修正はまず失敗するテストを書いてから実装する (Red → Green → Refactor)。先にコードを書いてから後付けでテストを書くのは禁止。特にテストしやすいのは以下:

- `src/db/` のクエリモジュール — 期待 SQL と結果形状
- `src/lib/` のユーティリティ (`generateCallsign`、`pickHeroImage`、`isAllowedUser`) — 純関数
- `src/middleware/` の auth / visibility ロジック — 入力 context → 期待動作

ランナーは Vitest (`pnpm test`、単一ファイルは `pnpm test -- path/to/file.test.ts`)。SSR 出力の snapshot は脆いので、JSX コンポーネントは「表示される値」ではなく「計算ロジック」をヘルパ関数に抽出してそちらをテストする。

### E2E でしか確認できない仕様は E2E test で確認する

`pnpm test:e2e` (Playwright) で実ブラウザ経由の挙動を検証する。対象は次のような「単体テストで代替できない」もの:

- form submit → route → DB → SSR render の round-trip
- session cookie を跨いだ visibility (user A 作成 / user B 閲覧)
- multipart/form-data upload → R2 put → `/r2/:key` 経由で配信
- 外部 API (Google Places) の proxy 動作

テストは `tests/e2e/*.spec.ts`。`tests/e2e/global-setup.ts` が migration + `sites:sync` + 非 default 行の wipe を実行してから `pnpm dev` (MOCK_AUTH=true) を webServer で起動する。MOCK_AUTH 時は `/auth/mock-callback?login=<user>` で直接セッション発行できるので `loginAs()` ヘルパで user 切替する。「動作確認は未実施」で未完了とするのは禁止 — 仕様がある以上テストも書く。

**State 分離**: `pnpm dev` (ブラウザ手動確認) と `pnpm test:e2e` (自動テスト) は D1/R2 state を別ディレクトリに保存する。vite.config が `LAUNCH_E2E=1` を見て cloudflare plugin の `persistState.path` を切り替え、playwright の webServer + globalSetup が `--persist-to .wrangler-e2e/state` を渡す。dev 側は `.wrangler/state` のまま。これで E2E の wipe がブラウザ操作中のデータを壊さない。seed 系ヘルパ (`tests/e2e/helpers/seed.ts`) は `WRANGLER_PERSIST_TO` env var を見て同じ path に書き込む。

### モックは本番と等価に動く

`MOCK_AUTH=true` で起動すると `/auth/login` が GitHub OAuth の代わりに `allowed-users.json` のユーザー選択画面になる。本物の OAuth と同じ session cookie・同じ DB 書き込みを行うので、mock で動けば本番でも動く。**mock で隠れる仕様分岐を作らない** — 例えば「mock のときだけ permission チェックをスキップ」みたいなのは禁止。

### Worker は Terraform 管理下

`workers_dev = false`、ルーティングは別リポジトリ (skinfra/infra) の Terraform で管理。`name = "launch"` は Terraform の `script_name` と一致させる必要があり、変更不可。`compatibility_date` などアプリ側の設定だけ自由に変えてよい。

### Datetime は JST 表示・ISO 保存

D1 には ISO-8601 TEXT で保存。UI 表示は必ず `timeZone: "Asia/Tokyo"` で、ラベルに "JST" を付ける (例: `APR 20, 2026 · 14:00 JST`)。

## コマンド

```bash
pnpm dev                 # ローカル開発 (port 5180)
pnpm typecheck           # 触ったあとは必ず通す
pnpm lint                # コミット前
pnpm db:migrate:local    # 新規 migration 作ったあと
pnpm run deploy          # 本番デプロイ (CI が main push で自動実行)
```

ローカル DB を seed したいときは `pnpm wrangler d1 execute launch-db --local --file=migrations/_seed_dev.sql`。`_seed_dev.sql` は `_` プレフィックスなので migration として扱われない手動投入用。

## 触る前に読むべきファイル

- `src/index.tsx` — ルート全体の入口
- `mission-templates.json` — ミッション種別と callsign パターン
- `migrations/0001_initial.sql` — スキーマ全体 (users / sites / missions / participants / schedule_polls / schedule_poll_options / schedule_votes)
- `sites.json` — デフォルト登録地点（`allowed-users.json` と同流儀で PR 管理、`pnpm sites:sync` で D1 に upsert）
- `src/style.css` — デザイン定数 (color, font, animation keyframes) すべてここに集約

## Sites の扱い

- `sites` テーブルに登録地点を保存。`is_default=1` は `sites.json` 由来で編集・削除不可。
- **「launch site」と「target」は同じ sites テーブルを2つの用途で参照する**。missions は `launch_site_id` (出発点) と `target_id` (目的地) の両方の FK を持ち、それぞれ `launch_site` / `target_orbit` TEXT カラムに名前を denormalize (一覧 UI は JOIN 不要)。Visit テンプレでは launch_site を使わず target だけセットする想定 ([src/views/pages/mission-form.tsx](src/views/pages/mission-form.tsx) の `.mission-form-launch-site` に CSS `:has()` で visit 時は非表示)。
- visibility は site では `public / authenticated / private` (private = 作成者のみ)。missions の `participants` 概念は地点に合わないので意図的に別物にした。
- 画像 source は `url / upload / google_places` の3択。R2 binding 名は `SITE_IMAGES`。Google Places Photos は `/sites/:slug/photo` で proxy 配信し、attribution を必ず表示。
- **Photo キャッシュ**: `/photo` は R2 の `google-photo-cache/<site.id>.jpg` を先に読む。`customMetadata.photo_name` が DB 側と一致すれば HIT。再 auto-fetch で photo_name が変われば次回自動更新。site 削除・画像アップロードで cache も invalidate。
- `GOOGLE_MAPS_API_KEY` 未設定時は pages が `/photo` URL を出さず (= `<img>` 壊れない)、auto-fetch ボタンも非表示、`/photo` route は 404 を返す。
- **Hero 画像のフォールバック順序** ([src/lib/hero-image.ts](src/lib/hero-image.ts) の `pickHeroImage`): launch_site → target → Tsukuba H-II。Visit ミッションは launch_site がないので target の画像が hero になる。
- **site の削除制約**: missions から `launch_site_id` か `target_id` のどちらかで参照されていたら 409 で拒否。移行時は先にミッション側を scrub / edit しておく。

## 本番デプロイ手順

CI は main push で Worker deploy のみ自動実行する。**migration と sites:sync は D1 への書き込みなので、main push では走らない**。

**Actions 経由 (推奨)**:
- `Apply D1 migrations` workflow: スキーマ変更適用。`Run workflow` → confirm 欄に `YES` を入力 → 実行。
- `Sync default sites` workflow: `sites.json` を D1 に upsert (冪等)。初回 deploy / `sites.json` 更新時に実行。

**ローカル CLI**:
```bash
# 1. 本番 D1 に未適用の migration を当てる
pnpm db:migrate:remote

# 2. sites.json の is_default 行を upsert
pnpm sites:sync:remote
```

### 検証

```bash
# 期待するテーブルが揃っているか
pnpm wrangler d1 execute launch-db --remote --command \
  "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"

# default site (tsukuba-bldg-a, ariake) が is_default=1 で入っているか
pnpm wrangler d1 execute launch-db --remote --command \
  "SELECT slug, is_default FROM sites WHERE is_default = 1"
```

本番 URL を実際に開いて、sites 一覧・mission detail の hero 画像・Launch Site / Target リンクが生きていることを目視確認して完了。

## Google Maps API キー

### 取得手順
1. Google Cloud Console で project 作成 or 選択
2. **APIs & Services → Library** → **Places API (New)** を Enable (レガシー版ではなく新版)
3. **APIs & Services → Credentials** → **Create credentials → API key**
4. Key の Restrictions:
   - Application restrictions: **None** (Worker は cloudflare edge の可変 IP から叩くので referer/IP 制限は非現実的)
   - API restrictions: **Places API (New) のみ** を選択 (他 API で乱用されない防御)
5. **Billing account 必須**。Places API は $200/月の free credit 対象で、この規模の内輪ツールなら実質無料
6. 追加で quota cap を Console で設定しておくと事故防止 (例: Text Search 1000/day, Photo 2000/day)

### ローカルでキー検証
`.dev.vars` に `GOOGLE_MAPS_API_KEY=<key>` を書いたあと:

```bash
pnpm places:smoke "カレーうどん ZEYO. つくば"
# → first place の place_id と photo media URL を出力。失敗なら原因 (403/INVALID_ARGUMENT等) がそのまま見える
```

`scripts/places-smoke.mjs` は dev server 不要で API 直叩きするので、key 自体の問題か worker 経由の問題かを分離できる。

### ローカルで UI 全体を実 API で動作確認
```bash
# .dev.vars に実キーを書く (GOOGLE_PLACES_BASE_URL は空のまま = 本番 endpoint)
pnpm dev
# → http://localhost:5180/sites/new で "Auto-fetch from Google" に✓して作成
# → 初回は Google を叩く、2回目以降は R2 (.wrangler/state 配下) から配信
```

E2E (`pnpm test:e2e`) は `.dev.vars.e2e` で自動的に mock (`localhost:5181`) に切り替わるので、ローカルの `.dev.vars` の実キーを上書きしない。teardown で元に戻る。

### プロダクション
`wrangler secret put GOOGLE_MAPS_API_KEY` で deploy 先に設定。`.dev.vars` には置かない (git ignore 済みだが混入防止)。
