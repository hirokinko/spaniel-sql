import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { test } from 'node:test';
import { Spanner } from '@google-cloud/spanner';
import type { JsonValue, SpannerExecutor } from 'spaniel-sql';
import { Big, createSpannerExecutor, PreciseDate, Temporal } from 'spaniel-sql';
import { generate } from 'spaniel-sql/generator';

test(
  'Cloud Spanner: PLAN → generated TypeScript → native value roundtrip',
  { timeout: 120_000 },
  async () => {
    const projectId = process.env.SPANNER_PROJECT_ID;
    const instanceId = process.env.SPANNER_INSTANCE_ID;
    const databaseId = process.env.SPANNER_DATABASE_ID;
    assert.ok(
      projectId && instanceId && databaseId,
      'Set SPANNER_PROJECT_ID, SPANNER_INSTANCE_ID, SPANNER_DATABASE_ID for an existing test database',
    );
    assert.ok(
      !process.env.SPANNER_EMULATOR_HOST,
      'This acceptance test requires Cloud Spanner, not an emulator',
    );
    const spanner = new Spanner({ projectId });
    const database = spanner.instance(instanceId).database(databaseId);
    const dir = await mkdtemp(join(process.cwd(), '.spaniel-integration-'));
    try {
      const result = await generate({ sqlDir: 'tests/fixtures/sql', outDir: dir, database });
      await generate({ sqlDir: 'tests/fixtures/sql', outDir: dir, database, check: true });
      execFileSync(
        process.execPath,
        [
          'node_modules/typescript/bin/tsc',
          '--strict',
          '--skipLibCheck',
          '--target',
          'ES2022',
          '--module',
          'NodeNext',
          '--moduleResolution',
          'NodeNext',
          '--rootDir',
          dir,
          '--outDir',
          join(dir, 'compiled'),
          result.outputPath,
        ],
        { stdio: 'inherit' },
      );
      interface Values {
        id: bigint | null;
        amount: Big | null;
        rate: number | null;
        day: Temporal.PlainDate | null;
        instant: Date | null;
        payload: JsonValue;
        ids: (bigint | null)[] | null;
        label: string | null;
        enabled: boolean | null;
        data: Buffer | null;
        score: number | null;
      }
      interface Row {
        Id: bigint | null;
        Amount: Big | null;
        Rate: number | null;
        Day: Temporal.PlainDate | null;
        Instant: PreciseDate | null;
        Payload: JsonValue;
        Ids: (bigint | null)[] | null;
        Label: string | null;
        Enabled: boolean | null;
        Data: Buffer | null;
        Score: number | null;
      }
      const queries = require(join(dir, 'compiled', 'queries.js')) as {
        empty(executor: SpannerExecutor): Promise<{ Id: bigint | null }[]>;
        valueRoundtrip(executor: SpannerExecutor, params: Values): Promise<Row[]>;
      };
      const executor = createSpannerExecutor(database);
      assert.deepEqual(await queries.empty(executor), []);
      const values: Values = {
        id: 9007199254740993n,
        amount: new Big('12345678901234567890.123456789'),
        rate: 0.1,
        day: Temporal.PlainDate.from('2024-02-29'),
        instant: new PreciseDate('2026-09-06T00:00:00.123456789Z'),
        payload: ['value', 1, null],
        ids: [1n, null],
        label: '',
        enabled: false,
        data: Buffer.from([0, 255]),
        score: 1.5,
      };
      const [row] = await queries.valueRoundtrip(executor, values);
      assert.ok(row);
      assert.equal(row.Id, values.id);
      assert.equal(row.Amount?.toString(), values.amount?.toString());
      assert.equal(row.Rate, values.rate);
      assert.equal(row.Day?.toString(), values.day?.toString());
      assert.equal(row.Instant?.getFullTime(), (values.instant as PreciseDate).getFullTime());
      assert.deepEqual(row.Payload, values.payload);
      assert.deepEqual(row.Ids, values.ids);
      assert.equal(row.Label, values.label);
      assert.equal(row.Enabled, values.enabled);
      assert.deepEqual(row.Data, values.data);
      assert.equal(row.Score, values.score);
      const nullValues = Object.fromEntries(
        Object.keys(values).map((key) => [key, null]),
      ) as unknown as Values;
      const [nullRow] = await queries.valueRoundtrip(executor, nullValues);
      assert.ok(nullRow);
      assert.ok(Object.values(nullRow).every((value) => value === null));
    } finally {
      try {
        await rm(dir, { recursive: true, force: true });
      } finally {
        try {
          await database.close();
        } finally {
          await spanner.close();
        }
      }
    }
  },
);
