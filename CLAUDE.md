# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## プロジェクトの状態

営業日報システム（営業担当者が訪問記録・課題(Problem)・翌日予定(Plan)を日報として記録し、上長がProblem/Planにスレッド形式でコメントする仕組み）の設計ドキュメント一式に加え、Next.jsプロジェクトの雛形（`create-next-app` + shadcn/ui + Prisma + Vitest）を作成済み。Prismaの初期マイグレーション（`prisma/migrations/`）とローカル開発用シードスクリプト（`prisma/seed.ts`）も投入済み。画面・APIの実装自体はまだこれから。

実装を進める際は、下記4ドキュメントの内容と齟齬が出ないよう追従すること。Prismaスキーマ（`prisma/schema.prisma`）は `doc/requirements.md` 6章のER図をそのまま反映したもので、テーブル追加・変更時は両者を同期させること。

## よく使うコマンド

| コマンド | 内容 |
|---|---|
| `npm run dev` | 開発サーバー起動（Next.js, Turbopack） |
| `npm run build` | 本番ビルド |
| `npm run lint` | ESLint実行 |
| `npm run typecheck` | `tsc --noEmit` による型チェック |
| `npm run test` | Vitest実行（`src/**/*.test.{ts,tsx}` が対象） |
| `npm run test:watch` | Vitestをwatchモードで実行 |
| `npx vitest run path/to/file.test.ts` | 単一テストファイルのみ実行 |
| `npm run prisma:generate` | Prisma Clientの生成（`src/generated/prisma` に出力） |
| `npm run prisma:migrate` | ローカルDBへのマイグレーション適用（`DATABASE_URL` が必要） |
| `npm run prisma:seed` | `doc/test_specification.md` 3章のテスト前提データを投入（`prisma/seed.ts`） |
| `npx shadcn@latest add <component>` | shadcn/uiコンポーネントの追加 |
| `make ci` | lint / typecheck / test をまとめて実行（CIと同じ検証） |
| `make docker-build` | Cloud Run用Dockerイメージをビルド |
| `make deploy` | イメージのビルド・push・Cloud Runへのデプロイ（要`gcloud`認証） |
| `make release` | `make ci` → `npm run build` → `make deploy` を一気通貫で実行 |
| `make gcp-setup` | 初回のみ: 必要なAPI有効化とArtifact Registryリポジトリ作成 |
| `make help` | Makefileのターゲット一覧を表示 |

## 使用技術

| 分類 | 技術 |
|---|---|
| 言語 | TypeScript |
| フレームワーク | Next.js（App Router） |
| UIコンポーネント | shadcn/ui + Tailwind CSS |
| APIスキーマ定義 | OpenAPI（Zodによる検証） |
| DBスキーマ定義 | Prisma.js |
| テスト | Vitest |
| デプロイ | Google Cloud Run |
| Gitフック | husky + lint-staged（`git commit` 時にステージ済みの `*.{js,jsx,ts,tsx}` に対して `eslint --fix` を自動実行。設定は `package.json` の `lint-staged` フィールド。git hookは常にリポジトリルートをカレントディレクトリとして実行されるため、サブディレクトリから `git commit` した場合も同様に動作する） |

## ローカル開発環境のセットアップ

1. PostgreSQLを用意する（例: Dockerで一時的に起動する場合。`daily-report-postgres` という名前のコンテナが既に存在する場合は、このコマンドは失敗するので `docker start daily-report-postgres` で起動するか、不要なら `docker rm -f daily-report-postgres` してから再実行する）
   ```
   docker run -d --name daily-report-postgres \
     -e POSTGRES_USER=johndoe -e POSTGRES_PASSWORD=randompassword -e POSTGRES_DB=mydb \
     -p 5432:5432 postgres:16-alpine
   ```
2. `.env` に `DATABASE_URL`（例: `postgresql://johndoe:randompassword@localhost:5432/mydb?schema=public`）を設定する
3. `npm run prisma:migrate` でマイグレーションを適用する
4. `npm run prisma:seed` でテスト前提データ（`doc/test_specification.md` 3章の部署D1/D2・社員E1〜E3/E9・顧客C1/C2）を投入する

## 設計ドキュメント

要件定義・ER図・画面定義・API仕様・テスト仕様は以下の順に作成されており、相互に参照関係を持つ（後続ドキュメントは前のドキュメントのID（F-xx, SC-xx 等）をトレーサビリティのため参照している）。変更を加える際は関連ドキュメントの整合性も確認すること。

@doc/requirements.md
@doc/screen_definition.md
@doc/api_specification.md
@doc/test_specification.md

## アーキテクチャ概要

- **中心エンティティは社員（EMPLOYEE）の自己参照**: `manager_id` で直属の上長を表現しており、営業担当者・上長・管理者を分けたテーブルは持たない（1人が複数ロールを兼務可能）。組織階層は `DEPARTMENT` の自己参照（`parent_department_id`）で表現する
- **日報（DAILY_REPORT）が中核データ**: `(employee_id, report_date)` で一意。配下に訪問記録（`VISIT_RECORD`、1日報につき複数行）とコメント（`COMMENT`、Problem/Plan別のスレッド形式、投稿者は上長のみ）がぶら下がる
- **ステータス管理・承認フローは意図的に持たない**（要件定義 7章「今後の検討事項」参照）。日報は提出後も本人が自由に再編集できる設計
- **API設計の要点**: 訪問記録は日報の作成・更新APIに配列としてネストし、`visit_id` の有無で追加/更新/削除を判定する「全件置き換え方式」（個別のCRUDエンドポイントは持たない）。コメント投稿の認可は「対象日報の作成者の `manager_id` == ログインユーザー」で判定する
- **画面はロール別に3系統**: 営業担当者向け（日報一覧・作成編集）、上長向け（部下日報一覧・詳細閲覧＋コメント）、管理者向け（顧客・社員・部署の3マスタ管理）。画面定義書のSC-04（日報作成・編集）は上長のコメントを閲覧のみ表示し、返信投稿はSC-05（上長専用）でのみ行える点に注意
- **Prismaモデルの対応**: `prisma/schema.prisma` の `Employee` / `Department` / `CustomerMaster` / `DailyReport` / `VisitRecord` / `Comment` が、それぞれER図の `EMPLOYEE` / `DEPARTMENT` / `CUSTOMER` / `DAILY_REPORT` / `VISIT_RECORD` / `COMMENT` に対応する（`CUSTOMER` はPrismaの予約語衝突を避け `CustomerMaster` という命名にしている）

## ディレクトリ構成の要点

- `doc/`: 設計ドキュメント（本ファイルから `@doc/...` でインポート）
- `prisma/schema.prisma`: DBスキーマ（Prisma Client出力先は `src/generated/prisma`、gitignore対象）
- `prisma/migrations/`: マイグレーション履歴（`npm run prisma:migrate` で生成・適用）
- `prisma/seed.ts`: ローカル開発用シードスクリプト（`npm run prisma:seed` で実行、`doc/test_specification.md` 3章のデータを投入）
- `src/app/`: Next.js App Routerのルーティング
- `src/components/ui/`: shadcn/uiが生成するコンポーネント
- `src/lib/`: 共通ユーティリティ（`src/lib/utils.ts` はshadcn/ui標準の `cn()` ヘルパー）
- テストは実装ファイルと同階層に `*.test.ts` / `*.test.tsx` として配置する（Vitestの `include` 設定に準拠）

## CI/CD

GitHub Actions（`.github/workflows/ci-cd.yml`）でCI/CDを構成している。

- **testジョブ**: push・PR時に常時実行。`make ci`（lint/typecheck/test）と `make build` を実行
- **deployジョブ**: `main` ブランチへのpush時のみ実行。testジョブ成功後、Dockerイメージをビルドして Artifact Registry にpushし、Cloud Runへデプロイする
- デプロイ先: GCPプロジェクト `daily-report-502008` / リージョン `asia-northeast1` / Cloud Runサービス名 `daily-report`
- ビルド・デプロイの実コマンドは重複を避けるため `Makefile` に集約し、ワークフローからは `make <target>` を呼び出す構成
- **GCP認証はWorkload Identity Federationで設定済み**。GCPプロジェクト `daily-report-502008` に Workload Identity Pool `github-actions-pool` / Provider `github-actions-provider` を作成し、`FixedLemon/daily-report` リポジトリに限定した属性条件（`attribute.repository == "FixedLemon/daily-report"`）を設定。サービスアカウント `github-actions-deployer@daily-report-502008.iam.gserviceaccount.com` に `roles/run.admin` / `roles/artifactregistry.writer` / `roles/iam.serviceAccountUser` を付与し、GitHub Secrets `GCP_WIF_PROVIDER` / `GCP_WIF_SERVICE_ACCOUNT` に登録済み
- 初回セットアップ（API有効化・Artifact Registryリポジトリ `daily-report` 作成）は完了済み。新しい環境やプロジェクトを増やす場合のみ `make gcp-setup` を再実行する
- ローカルから手動デプロイする場合は `gcloud auth login` 後に `make deploy`
- デプロイ済みURL: `https://daily-report-533jguxdja-an.a.run.app`（Cloud Runが自動生成したURL。再デプロイで変わることがあるため、最新は `gcloud run services describe daily-report --project=daily-report-502008 --region=asia-northeast1` で確認）

## 注意事項

- `AGENTS.md`（`create-next-app` が生成）に記載の通り、本リポジトリのNext.jsは学習データ上の一般的なNext.jsと破壊的変更がある可能性がある。実装前に `node_modules/next/dist/docs/` の該当ガイドを確認すること
- Prisma 7の `prisma-client` ジェネレータ（`schema.prisma` の `generator client`）はURL直指定ではなくドライバアダプタを要求する。アプリケーションコードで `PrismaClient` をインスタンス化する際は、`prisma.config.ts` の設定だけでは不足しており、`new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) })`（`@prisma/adapter-pg` + `pg`）のように明示的にアダプタを渡す必要がある（`prisma/seed.ts` を参照）。ただし `prisma/seed.ts` は実行のたびにプロセスが終了する一回限りのスクリプトのため毎回 `new PrismaClient(...)` して問題ないが、Next.jsのAPIルート等アプリケーションコードでこのパターンをそのまま使うと、開発モードのホットリロードのたびに新しい接続プールが生成されてPostgresの `max_connections` を枯渇させる。アプリケーションコードで使う場合は `globalThis` にキャッシュするシングルトンパターン（`globalThis.prisma ??= new PrismaClient({ adapter })`）を用いること
- OpenAPIスキーマの生成方法（Zodスキーマからの自動生成ツール等）は未選定。実装時に方針を決めて本ファイルに追記すること
- GitHubリポジトリ: https://github.com/FixedLemon/daily-report （public、デフォルトブランチ `main`）
