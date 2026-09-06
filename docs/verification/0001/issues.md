# ADR-0001 verification issues

## V-001: SDKへ渡す特定のパラメータ名が壊れる

- Type: implementation
- Status: Open
- Route: implement-rfc / Implementing
- Blocking: Yes
- AC: AC7（関連: AC4/AC6、仕様2の名前保持・__proto__安全性、仕様6の明示SDK型付き実行）
- 対象: `src/integration/spanner.ts` のcreateSpannerExecutor/encodeParams。
- 再現: [independent.cjs](evidence/independent.cjs) をビルド後に実行。STRINGのパラメータ名ordinaryでは正常、fieldsと__proto__では値/型のown propertyが送信用表現に保持されない。
- 原因: SDK 8.11.0のSnapshot.encodeParamsはrequest.params.fieldsがtruthyならprotobuf Struct入力と判断する。また新しい通常オブジェクトへfields[param]/paramTypes[param]を代入するため、__proto__がown data keyにならない。Spaniel側のObject.fromEntriesだけではSDK境界まで安全性を維持できない。
- 影響: 正当な名前の入力がSQLへ正常にバインドされず、メタデータ名どおりに実行できない。たとえば `SELECT @fields AS Value` の非NULL STRING入力。
- 解消条件: 契約を維持するSDKへの渡し方を実装し、通常名/fields/__proto__について値と明示型のwire表現および実DBの生成→実行を確認する。根拠なく名前を禁止して仕様を縮小しない。

## V-002: 旧DSLの撤去と公開API移行が未完了

- Type: implementation
- Status: Open
- Route: implement-rfc / Implementing
- Blocking: Yes
- AC: AC9 / 仕様8
- 証拠: `src/index.ts` がcreateDb/defineTable/ct/旧演算APIを引き続きexport。`src/builder.ts` と `src/core/`、専用CJS/ESMテストが残る。READMEも「実装中」「統合検証後に旧DSLを撤去」「互換層は提供しない予定」としている。
- 解消条件: 仕様どおり実DBの最小ループ検証後に旧実装・専用テスト・exportを撤去し、破壊的変更と移行方法を確定した説明にする。撤去の前提が未充足なので、検証中に削除していない。

## V-003: 必須の実DB受入記録とAC別の証拠が不足

- Type: verification
- Status: Open
- Route: verify-rfc / Ready for Verification（証拠不足単独の担当フェーズ。RFC全体はV-001/V-002によりImplementing）
- Blocking: Yes
- AC: AC2/AC3/AC4/AC5/AC8/AC10/AC11/AC12/AC14
- 証拠: Cloud統合テストを明示実行すると3つの接続設定不足で失敗。現fixtureは定数/パラメータSELECTだけで、0行テーブル、存在しないテーブル/列、SQL型不整合、STRUCT、空ARRAY、結果再入力などを網羅しない。74件のローカル成功だけでは補えない。
- 解消条件: [AC別記録](plan.md) の不足分を埋め、既存のCloud Spanner検証DBで生成→コンパイル→実行の証拠を残す。check追加/削除、複合nullable型のnegativeチェック、CLI/API/checkの必要な正常・異常系も検証する。テスト用スキーマが必要なら専用所有対象だけを作成・掃除する。
- 制約: 接続先を推測して本番DB等へ接続せず、DB/IAMの作成や設定変更は行っていない。
