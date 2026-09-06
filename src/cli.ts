#!/usr/bin/env node
import { Spanner } from '@google-cloud/spanner';
import { generate } from './generator.js';

async function main(): Promise<void> {
  const [command, ...args] = process.argv.slice(2);
  const values = new Map<string, string>();
  let check = false;
  try {
    if (command !== 'generate') {
      throw new Error('Expected generate command');
    }
    for (let i = 0; i < args.length; i++) {
      const key = args[i] ?? '';
      if (key === '--check' && !check) {
        check = true;
        continue;
      }
      if (
        !['--sql', '--out', '--project', '--instance', '--database'].includes(key) ||
        values.has(key)
      ) {
        throw new Error('Unknown or duplicate argument');
      }
      const value = args[++i];
      if (!value || value.startsWith('--')) {
        throw new Error('Missing argument value');
      }
      values.set(key, value);
    }
    if (values.size !== 5) {
      throw new Error('Required: --sql --out --project --instance --database');
    }
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : 'Invalid arguments'}\n`);
    process.exitCode = 2;
    return;
  }
  const spanner = new Spanner({ projectId: values.get('--project') ?? '' });
  const database = spanner
    .instance(values.get('--instance') ?? '')
    .database(values.get('--database') ?? '');
  try {
    const result = await generate({
      sqlDir: values.get('--sql') ?? '',
      outDir: values.get('--out') ?? '',
      database,
      check,
    });
    process.stdout.write(`${check ? 'Checked' : 'Generated'} ${result.queryCount} queries\n`);
  } catch (error) {
    // SDK causes may contain SQL or values. Do not print the cause chain from the CLI.
    process.stderr.write(`${error instanceof Error ? error.message : 'Generation failed'}\n`);
    process.exitCode = 1;
  } finally {
    try {
      await database.close();
    } finally {
      await spanner.close();
    }
  }
}

main().catch(() => {
  process.stderr.write('CLI failed\n');
  process.exitCode = 1;
});
