# 営業日報システム テスト仕様書

本書は [requirements.md](./requirements.md)（機能要件 F-01〜F-42）、[screen_definition.md](./screen_definition.md)（画面 SC-01〜SC-09）、[api_specification.md](./api_specification.md)（API仕様）に基づき、システムテスト（機能結合レベル）のテストケースを定義する。

## 1. 目的・スコープ

- 目的: 実装がF-01〜F-42の機能要件を満たし、画面・APIが仕様通りに動作することを検証する
- 対象: 正常系動作、入力バリデーション、権限（認可）制御、一意制約・整合性制約
- 対象外（本書では扱わない）: 単体テスト（関数・メソッド単位）、負荷・性能テストの詳細シナリオ、UIの見た目・レイアウトの検証

## 2. テストレベル

| レベル | 内容 | 主な対象 |
|---|---|---|
| 単体テスト | 各APIエンドポイント単体の入出力検証 | api_specification.md 各エンドポイント |
| 結合・機能テスト | 画面操作を通じたAPI一連の呼び出し検証 | screen_definition.md 各画面 |
| シナリオテスト（E2E） | 営業担当者・上長をまたぐ一連の業務フロー | 複数画面・複数ロードにまたがるフロー |

本書の第4章は結合・機能テスト、第5章はシナリオテストのケースを扱う。

## 3. テスト前提データ

| 区分 | データ例 |
|---|---|
| 部署 | D1: 営業本部（上位なし） / D2: 第一営業部（親: D1） |
| 社員 | E1: 鈴木部長（role: MANAGER, department: D1, manager_id: null） / E2: 山田太郎（role: SALES, department: D2, manager_id: E1） / E3: 佐藤花子（role: SALES, department: D2, manager_id: E1） / E9: 他部署社員（role: MANAGER, E2/E3の上長ではない） |
| 顧客 | C1: 株式会社A社（owner: E2） / C2: 株式会社B社（owner: E2） |

以降のテストケースは本データを前提とする。

## 4. 機能テストケース

### 4.1 認証・認可（共通）

| ID | 目的 | 前提条件 | 手順 | 期待結果 | 優先度 |
|---|---|---|---|---|---|
| TC-AUTH-01 | 正しい認証情報でログインできる | E2のアカウントが存在 | `POST /auth/login` に正しいemail/passwordを送信 | 200、tokenとemployee情報が返る（SC-01） | 高 |
| TC-AUTH-02 | 誤った認証情報でログインできない | 同上 | 誤ったpasswordで `POST /auth/login` | 401 UNAUTHENTICATED | 高 |
| TC-AUTH-03 | 未ログインでAPIを呼べない | トークンなし | `GET /daily-reports` をAuthorizationヘッダなしで呼び出す | 401 UNAUTHENTICATED | 高 |
| TC-AUTH-04 | ログアウト後はトークンが無効化される | E2でログイン済み | `POST /auth/logout` 後、同トークンで `GET /auth/me` | 401 UNAUTHENTICATED | 中 |

### 4.2 日報作成・編集（F-01, F-02, F-03, F-10, F-11, F-20 / SC-04）

| ID | 目的 | 前提条件 | 手順 | 期待結果 | 優先度 |
|---|---|---|---|---|---|
| TC-DR-01 | 訪問記録1件・Problem・Planを含む日報を新規作成できる | E2でログイン、2026-07-10分の日報なし | `POST /daily-reports` に report_date, problem, plan, visit_records[1件] を送信 | 201、登録内容がレスポンスに反映される | 高 |
| TC-DR-02 | 訪問記録を複数行登録できる | 同上 | visit_records に2件（顧客C1, C2）を含めて作成 | 201、`GET /daily-reports/{id}` で2件とも取得できる（F-11） | 高 |
| TC-DR-03 | 同一日付で2件目の日報は作成できない | E2が2026-07-10の日報を作成済み | 同日付で再度 `POST /daily-reports` | 409 CONFLICT（F-02） | 高 |
| TC-DR-04 | 作成済み日報を再編集できる | TC-DR-01で作成済み | `PUT /daily-reports/{id}` でproblemを変更して送信 | 200、内容が更新される。ステータス制限なく何度でも編集可（F-03） | 高 |
| TC-DR-05 | 訪問記録の全件置き換えが正しく行われる | 訪問記録2件の日報が存在 | `PUT` で1件のvisit_idを含む行＋visit_idなしの新規行を送信 | 既存の含まれない行は削除、既存行は更新、新規行は追加される（3.4節仕様通り） | 中 |
| TC-DR-06 | 訪問記録の顧客未指定では保存できない | - | visit_records[0].customer_id を欠落させて `POST` | 400 VALIDATION_ERROR | 中 |
| TC-DR-07 | Problem/Planは空でも保存できる | - | problem, planを空文字列/未指定で `POST` | 201（任意項目のため成功） | 低 |
| TC-DR-08 | 他人の日報は更新できない | E3が作成した日報が存在 | E2でログインし、E3の report_id に対し `PUT` | 403 FORBIDDEN | 高 |
| TC-DR-09 | 存在しない日報IDへのアクセス | - | 存在しないreport_idで `GET /daily-reports/{id}` | 404 NOT_FOUND | 中 |

### 4.3 日報一覧・閲覧（SC-03, SC-05, SC-06）

| ID | 目的 | 前提条件 | 手順 | 期待結果 | 優先度 |
|---|---|---|---|---|---|
| TC-DR-10 | 自分の日報一覧を期間指定で取得できる | E2に複数日分の日報あり | `GET /daily-reports?from=2026-07-01&to=2026-07-10` | 200、期間内の自分の日報のみ返る | 高 |
| TC-DR-11 | 上長は自分の部下の日報一覧を取得できる | E1がE2の上長 | E1でログインし `GET /daily-reports?employee_id=E2` | 200、E2の日報一覧が返る（F-30, SC-06） | 高 |
| TC-DR-12 | 上長は自分の部下でない社員の日報一覧を取得できない | E9はE2の上長ではない | E9でログインし `GET /daily-reports?employee_id=E2` | 403 FORBIDDEN | 高 |
| TC-DR-13 | 営業担当者は他人の日報詳細を取得できない | - | E3でログインし、E2の report_id で `GET /daily-reports/{id}` | 403 FORBIDDEN | 高 |

### 4.4 コメント（F-30, F-31, F-32 / SC-05）

| ID | 目的 | 前提条件 | 手順 | 期待結果 | 優先度 |
|---|---|---|---|---|---|
| TC-CM-01 | 上長はProblemにコメントを投稿できる | E1がE2の上長、E2のdaily_reportあり | E1で `POST /daily-reports/{id}/comments`（target: PROBLEM） | 201、コメントが登録される | 高 |
| TC-CM-02 | 同一Problemに複数回・複数上長がコメントするとスレッド表示される | E1, E9（仮に共同上長とする場合）がコメント投稿 | 複数回コメント投稿後 `GET /daily-reports/{id}/comments?target=PROBLEM` | 投稿順（時系列）で全件返る（F-31） | 高 |
| TC-CM-03 | 部下でない社員の日報にはコメントできない | E9はE2の上長ではない | E9で `POST /daily-reports/{id}/comments`（E2の日報） | 403 FORBIDDEN | 高 |
| TC-CM-04 | 営業担当者はコメントを投稿できない | - | E3（営業のみ）で自分の部下でもない日報へコメント投稿を試みる | 403 FORBIDDEN | 中 |
| TC-CM-05 | targetがPROBLEM/PLAN以外は登録できない | - | target: "OTHER" で `POST` | 400 VALIDATION_ERROR | 中 |
| TC-CM-06 | 本文が空のコメントは登録できない | - | content: "" で `POST` | 400 VALIDATION_ERROR | 低 |
| TC-CM-07 | targetを省略した場合、Problem/Plan両方のコメントが取得できる | Problem/Plan双方にコメントあり | `GET /daily-reports/{id}/comments`（target省略） | 200、両方のコメントが返る | 低 |

### 4.5 顧客マスタ（F-40 / SC-07）

| ID | 目的 | 前提条件 | 手順 | 期待結果 | 優先度 |
|---|---|---|---|---|---|
| TC-CUST-01 | 管理者は顧客を新規登録できる | 管理者ロールでログイン | `POST /customers` | 201、登録される | 高 |
| TC-CUST-02 | 顧客名で部分一致検索できる | C1「株式会社A社」が存在 | `GET /customers?search=A社` | 200、C1が含まれる | 中 |
| TC-CUST-03 | 管理者以外は顧客を登録できない | 一般営業でログイン | `POST /customers` | 403 FORBIDDEN | 高 |
| TC-CUST-04 | 訪問記録に紐づく顧客は削除できない | C1がVISIT_RECORDから参照されている | `DELETE /customers/{C1}` | 409 CONFLICT | 中 |

### 4.6 社員マスタ（F-41 / SC-08）

| ID | 目的 | 前提条件 | 手順 | 期待結果 | 優先度 |
|---|---|---|---|---|---|
| TC-EMP-01 | 管理者は社員を新規登録できる（部署・上長設定含む） | 管理者ログイン | `POST /employees`（department_id, manager_id指定） | 201、登録される | 高 |
| TC-EMP-02 | 自分自身を直属の上長に設定できない | 既存社員E2を更新 | `PUT /employees/E2`（manager_id: E2） | 400 VALIDATION_ERROR | 中 |
| TC-EMP-03 | 循環参照になる上長設定はできない | E1の上長がE2になっている状態を作ろうとする（E2の上長は既にE1） | `PUT /employees/E1`（manager_id: E2） | 400 VALIDATION_ERROR（循環参照検知） | 中 |
| TC-EMP-04 | 上長は自分の部下一覧を取得できる | E1がE2, E3の上長 | E1で `GET /employees/E1/subordinates` | 200、E2, E3が返る | 中 |

### 4.7 部署マスタ（F-42 / SC-09）

| ID | 目的 | 前提条件 | 手順 | 期待結果 | 優先度 |
|---|---|---|---|---|---|
| TC-DEPT-01 | 管理者は部署を新規登録できる（上位部署設定含む） | 管理者ログイン | `POST /departments`（parent_department_id指定） | 201、登録される | 高 |
| TC-DEPT-02 | 自分自身を上位部署に設定できない | D2を更新 | `PUT /departments/D2`（parent_department_id: D2） | 400 VALIDATION_ERROR | 中 |
| TC-DEPT-03 | 循環参照になる上位部署設定はできない | D2の親がD1、D1の親をD2にしようとする | `PUT /departments/D1`（parent_department_id: D2） | 400 VALIDATION_ERROR | 中 |
| TC-DEPT-04 | 所属社員がいる部署は削除できない | D2にE2, E3が所属 | `DELETE /departments/D2` | 409 CONFLICT | 中 |

## 5. シナリオテスト（E2E）

### TS-01: 日報作成からコメント確認までの一連の流れ

対象ロール: 営業担当者（E2）、上長（E1）

| No | 実施者 | 操作 | 確認内容 |
|---|---|---|---|
| 1 | E2 | SC-01でログイン | ログイン成功、SC-02表示 |
| 2 | E2 | SC-02からSC-03へ遷移、「新規作成」押下 | SC-04が表示される |
| 3 | E2 | 訪問記録2行（C1, C2）、Problem、Planを入力し保存 | SC-03の一覧に本日分が表示される |
| 4 | E1 | SC-01でログイン | ログイン成功 |
| 5 | E1 | SC-02からSC-06へ遷移 | E2の本日の日報が一覧に表示される |
| 6 | E1 | 一覧からE2の日報を選択 | SC-05に訪問記録・Problem・Planが表示される |
| 7 | E1 | Problemに対してコメントを投稿 | 投稿したコメントがスレッドに即時反映される |
| 8 | E1 | Planに対しても続けてコメントを投稿 | 同様にスレッドに反映される |
| 9 | E2 | 再度ログインし、SC-03から該当日報を開く | SC-04にE1のコメントが2件（Problem, Plan）とも表示される |
| 10 | E1 | 同じProblemに再度コメントを投稿 | 既存コメントの下に時系列で追加され、スレッドとして残る（F-31） |

### TS-02: マスタ管理から日報作成までの一連の流れ

対象ロール: 管理者、営業担当者

| No | 実施者 | 操作 | 確認内容 |
|---|---|---|---|
| 1 | 管理者 | SC-09で新規部署を登録 | 一覧に反映される |
| 2 | 管理者 | SC-08で新規社員を登録（1で作成した部署、上長を設定） | 一覧に反映される |
| 3 | 管理者 | SC-07で新規顧客を登録（担当営業に2で作成した社員を設定） | 一覧に反映される |
| 4 | 新規社員 | ログイン後、SC-04で3の顧客を訪問記録に選択して日報作成 | 保存成功、顧客名が正しく表示される |

## 6. 非機能テスト観点（参考）

| 観点 | 確認内容 |
|---|---|
| 認可の網羅性 | 6章（api_specification.mdの認可マトリクス）の全組み合わせについて、許可される操作・拒否される操作が仕様通りであることを確認 |
| ページング | 一覧APIで `page_size` を超えるデータを投入し、`meta.total_count` とページ送りが正しいこと |
| 入力サニタイズ | 訪問内容・Problem・Plan・コメント本文にHTML/スクリプトタグを含む文字列を入力し、画面表示時にエスケープされること（XSS対策） |
| 一意制約 | 同一 `(employee_id, report_date)` の同時作成リクエスト（多重送信）でも1件しか作成されないこと |

## 7. 今後の検討事項

- 単体テスト（各バリデーションロジック・循環参照検知ロジック等）のテストケースは別途詳細化する
- 性能テスト（大量日報データ・大量訪問記録における一覧表示速度）のシナリオ策定
- ブラウザ・デバイス別の表示確認（レスポンシブ対応が要件化された場合）
