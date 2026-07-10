# 営業日報システム API仕様書

本書は [requirements.md](./requirements.md)（機能要件 F-01〜F-42）および [screen_definition.md](./screen_definition.md)（画面 SC-01〜SC-09）を実現するためのREST API仕様を定義する。

## 1. 共通仕様

### 1.1 ベースURL

```
https://{host}/api
```

### 1.2 認証・認可

- Bearer トークン方式（`Authorization: Bearer <token>`）。SC-01でのログイン成功時に発行する
- ログイン不要なエンドポイントは `POST /auth/login` のみ
- ロールは1人の社員が複数持てる（例: 営業 兼 上長）。`EMPLOYEE.role` は配列として扱う: `["SALES", "MANAGER", "ADMIN"]`
- 認可ルールの詳細は [6. 認可マトリクス](#6-認可マトリクス) を参照

### 1.3 リクエスト／レスポンス共通形式

- Content-Type: `application/json`
- 日付: `YYYY-MM-DD`、日時: `YYYY-MM-DDThh:mm:ssZ`（ISO 8601, UTC）
- 一覧系レスポンスは以下のエンベロープ形式とする

```json
{
  "data": [ ... ],
  "meta": {
    "page": 1,
    "page_size": 20,
    "total_count": 42
  }
}
```

- 単体取得・作成・更新系は `data` 直下にオブジェクトを返す

```json
{
  "data": { ... }
}
```

### 1.4 エラーレスポンス形式

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "顧客を1件以上選択してください",
    "details": [
      { "field": "visit_records[0].customer_id", "message": "必須項目です" }
    ]
  }
}
```

| HTTPステータス | code | 説明 |
|---|---|---|
| 400 | VALIDATION_ERROR | 入力値不正 |
| 401 | UNAUTHENTICATED | 未ログイン・トークン無効 |
| 403 | FORBIDDEN | 権限不足（例: 自分の部下でない日報へのコメント） |
| 404 | NOT_FOUND | 対象リソースが存在しない |
| 409 | CONFLICT | 一意制約違反（例: 同一日付の日報が既に存在） |
| 500 | INTERNAL_ERROR | サーバー内部エラー |

### 1.5 共通クエリパラメータ（一覧系）

| パラメータ | 型 | 説明 |
|---|---|---|
| page | integer | ページ番号（デフォルト1） |
| page_size | integer | 1ページ件数（デフォルト20、最大100） |

---

## 2. 認証API

### 2.1 ログイン

`POST /auth/login`

対応画面: SC-01

**リクエスト**

```json
{
  "email": "sales01@example.com",
  "password": "********"
}
```

**レスポンス 200**

```json
{
  "data": {
    "token": "eyJhbGciOi...",
    "employee": {
      "employee_id": 101,
      "name": "山田太郎",
      "email": "sales01@example.com",
      "department_id": 10,
      "manager_id": 5,
      "role": ["SALES"]
    }
  }
}
```

**エラー**: 401 UNAUTHENTICATED（メールアドレス／パスワード不一致）

### 2.2 ログアウト

`POST /auth/logout`

トークンを無効化する。レスポンス 204 No Content

### 2.3 ログインユーザー情報取得

`GET /auth/me`

対応画面: SC-02（ホーム画面のヘッダー表示等）

**レスポンス 200**: 2.1 の `employee` と同形式

---

## 3. 日報API

### 3.1 日報一覧取得

`GET /daily-reports`

対応画面: SC-03（自分の日報一覧）／SC-06（部下日報一覧）

**クエリパラメータ**

| パラメータ | 型 | 必須 | 説明 |
|---|---|---|---|
| employee_id | integer | 任意 | 対象社員ID。省略時はログイン本人の日報 |
| from | date | 任意 | 期間絞り込み（開始日） |
| to | date | 任意 | 期間絞り込み（終了日） |

**認可**: `employee_id` がログイン本人以外の場合、ログインユーザーが対象社員の `manager_id` であることを要する（SC-06のアクセス制御）。一致しない場合は 403 FORBIDDEN

**レスポンス 200**

```json
{
  "data": [
    {
      "report_id": 5001,
      "employee_id": 101,
      "employee_name": "山田太郎",
      "report_date": "2026-07-09",
      "visit_count": 3,
      "problem_summary": "A社の見積が難航...",
      "plan_summary": "B社に再訪問予定",
      "comment_count": 2,
      "created_at": "2026-07-09T18:32:00Z",
      "updated_at": "2026-07-09T19:00:00Z"
    }
  ],
  "meta": { "page": 1, "page_size": 20, "total_count": 1 }
}
```

### 3.2 日報詳細取得

`GET /daily-reports/{report_id}`

対応画面: SC-04（編集時の初期表示）／SC-05（部下用詳細）

**レスポンス 200**

```json
{
  "data": {
    "report_id": 5001,
    "employee_id": 101,
    "employee_name": "山田太郎",
    "report_date": "2026-07-09",
    "problem": "A社の見積が難航しており、価格面での再検討が必要です。",
    "plan": "B社に再訪問し、追加要件をヒアリングする。",
    "visit_records": [
      {
        "visit_id": 9001,
        "customer_id": 301,
        "customer_name": "株式会社A社",
        "visit_time": "2026-07-09T10:00:00Z",
        "content": "見積内容について協議。価格交渉が難航。",
        "sort_order": 1
      },
      {
        "visit_id": 9002,
        "customer_id": 302,
        "customer_name": "株式会社B社",
        "visit_time": "2026-07-09T14:00:00Z",
        "content": "新規要件のヒアリング。",
        "sort_order": 2
      }
    ],
    "created_at": "2026-07-09T18:32:00Z",
    "updated_at": "2026-07-09T19:00:00Z"
  }
}
```

**認可**: 本人、または対象社員の直属の上長のみ取得可（3.1と同様）

**エラー**: 404 NOT_FOUND（存在しない report_id）／403 FORBIDDEN（権限なし）

### 3.3 日報新規作成

`POST /daily-reports`

対応画面: SC-04（新規作成時）／機能: F-01, F-02, F-10, F-11, F-20

**リクエスト**

```json
{
  "report_date": "2026-07-10",
  "problem": "既存顧客からのクレーム対応に時間を要している。",
  "plan": "C社訪問、見積提出。",
  "visit_records": [
    {
      "customer_id": 303,
      "visit_time": "2026-07-10T09:30:00Z",
      "content": "定期訪問。追加発注の可能性あり。"
    }
  ]
}
```

- `employee_id` はトークンから解決するため指定不要（自分の日報のみ作成可）

**レスポンス 201**: 3.2 と同形式のオブジェクト

**エラー**

- 409 CONFLICT: 同一 `(employee_id, report_date)` の日報が既に存在する（F-02）
- 400 VALIDATION_ERROR: `visit_records[].customer_id` が顧客マスタに存在しない、等

### 3.4 日報更新

`PUT /daily-reports/{report_id}`

対応画面: SC-04（編集時）／機能: F-03

**リクエスト**: 3.3 と同形式（`report_date` は変更不可のため送信不要）

- `visit_records` は**全件置き換え**とする。既存の `visit_id` を含めて送信された行は更新、含まれない既存行は削除、`visit_id` を含まない新規行は追加として扱う

```json
{
  "problem": "価格交渉が決着。契約条件の最終調整段階。",
  "plan": "契約書ドラフトをA社へ送付。",
  "visit_records": [
    { "visit_id": 9001, "customer_id": 301, "visit_time": "2026-07-09T10:00:00Z", "content": "見積内容について協議。価格交渉が決着。" },
    { "customer_id": 304, "visit_time": "2026-07-09T16:00:00Z", "content": "追加で立ち寄り訪問。" }
  ]
}
```

**レスポンス 200**: 3.2 と同形式

**認可**: 本人の日報のみ更新可（上長は更新不可、コメントのみ）

**エラー**: 403 FORBIDDEN（他人の日報）／404 NOT_FOUND

---

## 4. コメントAPI

### 4.1 コメント一覧取得

`GET /daily-reports/{report_id}/comments`

対応画面: SC-04（閲覧）／SC-05（閲覧）

**クエリパラメータ**

| パラメータ | 型 | 必須 | 説明 |
|---|---|---|---|
| target | string | 任意 | `PROBLEM` または `PLAN`。省略時は両方を返す |

**レスポンス 200**

```json
{
  "data": [
    {
      "comment_id": 7001,
      "report_id": 5001,
      "employee_id": 5,
      "employee_name": "鈴木部長",
      "target": "PROBLEM",
      "content": "価格面は一度持ち帰って相談しましょう。",
      "created_at": "2026-07-09T20:00:00Z"
    },
    {
      "comment_id": 7002,
      "report_id": 5001,
      "employee_id": 5,
      "employee_name": "鈴木部長",
      "target": "PROBLEM",
      "content": "明日の朝ミーティングで詳細確認します。",
      "created_at": "2026-07-10T08:10:00Z"
    }
  ],
  "meta": { "page": 1, "page_size": 20, "total_count": 2 }
}
```

**認可**: 日報の作成者本人、または作成者の直属の上長のみ閲覧可

### 4.2 コメント投稿

`POST /daily-reports/{report_id}/comments`

対応画面: SC-05／機能: F-30, F-31, F-32

**リクエスト**

```json
{
  "target": "PLAN",
  "content": "B社訪問時は事前に見積を持参してください。"
}
```

**レスポンス 201**: 4.1 の要素と同形式

**認可**: ログインユーザーが対象日報の `employee_id` の `manager_id` であることを要する（F-30）。一致しない場合は 403 FORBIDDEN

**エラー**: 400 VALIDATION_ERROR（`target` が PROBLEM/PLAN 以外、`content` が空）

---

## 5. マスタAPI

### 5.1 顧客マスタ

対応画面: SC-07／機能: F-40

| メソッド | パス | 概要 | 権限 |
|---|---|---|---|
| GET | /customers | 一覧取得（`search` で顧客名部分一致検索） | 全ロール（訪問記録入力時の選択にも使用） |
| GET | /customers/{customer_id} | 詳細取得 | 全ロール |
| POST | /customers | 新規登録 | 管理者 |
| PUT | /customers/{customer_id} | 更新 | 管理者 |
| DELETE | /customers/{customer_id} | 削除 | 管理者 |

**リクエスト例（POST/PUT）**

```json
{
  "name": "株式会社A社",
  "address": "東京都千代田区...",
  "phone": "03-1234-5678",
  "owner_employee_id": 101
}
```

**レスポンス例**

```json
{
  "data": {
    "customer_id": 301,
    "name": "株式会社A社",
    "address": "東京都千代田区...",
    "phone": "03-1234-5678",
    "owner_employee_id": 101,
    "owner_employee_name": "山田太郎"
  }
}
```

**エラー**: 409 CONFLICT（VISIT_RECORDに紐づく顧客をDELETEしようとした場合。運用上は削除不可とし、代わりに無効化フラグの導入を今後検討）

### 5.2 社員マスタ

対応画面: SC-08／機能: F-41

| メソッド | パス | 概要 | 権限 |
|---|---|---|---|
| GET | /employees | 一覧取得（`search`, `department_id` で絞り込み） | 管理者 |
| GET | /employees/{employee_id} | 詳細取得 | 管理者、または本人 |
| GET | /employees/{employee_id}/subordinates | 直属の部下一覧取得（SC-06の対象社員選択用） | 管理者、または本人（上長の場合） |
| POST | /employees | 新規登録 | 管理者 |
| PUT | /employees/{employee_id} | 更新 | 管理者 |
| DELETE | /employees/{employee_id} | 削除 | 管理者 |

**リクエスト例（POST/PUT）**

```json
{
  "name": "山田太郎",
  "email": "sales01@example.com",
  "department_id": 10,
  "manager_id": 5,
  "role": ["SALES"]
}
```

**バリデーション**

- `manager_id` に自分自身のIDを指定不可
- `manager_id` を辿った際に循環参照（例: A→B→A）が発生する場合は 400 VALIDATION_ERROR

### 5.3 部署マスタ

対応画面: SC-09／機能: F-42

| メソッド | パス | 概要 | 権限 |
|---|---|---|---|
| GET | /departments | 一覧取得（階層構造を含むツリー形式、または `parent_department_id` によるフラット取得） | 全ロール（社員登録時の選択等に使用） |
| GET | /departments/{department_id} | 詳細取得 | 全ロール |
| POST | /departments | 新規登録 | 管理者 |
| PUT | /departments/{department_id} | 更新 | 管理者 |
| DELETE | /departments/{department_id} | 削除 | 管理者 |

**リクエスト例（POST/PUT）**

```json
{
  "name": "第一営業部",
  "parent_department_id": 1
}
```

**バリデーション**: `parent_department_id` に自分自身のIDおよび自分の配下部署のIDを指定不可（循環参照防止）

**エラー**: 409 CONFLICT（所属社員が存在する部署をDELETEしようとした場合）

---

## 6. 認可マトリクス

| エンドポイント | 営業担当者 | 上長 | 管理者 |
|---|---|---|---|
| POST /auth/login, /auth/logout, GET /auth/me | ○ | ○ | ○ |
| GET /daily-reports（自分） | ○ | ○ | - |
| GET /daily-reports（部下指定） | - | ○（自分の部下のみ） | - |
| GET / POST / PUT /daily-reports（自分の日報） | ○ | ○（営業兼務時） | - |
| GET /daily-reports/{id}/comments | ○（自分の日報） | ○（自分の部下の日報） | - |
| POST /daily-reports/{id}/comments | - | ○（自分の部下の日報のみ） | - |
| GET /customers, /departments | ○ | ○ | ○ |
| POST/PUT/DELETE /customers, /employees, /departments | - | - | ○ |
| GET /employees/{id}/subordinates | - | ○（本人分） | ○ |

## 7. 今後の検討事項

- 一覧取得APIの並び順指定（`sort` パラメータ）の要否
- 顧客・社員・部署マスタの論理削除（無効化）方式への変更
- コメント投稿時の通知（メール／プッシュ通知）用Webhook・イベントAPIの追加
- トークンのリフレッシュ方式（有効期限・リフレッシュトークン発行）の詳細設計
