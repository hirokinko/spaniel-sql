# spaniel-sql

GoogleSQLの固定読み取りクエリをSpannerで解析し、TypeScriptの引数型・結果型・実行関数を生成するライブラリです。

実装中のため、旧DSLも一時的に残っています。Cloud Spannerでの統合検証後に旧DSLを撤去します。仕様と制約は [ADR-0001](docs/specs/0001-spanner-native-typed-sql-core.md) を参照してください。

## 生成と実行

Node.js >=22、既存のGoogleSQLデータベースとSDK標準の認証（ADC等）が必要です。生成処理はDBやテーブルを作成しません。

`sql/find-user.sql`:

```sql
SELECT UserId, Name FROM Users WHERE UserId = @userId
```

```sh
spaniel generate --sql sql --out src/generated \
  --project example-project --instance example-instance --database example-db
```

入力ディレクトリ配下のSQLをPLAN解析し、単一の `src/generated/queries.ts` を生成します。生成物を手修正しないでください。スキーマやSQLを変更した後は再生成します。

```ts
import { Spanner } from '@google-cloud/spanner';
import { createSpannerExecutor } from 'spaniel-sql';
import { findUser } from './generated/queries.js';

const spanner = new Spanner({ projectId: 'example-project' });
const database = spanner.instance('example-instance').database('example-db');
try {
  const rows = await findUser(createSpannerExecutor(database), { userId: 1n });
  for (const row of rows) {
    console.log(row.Name ?? '(未設定)');
  }
} finally {
  try { await database.close(); } finally { await spanner.close(); }
}
```

引数名・結果名はSQLどおりです。全パラメータ・結果列は保守的にnullableですが、キー省略・undefinedは許容しません。空結果は `[]`。渡された接続をライブラリが閉じることはありません。

生成APIも同じ検証規則を使います。

```ts
import { generate } from 'spaniel-sql/generator';
await generate({ sqlDir: 'sql', outDir: 'src/generated', database });
```

## 値の型

| SQL型 | 入力 / 結果（SQL値には `\| null` を付与） |
| --- | --- |
| STRING / BOOL / FLOAT64 | string / boolean / number |
| INT64 | bigint |
| NUMERIC | 既定number、明示指定Big |
| DATE | `Temporal.PlainDate`（polyfill） |
| TIMESTAMP | 入力Date、結果PreciseDate |
| BYTES | Buffer |
| JSON | JsonValue |
| ARRAY / STRUCT | 要素・名前付きフィールドへ再帰適用 |

Big、Temporal、PreciseDate、JsonValueは `spaniel-sql` から参照できます。numberの十進表記で元値を維持できないNUMERICは復号エラーにします。十進演算の厳密性が必要ならBigを指定してください。Bigの共有設定はライブラリから変更しません。

```sql
-- @spaniel param minimumAmount type=Big
-- @spaniel result TotalAmount type=Big
SELECT SUM(Amount) AS TotalAmount FROM Orders WHERE Amount >= @minimumAmount
```

先頭の独立した行コメントで当該SQLのパラメータ名・結果列名を指定します。存在しない名前・重複・NUMERICを含まない対象への指定はエラーです。ARRAY/STRUCTを指定すると内部のNUMERICすべてへ適用します。個別パス・DDLコメントからの継承は行いません。

DATEはタイムゾーン変換を経由しません。TIMESTAMPはDate互換性を持ち、SDKが保持するサブミリ秒を復号・再入力時に維持しますが、利用側のgetTimeや通常Dateへのコピーによる精度低下までは防ぎません。

JSON内部は通常のJS値です。SQL NULLとJSON nullの区別、大きな数値の厳密な往復は保証しません。undefined、非有限数、循環参照などは入力時に拒否します。アプリ固有の構造は取得後に別途検証してください。

```ts
import type { JsonValue } from 'spaniel-sql';
function readLabel(value: JsonValue): string {
  if (value === null || typeof value !== 'object' || Array.isArray(value) || typeof value.label !== 'string') {
    throw new Error('labelを持つオブジェクトが必要です');
  }
  return value.label;
}
```

## CI・テスト

生成物の更新漏れは `--check` で検出します。DBで再解析して比較しますが、ファイルは変更しません。終了コードは成功0、解析・生成・差分失敗1、CLI引数不備2です。

```sh
spaniel generate --sql sql --out src/generated \
  --project example-project --instance example-instance --database example-db --check
pnpm build
pnpm ci:check
```

Cloud Spanner統合テストは通常の単体テストと分離しています。既存の検証用DBを指定し、ADCを用意して実行します。設定不足を成功やskipとして扱いません。現在のfixtureは定数・パラメータのみの読み取りで、DBのDDL/DMLを実行しません。

```sh
SPANNER_PROJECT_ID=example-project \
SPANNER_INSTANCE_ID=example-instance \
SPANNER_DATABASE_ID=example-db pnpm test:integration
```

GitHub Actionsの手動実行でも統合テストを起動できます。Repository Variablesに上記3値と `SPANNER_WORKLOAD_IDENTITY_PROVIDER`、必要なら `SPANNER_SERVICE_ACCOUNT` を設定し、既存のWorkload Identity Federationを使います。通常のPRテストではCloudへの接続を要求しません。IAM・DB・認証連携の作成はこのリポジトリの生成処理では行いません。

## 移行と対象外

旧 `createDb` / `defineTable` / `ct` の定義とbuilder呼出しを、SQLファイルと生成関数へ置き換えます。旧DSLの互換層は提供しない予定です。

初版は固定の読み取り専用です。動的テンプレート、DML/DDL、マイグレーション、Omni管理、TOMLプロファイル、PostgreSQL方言は含みません。全行を配列で返すため、大きい結果はSQLで絞り込んでください。
