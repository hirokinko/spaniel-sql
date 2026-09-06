import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { protos, Spanner } from '@google-cloud/spanner';
import type * as API from 'spaniel-sql';
import type * as Generator from 'spaniel-sql/generator';

type Database = Parameters<typeof Generator.generate>[0]['database'];
type Field = protos.google.spanner.v1.StructType.IField;
function field(
  name: string,
  code:
    | 'INT64'
    | 'NUMERIC'
    | 'DATE'
    | 'TIMESTAMP'
    | 'JSON'
    | 'STRING'
    | 'BOOL'
    | 'BYTES'
    | 'FLOAT64',
): Field {
  return { name, type: { code } };
}
function database(run: (request: Record<string, unknown>) => Promise<unknown>): Database {
  return { run } as unknown as Database;
}

export function register_typed_sql_tests(api: typeof API, generator: typeof Generator) {
  test('PLAN: no dummy values; generated Big contract, check, output ownership and real compilation', async () => {
    const dir = await mkdtemp(join(process.cwd(), '.spaniel-test-'));
    try {
      const sqlDir = join(dir, 'sql');
      const outDir = join(dir, 'generated');
      await mkdir(sqlDir);
      const sql =
        '-- @spaniel param minimum type=Big\n-- @spaniel result Total type=Big\nSELECT SUM(Amount) AS Total FROM Orders WHERE Amount >= @minimum;';
      await writeFile(join(sqlDir, 'sum-orders.sql'), sql);
      let calls = 0;
      const db = database(async (request) => {
        calls++;
        assert.equal(request.sql, sql);
        assert.deepEqual(Object.keys(request).sort(), ['queryMode', 'sql']);
        assert.equal(request.queryMode, protos.google.spanner.v1.ExecuteSqlRequest.QueryMode.PLAN);
        return [
          [],
          {},
          {
            rowType: { fields: [field('Total', 'NUMERIC')] },
            undeclaredParameters: { fields: [field('minimum', 'NUMERIC')] },
          },
        ];
      });
      const options = { sqlDir, outDir, database: db };
      await assert.rejects(generator.generate({ ...options, check: true }));
      const result = await generator.generate(options);
      const first = await readFile(result.outputPath, 'utf8');
      assert.match(first, /minimum.*__spaniel.Big \| null/);
      assert.match(first, /Total.*__spaniel.Big \| null/);
      await generator.generate(options);
      assert.equal(await readFile(result.outputPath, 'utf8'), first);
      await generator.generate({ ...options, check: true });
      assert.equal(calls, 4);
      execFileSync(process.execPath, [
        'node_modules/typescript/bin/tsc',
        '--strict',
        '--skipLibCheck',
        '--target',
        'ES2022',
        '--module',
        'NodeNext',
        '--moduleResolution',
        'NodeNext',
        result.outputPath,
        '--rootDir',
        outDir,
        '--outDir',
        join(dir, 'compiled'),
      ]);
      const generated = require(join(dir, 'compiled', 'queries.js')) as {
        sumOrders: (
          executor: API.SpannerExecutor,
          params: { minimum: API.Big | null },
        ) => Promise<{ Total: API.Big | null }[]>;
      };
      const executor: API.SpannerExecutor = {
        async execute(request) {
          assert.equal(request.sql, sql);
          assert.equal(request.types.minimum?.type, 'numeric');
          return {
            rows: [[{ name: 'Total', value: Spanner.numeric('0.3') }]],
            metadata: { rowType: { fields: [field('Total', 'NUMERIC')] } },
          };
        },
      };
      // Generated CommonJS uses its own public Big constructor.
      const common = require('spaniel-sql') as typeof API;
      assert.equal(
        (
          await generated.sumOrders(executor, { minimum: new common.Big('0.1') })
        )[0]?.Total?.toString(),
        '0.3',
      );
      const esmSource = join(outDir, 'queries.mts');
      await writeFile(esmSource, first);
      execFileSync(process.execPath, [
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
        outDir,
        '--outDir',
        join(dir, 'esm'),
        esmSource,
      ]);
      const esm = (await import(
        pathToFileURL(join(dir, 'esm', 'queries.mjs')).href
      )) as typeof generated;
      assert.equal((await esm.sumOrders(executor, { minimum: null }))[0]?.Total?.toString(), '0.3');
      await writeFile(result.outputPath, 'hand written');
      await assert.rejects(generator.generate(options));
      assert.equal(await readFile(result.outputPath, 'utf8'), 'hand written');
      await rm(result.outputPath);
      await symlink(join(dir, 'owned-by-user'), result.outputPath);
      await assert.rejects(generator.generate(options));
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test('generation rejects malformed metadata and preserves output across failures and annotation changes', async () => {
    const dir = await mkdtemp(join(process.cwd(), '.spaniel-test-'));
    try {
      const sqlDir = join(dir, 'sql');
      const outDir = join(dir, 'out');
      await mkdir(sqlDir);
      const file = join(sqlDir, 'nested.sql');
      await writeFile(file, '-- @spaniel result Data type=Big\nSELECT 1 AS Data');
      const fields: Field[] = [
        {
          name: 'Data',
          type: {
            code: 'STRUCT',
            structType: {
              fields: [
                field('Label', 'STRING'),
                { name: 'Amounts', type: { code: 'ARRAY', arrayElementType: { code: 'NUMERIC' } } },
              ],
            },
          },
        },
      ];
      let response: unknown = [[], {}, { rowType: { fields } }];
      const options = { sqlDir, outDir, database: database(async () => response) };
      const result = await generator.generate(options);
      const content = await readFile(result.outputPath, 'utf8');
      assert.match(content, /"Label": string \| null/);
      assert.match(content, /Array<__spaniel.Big \| null> \| null/);
      for (const metadata of [
        undefined,
        {},
        { rowType: {} },
        { rowType: { fields: [field('', 'NUMERIC')] } },
        { rowType: { fields: [field('Data', 'NUMERIC'), field('Data', 'NUMERIC')] } },
        { rowType: { fields: [{ name: 'Data', type: { code: 'ARRAY' } }] } },
        {
          rowType: {
            fields: [{ name: 'Data', type: { code: 'NUMERIC', typeAnnotation: 'PG_NUMERIC' } }],
          },
        },
        { rowType: { fields: [field('Other', 'NUMERIC')] } },
        { rowType: { fields: [field('Data', 'STRING')] } },
      ]) {
        response = [[], {}, metadata];
        await assert.rejects(generator.generate(options));
        assert.equal(await readFile(result.outputPath, 'utf8'), content);
      }
      response = [[], {}, { rowType: { fields } }];
      await writeFile(file, 'SELECT 1 AS Data');
      await assert.rejects(generator.generate({ ...options, check: true }));
      assert.equal(await readFile(result.outputPath, 'utf8'), content);
      await generator.generate(options);
      assert.match(await readFile(result.outputPath, 'utf8'), /Array<number \| null>/);
      await writeFile(join(sqlDir, 'broken.sql'), 'DELETE FROM Orders');
      const before = await readFile(result.outputPath, 'utf8');
      await assert.rejects(generator.generate(options));
      assert.equal(await readFile(result.outputPath, 'utf8'), before);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test('CLI rejects invalid arguments before authentication', () => {
    for (const args of [
      [],
      ['generate'],
      ['generate', '--unknown', 'secret-value'],
      ['generate', '--check', '--check'],
    ]) {
      const result = spawnSync(process.execPath, ['dist/cli.js', ...args], { encoding: 'utf8' });
      assert.equal(result.status, 2, result.stderr);
      assert.doesNotMatch(result.stderr, /secret-value/);
    }
  });

  test('lexical boundaries and annotation validation', () => {
    for (const sql of [
      "SELECT ';@fake' AS Value; -- trailing",
      'WITH c AS (SELECT 1 AS Id) SELECT Id FROM c',
      'WITH a AS (SELECT 1 AS Id), b AS (SELECT Id FROM a) SELECT Id FROM b',
      'SELECT item.update AS Value FROM Items AS item',
      '(WITH c AS (SELECT 1 AS Id) SELECT Id FROM c)',
      "SELECT r'''a\\'@fake;\nb''' AS Value",
      '@{FORCE_INDEX=_BASE_TABLE} SELECT 1 AS Id',
      'SELECT @`odd name` AS Value',
    ]) {
      assert.doesNotThrow(() => generator.inspectSql(sql));
    }
    assert.deepEqual(generator.inspectSql('SELECT @x AS A, @x AS B').params, ['x']);
    assert.deepEqual(
      generator.inspectSql('-- @spaniel result "odd name" type=Big\nSELECT 1 AS `odd name`')
        .annotations,
      [{ scope: 'result', name: 'odd name' }],
    );
    for (const sql of [
      '',
      '-- comment',
      'SELECT 1; SELECT 2',
      'DELETE FROM T',
      'WITH c AS (SELECT 1 AS Id) DELETE FROM T',
      "SELECT 'unterminated",
      'SELECT (1',
      '-- @spaniel result x type=Number\nSELECT 1 AS x',
      '-- @spaniel result x type=Big\n-- @spaniel result x type=Big\nSELECT 1 AS x',
      'SELECT 1 AS x\n-- @spaniel result x type=Big',
      '/* @spaniel result x type=Big */ SELECT 1 AS x',
    ]) {
      assert.throws(() => generator.inspectSql(sql), Error, sql);
    }
  });

  test('runtime codecs preserve public values, SDK types, nested structs and nulls', async () => {
    const definition = {
      name: 'values',
      sql: 'SELECT values',
      params: [
        { name: 'integer', type: { code: 'INT64' } },
        { name: 'amount', type: { code: 'NUMERIC', representation: 'Big' } },
        { name: 'day', type: { code: 'DATE' } },
        { name: 'instant', type: { code: 'TIMESTAMP' } },
        { name: 'json', type: { code: 'JSON' } },
        {
          name: 'nested',
          type: {
            code: 'STRUCT',
            fields: [{ name: 'numbers', type: { code: 'ARRAY', element: { code: 'INT64' } } }],
          },
        },
      ],
      result: [
        { name: 'integer', type: { code: 'INT64' } },
        { name: 'amount', type: { code: 'NUMERIC', representation: 'Big' } },
        { name: 'day', type: { code: 'DATE' } },
        { name: 'instant', type: { code: 'TIMESTAMP' } },
        { name: 'json', type: { code: 'JSON' } },
      ],
    } as const;
    const time = new api.PreciseDate('2026-09-06T00:00:00.123456789Z');
    const metadata = {
      rowType: {
        fields: [
          field('integer', 'INT64'),
          field('amount', 'NUMERIC'),
          field('day', 'DATE'),
          field('instant', 'TIMESTAMP'),
          field('json', 'JSON'),
        ],
      },
    };
    const executor = api.createSpannerExecutor(
      database(async (request) => {
        assert.equal(request.sql, definition.sql);
        assert.equal(request.json, false);
        const params = request.params as Record<string, unknown>;
        assert.equal(params.json, '[1,"a",null]');
        assert.equal(params.instant, time);
        assert.equal((params.nested as { name: string; value: unknown }[])[0]?.name, 'numbers');
        return [
          [
            [
              { name: 'integer', value: Spanner.int('9007199254740993') },
              { name: 'amount', value: Spanner.numeric('12345678901234567890.123456789') },
              { name: 'day', value: Spanner.date('2024-02-29') },
              { name: 'instant', value: time },
              { name: 'json', value: { data: [1, null] } },
            ],
          ],
          {},
          metadata,
        ];
      }),
    );
    const result = await api.executeQuery(executor, definition, {
      integer: 9007199254740993n,
      amount: new api.Big('0.1'),
      day: api.Temporal.PlainDate.from('2024-02-29'),
      instant: time,
      json: [1, 'a', null],
      nested: { numbers: [1n, null] },
    });
    assert.equal(result[0]?.integer, 9007199254740993n);
    assert.equal(result[0]?.amount?.toString(), '12345678901234567890.123456789');
    assert.equal(result[0]?.day?.add({ days: 1 }).toString(), '2024-03-01');
    assert.equal(result[0]?.instant?.getFullTime(), time.getFullTime());
    assert.deepEqual(result[0]?.json, { data: [1, null] });
  });

  test('number precision guard, Big settings, invalid values and metadata even on zero rows', async () => {
    const def = {
      name: 'numeric',
      sql: 'SELECT @amount AS amount',
      params: [{ name: 'amount', type: { code: 'NUMERIC' } }],
      result: [{ name: 'amount', type: { code: 'NUMERIC' } }],
    } as const;
    const metadata = { rowType: { fields: [field('amount', 'NUMERIC')] } };
    const executor = (text: string): API.SpannerExecutor => ({
      async execute() {
        return { rows: [[{ name: 'amount', value: Spanner.numeric(text) }]], metadata };
      },
    });
    const settings = [api.Big.DP, api.Big.RM, api.Big.strict];
    try {
      api.Big.DP = 1;
      api.Big.RM = 0;
      api.Big.strict = true;
      assert.deepEqual(await api.executeQuery(executor('0.1'), def, { amount: 0.1 }), [
        { amount: 0.1 },
      ]);
      await assert.rejects(
        api.executeQuery(executor('9007199254740993'), def, { amount: 1 }),
        (error: unknown) => {
          assert.ok(error instanceof Error && error.cause instanceof Error);
          assert.equal(error.cause.message, 'result.amount: precision loss; specify type=Big');
          return true;
        },
      );
      assert.deepEqual([api.Big.DP, api.Big.RM, api.Big.strict], [1, 0, true]);
    } finally {
      api.Big.DP = settings[0] as number;
      api.Big.RM = settings[1] as API.Big.RoundingMode;
      api.Big.strict = settings[2] as boolean;
    }
    let calls = 0;
    const noCall: API.SpannerExecutor = {
      async execute() {
        calls++;
        return { rows: [], metadata };
      },
    };
    for (const params of [
      {},
      { amount: undefined },
      { amount: NaN },
      { amount: Infinity },
      { amount: 1e29 },
      { amount: 1e-10 },
      { amount: 1, extra: 2 },
    ]) {
      await assert.rejects(api.executeQuery(noCall, def, params as { amount: number }));
    }
    assert.equal(calls, 0);
    assert.deepEqual(await api.executeQuery(noCall, def, { amount: null }), []);
    await assert.rejects(
      api.executeQuery(
        {
          async execute() {
            return { rows: [], metadata: { rowType: { fields: [field('amount', 'STRING')] } } };
          },
        },
        def,
        { amount: 1 },
      ),
    );
    const jsonDef = {
      name: 'json',
      sql: 'SELECT @v',
      params: [{ name: 'v', type: { code: 'JSON' } }],
      result: [],
    } as const;
    const cycle: Record<string, unknown> = {};
    cycle.self = cycle;
    for (const value of [
      undefined,
      NaN,
      Infinity,
      1n,
      cycle,
      { x: undefined },
      new Date(),
      Array(1),
    ]) {
      await assert.rejects(api.executeQuery(noCall, jsonDef, { v: value as API.JsonValue }));
    }
  });
}
