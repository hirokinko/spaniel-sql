# ADR-0001 Verification Results

- 検証日: 2026-09-06
- 最終RFC状態: **Implementing**。修正担当フェーズ: `implement-rfc`。
- 基準: [ADR-0001](../../specs/0001-spanner-native-typed-sql-core.md) のAC1〜AC14。
- 作業ツリーの実装を検証（HEAD `2aaebb4` に未コミットのTyped SQL実装が追加された状態）。製品コードは修正していない。
- 元RFCの `spec.md` / `plan.md` / REQ-* はワークスペースに存在しない。リポジトリ内の唯一の仕様であるADRを基準にし、下表の「仕様節」で要件への対応を保持する。元の技術計画への適合は判断できない。本ファイルは検証記録であり、事後的な設計承認ではない。

## 判定

PASSは記載範囲で直接確認済み、未充足は必要な証拠が不足、FAILは契約違反または実装未完了を示す。モックの成功をCloud Spanner互換性の証明には用いていない。

| AC | 仕様節 | 判定 | 証拠・残る条件 |
| --- | --- | --- | --- |
| AC1 | 2, 8 | PASS（ローカル） | 生成されたTSをCJS/ESMへ実コンパイルし、生成関数を実行するテストがNode 22/24で成功。実DBループは別途未充足。 |
| AC2 | 1 | 未充足 | テストでPLAN要求にsql/queryModeしか含まれないことを検証。Cloud Spannerの値なしPLANと0行テーブルは未検証。現在のempty.sqlはテーブルを参照しない。 |
| AC3 | 1, 7 | 未充足 | 字句不正・メタデータ不正時の既存出力保持は成功。実DBのSQL不正・存在しない列・型不整合についてgenerate/check両方の証拠がない。 |
| AC4 | 3, 4 | 未充足 | SDK値を使う既存テストと独立25ケースで値変換・境界値・NULLの一部を確認。全型・複合型・空配列を含む実DBの往復記録がない。 |
| AC5 | 2, 3, 6 | 未充足 | 不完全メタデータ・重複列・未対応annotationの拒否、STRUCT入力の変換は成功。再帰STRUCT結果・ARRAY/STRUCTの実DB往復と入れ子の不正メタデータの十分な実行証拠がない。 |
| AC6 | 2, 6 | PASS（ローカル） | tscで@ts-expect-errorを検証し、誤った入力型・結果利用を検出。JSの欠落/余分/undefined/不正値は送信前に拒否するテスト成功。 |
| AC7 | 6 | FAIL | 固定SQL、0件時[]とメタデータ照合は成功。借用接続を閉じるコードはない。ただしSDKへ渡したfields/__proto__パラメータが正しいwire表現にならない（V-001）。 |
| AC8 | 7 | 未充足 | 同一入力で同一生成物、check成功、未生成とコメント変更の非破壊検出を確認。クエリ追加・削除によるexport差分の直接チェックは不足。 |
| AC9 | 8 | FAIL | Typed SQLの公開入口・README・依存は追加済みだが、旧builder/AST/printer/schema/proxyと旧公開export・専用テストが残存（V-002）。 |
| AC10 | 3 | 未充足 | 生成コードの再帰nullableと必須プロパティ、非nullable配列/行を確認。キー欠落/undefined拒否のテスト成功。生成された複合型のnegative型テスト、NULL STRUCTと空/全NULL ARRAYの包括的証拠は不足。 |
| AC11 | 4 | 未充足 | bigint演算可能値、Big精密値、PlainDate日付加算、NUMERIC精度喪失拒否・設定非変更、整数範囲・DATE暦/範囲拒否を確認。取得値の再入力と全境界の実DB証拠は不足。 |
| AC12 | 4 | 未充足 | SDK PreciseDateオブジェクトの保持、不正/範囲外Date入力拒否を確認。通常Date入力と実DBを通したサブミリ秒保持は未検証。 |
| AC13 | 4 | PASS（ローカル） | JSONはJsonValueと通常JS値。undefined/非有限数/bigint/循環/Date/疎配列を拒否。JSON.stringifyと明示JSON型をSDKへ渡すコード、およびSDKの文字列保持/JSON.parse経路を確認。DB内の精密数値保証は仕様どおり対象外。 |
| AC14 | 5, 7 | 未充足 | Bigコメントの生成・再帰適用・不正/重複/未知対象の拒否とcheck差分をテスト。CLIが同一generateを呼ぶことは確認。実PLANとの照合、CLI正常系を含む同等性の実行証拠は不足。 |

## 実行した検証

環境のPATHにpnpmがなかったため、既存node_modulesのスクリプト本体を直接実行した。依存のインストール・DB作成・DDL/DML・認証設定の変更はしていない。

Node 24.16.0のbinをPATH先頭にして以下を実行、すべて終了0:

```sh
node_modules/.bin/biome lint --error-on-warnings
node_modules/.bin/biome format
node_modules/.bin/tsc --noEmit
node_modules/.bin/tsup src/index.ts src/generator.ts src/cli.ts --dts --format cjs,esm --out-dir dist --clean --treeshake
node_modules/.bin/tsc -p tsconfig.tests.json
```

ビルドはCJS/ESM/型宣言の出力に成功。generator/cliの未使用外部importの警告はあるがビルド失敗はない。

Node 22.22.2 / 24.16.0でそれぞれ以下を実行、**74 passed / 0 failed / 0 skipped**（Typed SQLテストは各モジュール形式6件ずつ、残りは旧DSL）:

```sh
node --test --test-reporter=spec '.tmp-tests/tests/cjs/**/*.cjs' '.tmp-tests/tests/esm/**/*.mjs'
```

初回はsandboxのspawnSyncがEPERMになった。許可されたsandbox外実行で両版を再検証し成功したため、このEPERMは製品の不具合としていない。ローカルログは `/tmp/spaniel-verify-node22.22.2.txt` と `/tmp/spaniel-verify-node24.16.0.txt`。

```sh
/home/hirokinko/.local/share/mise/installs/node/24.16.0/bin/node docs/verification/0001/evidence/independent.cjs
```

[独立再現スクリプト](evidence/independent.cjs) は境界値/NULL/送信前拒否25ケースに成功。SDK serializerの観測ではordinaryのみ正常で、fields/__proto__はFAIL。既知不具合の再現自体をassertするスクリプトのため終了0はAC合格を意味しない。製品のdeep importは追加していない。公開SDK exportの内部serializerを検証用に呼び出しており、実RPCの成功証拠ではない。

```sh
/home/hirokinko/.local/share/mise/installs/node/24.16.0/bin/node .tmp-tests/tests/integration/spanner.test.js
```

**0 passed / 1 failed / 0 skipped**。`SPANNER_PROJECT_ID` / `SPANNER_INSTANCE_ID` / `SPANNER_DATABASE_ID` が未設定でassertion失敗。Cloudへの要求には到達していない。設定不足を成功扱いしない要件は確認できたが、Cloud Spannerの受入検証は未完了。

## 次のゲート

[issues.md](issues.md) のV-001/V-002をimplement-rfcで解消し、V-003の不足ケースと接続先を揃えて再検証する。現時点でImplementedへ遷移させない。
