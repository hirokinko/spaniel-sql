// Run from repository root after building. No network or database writes.
const assert = require('node:assert/strict');
const { Snapshot, Spanner } = require('@google-cloud/spanner');
const api = require('../../../../dist/index.js');

async function main() {
  let checks = 0;
  async function roundtrip(type, input, sdkValue, expected = input) {
    const definition = { name: 'verify', sql: 'SELECT @v AS v', params: [{ name: 'v', type }], result: [{ name: 'v', type }] };
    const result = await api.executeQuery({ async execute(request) {
      assert.equal(request.sql, definition.sql);
      assert.equal(request.types.v.type, type.code.toLowerCase());
      return { rows: [[{ name: 'v', value: sdkValue }]], metadata: { rowType: { fields: [{ name: 'v', type }] } } };
    } }, definition, { v: input });
    assert.deepEqual(result, [{ v: expected }]);
    checks++;
  }
  for (const n of [-(1n << 63n), (1n << 63n) - 1n]) await roundtrip({ code: 'INT64' }, n, Spanner.int(n.toString()));
  for (const n of [NaN, Infinity, -Infinity, 0]) await roundtrip({ code: 'FLOAT64' }, n, Spanner.float(n));
  await roundtrip({ code: 'STRING' }, '', '');
  await roundtrip({ code: 'BOOL' }, false, false);
  await roundtrip({ code: 'BYTES' }, Buffer.from([0, 255]), Buffer.from([0, 255]));
  for (const code of ['INT64', 'NUMERIC', 'STRING', 'BOOL', 'FLOAT64', 'BYTES', 'DATE', 'TIMESTAMP', 'JSON']) await roundtrip({ code }, null, null);
  let calls = 0;
  for (const [code, value] of [
    ['INT64', -(1n << 63n) - 1n], ['INT64', 1n << 63n], ['INT64', 1],
    ['DATE', api.Temporal.PlainDate.from('0000-01-01')],
    ['DATE', api.Temporal.PlainDate.from('2024-01-01[u-ca=hebrew]')],
    ['TIMESTAMP', new Date(NaN)], ['TIMESTAMP', new Date('0000-01-01')],
  ]) {
    await assert.rejects(api.executeQuery({ async execute() { calls++; throw Error('sent'); } },
      { name: 'invalid', sql: 'SELECT @v', params: [{ name: 'v', type: { code } }], result: [] }, { v: value }));
    checks++;
  }
  assert.equal(calls, 0);
  console.log(`PASS: ${checks} independent boundary/NULL/rejection cases`);

  // Snapshot is a public SDK export. Its internal serializer is inspected only
  // by this verification probe to observe the SDK boundary without credentials.
  for (const name of ['ordinary', 'fields', '__proto__']) {
    let wire;
    await api.executeQuery(api.createSpannerExecutor({ async run(request) {
      wire = Snapshot.encodeParams(request);
      return [[], {}, { rowType: { fields: [] } }];
    } }), { name: 'names', sql: `SELECT @\`${name}\``, params: [{ name, type: { code: 'STRING' } }], result: [] }, Object.fromEntries([[name, 'value']]));
    const preserved = Object.hasOwn(wire.params.fields, name) && wire.params.fields[name].stringValue === 'value' && Object.hasOwn(wire.paramTypes, name);
    console.log(`${preserved ? 'PASS' : 'FAIL'}: SDK wire preserves parameter ${JSON.stringify(name)}`);
    assert.equal(preserved, name === 'ordinary', 'Recheck the recorded SDK parameter-name defect');
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
