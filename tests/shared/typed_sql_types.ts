import { Big, executeQuery, type SpannerExecutor, Temporal } from 'spaniel-sql';

// Compile-time contract checks; this function is deliberately not executed.
export function checkGeneratedContracts(executor: SpannerExecutor) {
  const definition = {
    name: 'typed',
    sql: 'SELECT @id AS Id',
    params: [
      { name: 'id', type: { code: 'INT64' } },
      { name: 'amount', type: { code: 'NUMERIC', representation: 'Big' } },
      { name: 'day', type: { code: 'DATE' } },
    ],
    result: [{ name: 'Id', type: { code: 'INT64' } }],
  } as const;
  const valid = { id: 1n, amount: new Big('0.1'), day: Temporal.PlainDate.from('2024-02-29') };
  executeQuery(executor, definition, valid);
  executeQuery(executor, definition, { id: null, amount: null, day: null });
  // @ts-expect-error All parameter keys are required.
  executeQuery(executor, definition, { id: 1n });
  // @ts-expect-error INT64 is not a number.
  executeQuery(executor, definition, { ...valid, id: 1 });
  // @ts-expect-error Explicit Big does not accept number.
  executeQuery(executor, definition, { ...valid, amount: 0.1 });
  // @ts-expect-error DATE is not a Date timestamp.
  executeQuery(executor, definition, { ...valid, day: new Date() });
  // @ts-expect-error undefined is not SQL NULL.
  executeQuery(executor, definition, { ...valid, id: undefined });
  executeQuery(executor, definition, valid).then((rows) => {
    for (const row of rows) {
      // @ts-expect-error NULL must be handled before arithmetic.
      row.Id + 1n;
      // @ts-expect-error Unknown result field.
      row.Missing;
      const id: bigint | null = row.Id;
      return id;
    }
    return null;
  });
}
