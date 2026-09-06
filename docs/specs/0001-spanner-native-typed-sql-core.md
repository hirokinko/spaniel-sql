# ADR-0001: Spanner-native Typed SQLコアへの移行

- 状態: Accepted（採用済み・実装進行中、実DB受入検証は未完了）
- RFC実装状態: Implementing（2026-09-06独立検証で実装不備・未完了を確認）
- 独立検証: [Verification Results](../verification/0001/plan.md) / [issues](../verification/0001/issues.md)
- 決定日: 2026-09-06
- 対象: [GitHub Issue #1](https://github.com/hirokinko/spaniel-sql/issues/1)
- 元RFC: `issue-1-typed-sql-core`（Ready）
- 関連: [ロードマップ](../../ROADMAP.md)

## 背景

既存のDSL型クエリビルダーは、TypeScriptでテーブル定義を手動管理し、ASTからSQLとパラメータを生成する。実DBのスキーマ検証、SQLファイルからの型生成、クエリ実行は担っていない。

今後は通常のGoogleSQLを起点にし、SQLの意味と型の判断をSpannerへ委ねる。テーブルスキーマやSQLの型規則をTypeScript側に二重実装しない。また、取得値は可能な限りそのままアプリのロジックで扱える型にし、文字列から元の型を復元する規約を必須にしない。

本ADRはRFCで確定した仕様と判断理由を永続的に記録する。記載するCLI・生成APIは実装予定の契約であり、採用済みであることは実装・実DB検証の完了を意味しない。

## 決定

### 1. 固定SQLとSpannerによる解析を起点にする

初版はスキーマが用意されたGoogleSQLのSpanner DBに対する固定の読み取りクエリを扱う。1つのUTF-8 `.sql` ファイルに1クエリを記述する。WITH、JOIN、サブクエリ、集約、ウィンドウ関数を独自DSLへ変換しない。

SQL入力ディレクトリを再帰的に読み込み、コメント・改行・名前付きパラメータを保持する。末尾のセミコロンは許容する。空ファイル、コメントのみ、入力0件、複数文、読み取り以外の文、名前の衝突は生成エラーとする。symlinkは追跡しない。

コメント・引用符・文字列を識別する最小の字句走査は行うが、独自のSQL型チェッカーは作らない。文字列やコメント内のセミコロン・`@name` を誤認せず、テンプレートとしてSQLを評価しない。

値を与えないPLAN解析から、名前付きパラメータの型と結果列の名前・順序・型を取得する。生成時に利用者のクエリをデータ取得・更新目的で実行しない。ネイティブSDKの `Database.run({ sql, queryMode: PLAN })` で `params` / `types` を渡さず、`rowType` / `undeclaredParameters` を取得する経路を最初に検証する。高水準APIで必要情報を保持できない場合だけ、同じSDKの公開v1 APIへ局所的に切り替える。

無効なSQL、存在しないテーブル・列、型不整合、接続・認証エラー、必須メタデータ欠落、未対応型は生成失敗とする。`any` や独自の推測で補わない。型意図の補足は `CAST(@value AS ...)` など通常のSQLで行う。Spannerが規則に基づいて既定型を確定した場合は、その型を採用する。

### 2. 名前付きの型と実行関数を生成する

各SQLから `<QueryName>Params`、`<QueryName>Row`、`Promise<Row[]>` を返す関数を生成する。パラメータがない関数はexecutorのみを引数に取る。

- `find-user.sql` → `FindUserParams` / `FindUserRow` / `findUser`。
- `users/find-user.sql` → `UsersFindUserParams` / `UsersFindUserRow` / `usersFindUser`。
- 相対パスから拡張子を除き、ディレクトリ区切り・ハイフン・アンダースコアで分けた語をcamelCase / PascalCaseにする。語はASCII英数字、先頭語は英字開始とする。変換不能名、予約語、全export間の衝突を拒否する。
- パラメータ名・結果列名はSQLと解析メタデータに従い、独自に大小文字を変更しない。同一パラメータの複数回使用は1キーにまとめる。
- 名前なし列や同一階層の重複名は、一意なAS別名を案内して拒否する。STRUCTも同様。TS識別子でない名前は引用し、`__proto__` 等もデータキーとして安全に扱う。

出力は指定ディレクトリの単一 `queries.ts` とし、型、元SQL、SQL型と表現選択のメタデータ、実行可能な関数本体を含める。実行時に元SQLファイルやジェネレーターを必要としない。利用者は生成物を手修正せず、SQLやスキーマの変更後に再生成する。

### 3. NULLと複合型の契約

全パラメータ・全結果列を保守的に `T | null` として生成する。ARRAY自身・要素、STRUCT自身・フィールドにも再帰適用する。PLANメタデータにはNULL可否がなく、NOT NULL列でも外部結合や式を通した結果まで非NULLとは断定できないため、独自の非NULL推論・指定機能は設けない。

プロパティは必須とし、キー省略や `undefined` をNULLへ変換せず拒否する。一方、Paramsの引数オブジェクト、返却する結果配列、各結果行自体は非nullableとする。NULLのSTRUCTに子フィールドの必須検証を適用しない。

```ts
type ExampleRow = {
  Name: string | null;
  Values: Array<number | null> | null;
  Details: { Label: string | null } | null;
};
// 実行結果: Promise<ExampleRow[]>
```

配列順・STRUCTのフィールド順・空配列を保持し、NULLや空配列の値からSQL型を推測しない。Spannerが許さない複合型配置を無理に表現しない。nullableな生成型は、あらゆるSQL文脈でNULL入力が成功する保証ではない。

### 4. SQL型と公開TypeScript型

以下はNULL付与前の基本表現。上記の規則で再帰的にNULLを付与する。JsonValue自身は既にnullを含む。

| Spanner型 | 入力 | 結果 |
| --- | --- | --- |
| STRING | `string` | `string` |
| BOOL | `boolean` | `boolean` |
| FLOAT64 | `number` | `number` |
| INT64 | `bigint` | `bigint` |
| NUMERIC | 既定 `number`、明示指定 `Big` | 既定 `number`、明示指定 `Big` |
| DATE | `Temporal.PlainDate` | `Temporal.PlainDate` |
| TIMESTAMP | `Date` | `PreciseDate` |
| BYTES | `Buffer` | `Buffer` |
| JSON | `JsonValue` | `JsonValue` |
| ARRAY<T> | 入力要素型の配列 | 結果要素型の配列 |
| STRUCT | 名前付きフィールドのオブジェクト | 名前付きフィールドのオブジェクト |

SDKとの符号化・復号はSpanielが担い、公開TS型と実値を一致させる。SDKのデフォルト `row.toJSON()` に全面委譲して精密値をnumberへ暗黙変換しない。同じSQL型かつ同じTS表現であれば、取得した非NULL値をそのまま引数へ再利用できる。結果がnumber、引数がBigなど異なる表現間は呼出側で明示変換する。

#### INT64・FLOAT64

INT64はnumberを経由せずbigintとSDKの精密な整数表現を相互変換し、入力の符号付き64bit範囲を検証する。FLOAT64ではSQLで許されるNaN/Infinityも扱い、NUMERIC・JSONの有限数検証とは区別する。

#### NUMERIC

通常のJS数値処理の使いやすさから、既定をプリミティブnumberとする。十進精度が必要な箇所だけbig.jsのBigを明示指定する。生成時にTS型とcodecを固定し、値の大きさで実行時に型を切り替えたり、`number | Big` を返したりしない。

number復号時は、変換後が有限数であることと、その標準的な十進文字列表現が元の精密な十進値と数値として一致することを検証する。不一致ならBig指定を案内するエラーにする。`0.1` は許容するが、`9007199254740993` は拒否する。これは二進浮動小数点としての数学的な厳密性や、取得後の `0.1 + 0.2` の十進精度を保証するものではない。

number入力は有限数とDBの値域・小数桁への適合を検証し、その十進表記を送信する。呼出前に失われた桁は復元できない。Big指定はSDKの精密値からnumberを経由せず変換する。

どちらの表現でもSQL型はNUMERICを保持し、公開型がnumberでもSDKへFLOAT64として渡さない。SpanielはBigのDP/RM/strict等の共有設定を変更せず、独自の演算設定APIも追加しない。演算・丸め方針はbig.jsの公開APIとアプリの設定に従う。DBへ戻す際には値域・小数桁を検証し、格納のために暗黙に丸めない。

#### DATE・TIMESTAMP

DATEはISO暦の `Temporal.PlainDate` を使い、時刻やタイムゾーンを持たない日付として直接比較・日数加算できるようにする。入出力でDateやタイムゾーン変換を経由せず、入力のISO暦とSpannerの日付範囲を検証する。

Node.js >=22対応を維持し、`@js-temporal/polyfill` を明示importして一貫して使う。グローバルへの注入・起動フラグを要求せず、Node.jsの版によるnative/polyfillの自動切替はしない。

TIMESTAMPはDate互換性を優先し、入力Date、結果 `@google-cloud/precise-date` のPreciseDateとする。PreciseDateもDateの派生型として入力可能。通常のDate入力はミリ秒精度で受け付け、精密な取得値と再入力ではSDKが保持するサブミリ秒を削らない。無効・範囲外の入力は拒否する。

通常のDateへのコピーやgetTime経由の処理まで精度を維持する保証はしない。PreciseDateのISO文字列は小数秒が通常のDateより長くなり得るため、全Date対応ライブラリとの動作互換は保証しない。公開型としてTemporal.Instantや独自日時クラスは採用しない。

#### JSON

```ts
export type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue };
```

入出力は通常のJS値として扱えるJsonValueとする。内部の数値はnumberであり、大きな数値の厳密な保持・往復やBigへの自動変換は保証しない。SQL NULLとJSON nullはいずれもJS nullへ復号し、区別しない。入力nullはSQL NULLとして扱う。

Spanielはundefined・循環参照・非有限数などJSONとして不正な入力を送信前に拒否する。アプリ固有の構造・キー・業務ルールのバリデーションはアプリ側が行う。JSON内部のスキーマ推論、検証器生成、任意のアプリ型へのキャストは行わない。

JSONの文字列・配列をSQLのSTRING・ARRAYと混同せず、明示的にJSONとして符号化する。JSON内部をSQLのSTRUCT/ARRAYとして再帰変換しない。

### 5. クエリ先頭コメントでBigを指定する

```sql
-- @spaniel param minimumAmount type=Big
-- @spaniel result TotalAmount type=Big

SELECT SUM(Amount) AS TotalAmount
FROM Orders
WHERE Amount >= @minimumAmount;
```

Spanielがコメントを読み、同じSQLをコメント込みでPLANへ渡す。SQL型の正はPLAN、TS表現の指定はコメントとし、生成前に照合する。Spannerの `@{...}` 実行戦略ヒントへ変換せず、PLANがコメントを返すことにも依存しない。

指定規則は以下のとおり。

- 最初のSQLトークンより前のコメント・空白領域にある、独立した `--` 行コメントに1行1指定を書く。行頭空白、通常コメント、空行の混在を許容する。
- `@spaniel param <name> type=Big` または `@spaniel result <name> type=Big` を使う。キーワードとBigの綴りは固定する。
- nameは `[A-Za-z_][A-Za-z0-9_]*` またはJSONの二重引用符付き文字列。メタデータ名と完全一致で照合し、ドットをパスとして解釈しない。
- 当該SQLファイルの名前付きパラメータ・結果列に適用する。paramとresultは別の名前空間。同じパラメータの複数回使用には1指定で適用する。
- ARRAY/STRUCTを指定した場合は、含まれるNUMERIC葉すべてへ再帰適用する。他の型とNULL方針は維持する。個別パス、ワイルドカード、numberへの部分上書きは初版では扱わない。
- 存在しない名前、NUMERIC葉を含まない対象、同じ対象の重複指定は生成エラー。予約した `@spaniel` で始まるコメントの不正構文・未知指定・先頭領域以外での指定も黙って無視せず拒否する。SQL文字列内の同じ文字列はコメントとみなさない。
- CLI・生成API・--checkで同じ解析・照合を使う。指定の追加・変更・削除を生成差分へ反映する。外部設定や実行時フラグとの優先順位は設けない。

Orders.AmountがNUMERICで、上記を `sum-orders.sql` とした場合の公開契約例:

```ts
import type { Big, SpannerExecutor } from 'spaniel-sql';

export type SumOrdersParams = { minimumAmount: Big | null };
export type SumOrdersRow = { TotalAmount: Big | null };
export declare function sumOrders(
  executor: SpannerExecutor,
  params: SumOrdersParams,
): Promise<SumOrdersRow[]>;
```

これはシグネチャ例であり、生成物には実行可能な関数本体も含める。2つのコメントを削除すると入出力はnumberになるが、SDKへ渡すSQL型はNUMERICのまま。

DDLの列コメントからの自動継承はしない。PLANの結果型だけでは元テーブル・元カラムの対応を取得できず、集約・演算結果への継承規則も必要になるため、初版は結果の別名で直接指定する。

### 6. ネイティブSDKで実行する

生成関数は呼出側からSpannerExecutorを受け取り、`@google-cloud/spanner` に固定SQL・値・明示的なSDKパラメータ型を渡す。初版の実行先はDatabaseを保証対象とする。値をSQLへ連結せず、通常実行時にPLAN解析・生成・マイグレーションを行わない。

結果は名前付き行オブジェクトの配列とし、0件なら空配列を返す。列名・順序・型メタデータを生成契約と照合し、不一致なら復号前に拒否する。0行時もメタデータを確認する。SQLで指定した結果順を保持する。

欠落・余分な引数、undefined、不正な値型を送信前に拒否する。NULL、空ARRAY、全要素NULLの場合も値から型を推測しない。STRUCTはメタデータ順でSDK表現へ変換する。

借用したDB接続を閉じない。接続所有、認証、トランザクションのcommit/retryは呼出側とSDKの責務とする。エラーは元のcauseを保持し、クエリ名・工程などを付けるが、パラメータ値・認証情報を診断へ追加しない。

### 7. 決定的な生成と非破壊の差分検査

同じSQL（コメントを含む）・型メタデータ・ジェネレーター版から同じ出力を生成する。ファイルは相対パス順、パラメータは名前順、結果列・STRUCTはメタデータ順にする。DB名、認証情報、クエリ計画、生成時刻は生成コードへ埋め込まない。

全ファイルの読込・解析・レンダリング成功後にのみ、一時ファイルからrenameで `queries.ts` を置換する。生成専用ヘッダーのない既存ファイルや出力symlinkは拒否し、手書きファイルを上書き・削除しない。クエリ削除は単一生成ファイルから対応exportを除くことで反映する。

--checkはDBで再解析して期待出力と既存生成物を比較し、未生成、変更、不要export、不正SQLを非0終了で報告する。出力は書き換えない。SQLとスキーマが妥当で型・生成物に差分がなければ成功してよい。スキーマ版の互換性保証は別の課題とする。

予定する最小CLI:

```sh
spaniel generate --sql sql --out src/generated \
  --project example-project --instance example-instance --database example-db

spaniel generate --sql sql --out src/generated \
  --project example-project --instance example-instance --database example-db --check
```

5つの値引数を必須とし、各パスはcwd基準。不明な引数は拒否する。終了コードは成功0、読込・解析・生成・差分等の失敗1、CLI引数不備2。CLIが作成した接続だけをfinallyで閉じる。生成APIには接続済み解析先を渡せるようにする。

### 8. 公開入口・依存・旧DSL移行

`spaniel-sql` からruntime・executorと利用者が入力値を構築できる型の公開入口、`spaniel-sql/generator` から生成API、`spaniel` binからCLIを提供する。runtimeからgeneratorやファイルシステム処理をimportしない。SDK内部へのdeep importはしない。

`@google-cloud/spanner`、`big.js`、`@js-temporal/polyfill`、`@google-cloud/precise-date` を直接依存として宣言する。型の再公開のためだけの独自演算・日時クラスは作らない。CJS/ESM、型宣言、Node.js >=22対応を維持し、Node.js 22/24で検証する。

旧DSLを互換性制約としない。新しい生成・コンパイル・実行の最小ループを検証した後、旧builder/AST/printer/schema/proxyと専用テストを撤去し、公開APIと利用説明をTyped SQLへ切り替える。互換アダプターや旧DSLの別パッケージ化は行わない。破壊的変更は明記する。

## 対象外

- fluent API、手書きTSテーブルスキーマ、独自SQL型チェッカー、ORM、DB共通抽象化。
- 動的SQLテンプレート、実行時のSQL組立て・識別子置換（Issue #2）。
- DML/DDL、複数文スクリプト、ミューテーション・コマンドの型生成。
- マイグレーション実行・スキーマ版管理（Issue #3）。
- Omni起動、DBの自動作成・破棄（Issue #4）。
- TOMLプロファイル（Issue #5）、独自の環境変数優先順位。
- PostgreSQL方言、ストリーミング公開API、トランザクション管理APIの新設。

## 検討した代替案と不採用理由

| 代替案 | 不採用理由 |
| --- | --- |
| 旧ASTの拡張、TSスキーマやDDLからの独自型推論 | SQLの意味論・型規則を二重管理することになる |
| ダミー値による通常実行からの型取得 | 生成時にクエリを実行し、値依存の推論や空結果の問題を持ち込む |
| 全NUMERICをBigにする | 通常のJS数値処理ではnumberの使いやすさを優先し、精密な用途だけ明示指定する |
| INT64/NUMERIC/DATEを文字列・ブランド付き文字列にする | 利用側で型の復元が必要で、取得直後の操作可能性を満たさない |
| TIMESTAMPをTemporal.Instantにする | Dateを要求する既存処理へ直接渡せない |
| TIMESTAMPを通常のDateへ正規化する | SDKが保持するサブミリ秒を失う |
| JSONの生テキスト・独自ラッパーを返す | 初版では直接扱えるJS値を選ぶ。精度・null区別の保持にはSDK解析前の別経路が必要 |
| DDLコメントからBig指定を継承する | 元カラム追跡と演算・集約への継承規則が必要 |
| 最初からOmni・移行・TOMLを含める | 後続Issueとの依存を増やし、初版の最小ループを拡大する |
| 複数生成ファイルと管理manifest | 単一queries.tsで安全な置換と削除反映を満たせる |

## 結果と制約

SQLと実DBの型を正として、生成型と実行時値の一致を検証できる。型の表現選択はSQLと同じファイルに置ける。一方、生成には解析先DBと認証が必要で、スキーマ変更後は再生成が必要になる。

全フィールドが保守的にnullableとなるため、利用側のNULL確認が増える。numberには演算誤差があり、精密な用途はBig指定が必要。JSONの精密数値とnullの区別、Dateを介した利用側処理のサブミリ秒保持は保証しない。

生成中のDDL変更に対するスキーマスナップショットの一貫性は保証しない。検証先はDDL変更が並行しないDBとする。結果メタデータ照合だけで、デプロイ先のスキーマ版や業務上の互換性まで保証したとはしない。全行を配列へ読み込むため、必要な絞り込みはSQLで行う。

## 検証・完了条件

実装では以下のRFC受入条件を満たす。文書採用時点では未検証であり、モックだけで実DB互換性を証明したとは扱わない。

| ID | 確認する条件 |
| --- | --- |
| AC1 | SQLから型・実行関数を生成し、CJS/ESMで型検査・実行できる |
| AC2 | 値なしPLAN解析で型を取得し、0行テーブルでも生成できる |
| AC3 | SQL不正・型不整合で生成/checkが失敗し、既存生成物を保持する |
| AC4 | 全型の境界値・NULL・空配列を含め、変換結果と生成型が一致する |
| AC5 | ARRAY/STRUCTの再帰変換と、重複名・未対応型・不完全メタデータの拒否 |
| AC6 | 誤った入力・結果利用を型テストで検出し、JS経由の不正入力も拒否する |
| AC7 | 値をSQLへ連結せず、0件は空配列、借用接続は閉じない |
| AC8 | 再生成は決定的で、checkは追加・変更・削除を非破壊で検出する |
| AC9 | 公開API・利用説明をTyped SQLへ移行し、旧DSL互換層を導入しない |
| AC10 | 再帰的なnullable・必須キーと、非nullableなParams/結果配列/行を守る |
| AC11 | bigint・number/Big・PlainDateを直接利用でき、入力再利用と値域・精度検証が働く |
| AC12 | Date/PreciseDate入力・PreciseDate出力でSDKの保持精度と範囲検証を守る |
| AC13 | JsonValueの保証範囲と不正JSON入力拒否を守り、業務検証器は生成しない |
| AC14 | コメント指定をPLANへ照合し、NUMERIC葉への適用・エラー・CLI/API/checkの一致を検証する |

Cloud Spannerで生成→コンパイル→実行の統合検証記録を残す。統合テストを明示実行した際の接続設定不足は成功扱いしない。テスト用スキーマの作成・投入・掃除は専用テストの所有対象に限定し、製品CLIへ混ぜない。
