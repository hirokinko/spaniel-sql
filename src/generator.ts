import { randomUUID } from 'node:crypto';
import { lstat, mkdir, readdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { type AnalysisDatabase, analyzeSql } from './integration/spanner.js';
import { type SqlField, SqlGenerationError, type SqlType } from './runtime.js';

interface Annotation {
  scope: 'param' | 'result';
  name: string;
}
interface Token {
  text: string;
  quoted: boolean;
}
export interface SqlSource {
  params: string[];
  annotations: Annotation[];
}

/** Lexical boundaries only. SQL semantics and expression types belong to Spanner. */
export function inspectSql(sql: string): SqlSource {
  const tokens: Token[] = [];
  const params = new Set<string>();
  const annotations: Annotation[] = [];
  const targets = new Set<string>();
  let i = 0;
  let ended = false;
  const fail = (message: string): never => {
    throw new SqlGenerationError(`Line ${sql.slice(0, i).split('\n').length}: ${message}`);
  };
  function quoted(raw: boolean): string {
    const quote = sql[i];
    if (!quote) {
      return fail('Missing quote');
    }
    const triple = quote !== '`' && sql.slice(i, i + 3) === quote.repeat(3);
    const delimiter = triple ? quote.repeat(3) : quote;
    i += delimiter.length;
    let value = '';
    while (i < sql.length) {
      if (sql.startsWith(delimiter, i)) {
        i += delimiter.length;
        return value;
      }
      const c = sql[i++];
      if (!triple && (c === '\n' || c === '\r')) {
        return fail('Newline in quoted token');
      }
      if (c === '\\') {
        const next = sql[i++];
        if (!next) {
          return fail('Unterminated escape');
        }
        if (quote === '`') {
          const escapes: Record<string, string> = {
            n: '\n',
            r: '\r',
            t: '\t',
            '\\': '\\',
            '`': '`',
            '"': '"',
            "'": "'",
            b: '\b',
            f: '\f',
          };
          if (next in escapes) {
            value += escapes[next];
          } else if (next === 'x' || next === 'u' || next === 'U') {
            const length = next === 'x' ? 2 : next === 'u' ? 4 : 8;
            const digits = sql.slice(i, i + length);
            if (!new RegExp(`^[0-9a-fA-F]{${length}}$`).test(digits)) {
              return fail('Invalid identifier escape');
            }
            const point = Number.parseInt(digits, 16);
            if (point > 0x10ffff) {
              return fail('Invalid identifier code point');
            }
            value += String.fromCodePoint(point);
            i += length;
          } else {
            return fail('Unsupported identifier escape');
          }
        } else {
          value += raw ? `\\${next}` : next;
        }
      } else {
        value += c;
      }
    }
    return fail('Unterminated quoted token');
  }
  while (i < sql.length) {
    if (/\s/.test(sql[i] ?? '')) {
      i++;
      continue;
    }
    if (sql.startsWith('--', i) || sql[i] === '#' || sql.startsWith('/*', i)) {
      const start = i;
      const block = sql.startsWith('/*', i);
      const dash = sql.startsWith('--', i);
      const offset = block || dash ? 2 : 1;
      const end = block ? sql.indexOf('*/', i + 2) : sql.indexOf('\n', i);
      if (block && end === -1) {
        return fail('Unterminated comment');
      }
      const text = sql.slice(i + offset, end === -1 ? sql.length : end).trim();
      if (text.startsWith('@spaniel')) {
        if (
          !dash ||
          tokens.length ||
          ended ||
          !/^\s*$/.test(sql.slice(sql.lastIndexOf('\n', start - 1) + 1, start))
        ) {
          return fail('Annotation must be a leading standalone -- comment');
        }
        const match =
          /^@spaniel\s+(param|result)\s+("(?:[^"\\]|\\.)*"|[A-Za-z_][A-Za-z0-9_]*)\s+type=Big$/.exec(
            text,
          );
        if (!match) {
          return fail('Invalid @spaniel annotation');
        }
        const scope = match[1] as 'param' | 'result';
        const nameToken = match[2] ?? '';
        let name: string;
        try {
          name = nameToken.startsWith('"') ? JSON.parse(nameToken) : nameToken;
        } catch {
          return fail('Invalid annotation name');
        }
        const key = JSON.stringify([scope, name]);
        if (!name || targets.has(key)) {
          return fail('Empty or duplicate annotation');
        }
        targets.add(key);
        annotations.push({ scope, name });
      }
      i = end === -1 ? sql.length : end + (block ? 2 : 1);
      continue;
    }
    if (ended) {
      return fail('Only one SQL statement is allowed');
    }
    if (sql[i] === ';') {
      ended = true;
      i++;
      continue;
    }
    if (sql[i] === '@' && sql[i + 1] !== '{') {
      i++;
      let name: string;
      if (sql[i] === '`') {
        name = quoted(false);
      } else {
        const match = /^[A-Za-z_][A-Za-z0-9_]*/.exec(sql.slice(i));
        if (!match) {
          return fail('Unsupported parameter name');
        }
        name = match[0];
        i += name.length;
      }
      params.add(name);
      tokens.push({ text: '@parameter', quoted: true });
      continue;
    }
    const prefix = /^(?:br|rb|r|b)(?=['"])/i.exec(sql.slice(i));
    if (prefix) {
      i += prefix[0].length;
      quoted(/r/i.test(prefix[0]));
      tokens.push({ text: 'literal', quoted: true });
      continue;
    }
    if (sql[i] === '"' || sql[i] === "'" || sql[i] === '`') {
      tokens.push({ text: quoted(false), quoted: true });
      continue;
    }
    const word = /^[A-Za-z_][A-Za-z0-9_]*/.exec(sql.slice(i));
    if (word) {
      tokens.push({ text: word[0].toUpperCase(), quoted: false });
      i += word[0].length;
      continue;
    }
    tokens.push({ text: sql[i] ?? '', quoted: false });
    i++;
  }
  // Remove optimizer hints from the statement-kind guard, while retaining original SQL.
  const statement: Token[] = [];
  for (let n = 0; n < tokens.length; n++) {
    const token = tokens[n];
    if (!token) {
      continue;
    }
    if (!token.quoted && token.text === '@' && tokens[n + 1]?.text === '{') {
      n += 2;
      while (n < tokens.length && (tokens[n]?.quoted || tokens[n]?.text !== '}')) {
        n++;
      }
      if (n === tokens.length) {
        return fail('Unterminated hint');
      }
    } else {
      statement.push(token);
    }
  }
  let depth = 0;
  for (const token of statement) {
    if (token.quoted) {
      continue;
    }
    if (token.text === '(') {
      depth++;
      continue;
    }
    if (token.text === ')') {
      if (--depth < 0) {
        return fail('Unbalanced parentheses');
      }
    }
  }
  const is = (at: number, text: string) =>
    statement[at]?.quoted === false && statement[at]?.text === text;
  const afterGroup = (at: number): number => {
    let level = 0;
    for (let n = at; n < statement.length; n++) {
      if (is(n, '(')) {
        level++;
      }
      if (is(n, ')') && --level === 0) {
        return n + 1;
      }
    }
    return fail('Unbalanced parentheses');
  };
  function readStart(at: number): boolean {
    if (is(at, '(')) {
      return readStart(at + 1);
    }
    if (is(at, 'SELECT')) {
      return true;
    }
    if (!is(at, 'WITH')) {
      return false;
    }
    let next = at + 1;
    if (is(next, 'RECURSIVE')) {
      next++;
    }
    while (next < statement.length) {
      next++; // CTE name; its validity is checked by Spanner.
      if (is(next, '(')) {
        next = afterGroup(next);
      } // Optional column names.
      if (!is(next, 'AS') || !is(next + 1, '(')) {
        return false;
      }
      next = afterGroup(next + 1);
      if (!is(next, ',')) {
        return readStart(next);
      }
      next++;
    }
    return false;
  }
  if (depth !== 0 || !readStart(0)) {
    return fail('Expected one read query');
  }
  return { params: [...params].sort(), annotations };
}

function bigType(type: SqlType): { type: SqlType; count: number } {
  if (type.code === 'NUMERIC') {
    return { type: { code: 'NUMERIC', representation: 'Big' }, count: 1 };
  }
  if (type.code === 'ARRAY') {
    const result = bigType(type.element);
    return { type: { code: 'ARRAY', element: result.type }, count: result.count };
  }
  if (type.code === 'STRUCT') {
    let count = 0;
    const fields = type.fields.map((f) => {
      const result = bigType(f.type);
      count += result.count;
      return { name: f.name, type: result.type };
    });
    return { type: { code: 'STRUCT', fields }, count };
  }
  return { type, count: 0 };
}

function tsType(type: SqlType, direction: 'input' | 'output'): string {
  let value: string;
  switch (type.code) {
    case 'STRING':
      value = 'string';
      break;
    case 'BOOL':
      value = 'boolean';
      break;
    case 'FLOAT64':
      value = 'number';
      break;
    case 'INT64':
      value = 'bigint';
      break;
    case 'NUMERIC':
      value = type.representation === 'Big' ? '__spaniel.Big' : 'number';
      break;
    case 'DATE':
      value = '__spaniel.Temporal.PlainDate';
      break;
    case 'TIMESTAMP':
      value = direction === 'input' ? 'Date' : '__spaniel.PreciseDate';
      break;
    case 'BYTES':
      value = 'Buffer';
      break;
    case 'JSON':
      return '__spaniel.JsonValue';
    case 'ARRAY':
      value = `Array<${tsType(type.element, direction)}>`;
      break;
    case 'STRUCT':
      value = tsFields(type.fields, direction);
      break;
  }
  return `${value} | null`;
}
function tsFields(fields: readonly SqlField[], direction: 'input' | 'output'): string {
  return `{ ${fields.map((f) => `${JSON.stringify(f.name)}: ${tsType(f.type, direction)};`).join(' ')} }`;
}

const reserved = new Set(
  'await break case catch class const continue debugger default delete do else enum export extends false finally for function if implements import in instanceof interface let new null package private protected public return static super switch this throw true try typeof var void while with yield arguments eval'.split(
    ' ',
  ),
);
function queryNames(path: string): { fn: string; type: string } {
  const words = path.slice(0, -4).split(/[\\/\-_]/);
  if (
    !words.length ||
    !/^[A-Za-z][A-Za-z0-9]*$/.test(words[0] ?? '') ||
    words.some((word) => !/^[A-Za-z0-9]+$/.test(word))
  ) {
    throw new SqlGenerationError(`Invalid SQL filename: ${path}`);
  }
  const title = (word: string) => word.charAt(0).toUpperCase() + word.slice(1);
  const fn =
    (words[0]?.charAt(0).toLowerCase() ?? '') +
    (words[0]?.slice(1) ?? '') +
    words.slice(1).map(title).join('');
  if (reserved.has(fn)) {
    throw new SqlGenerationError(`Reserved query name: ${path}`);
  }
  return { fn, type: words.map(title).join('') };
}

const header = '// Generated by spaniel-sql 0.0.1. Do not edit.\n';
export interface GenerateOptions {
  sqlDir: string;
  outDir: string;
  database: AnalysisDatabase;
  check?: boolean;
}

async function sqlFiles(dir: string): Promise<string[]> {
  const files: string[] = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await sqlFiles(path)));
    } else if (entry.isFile() && entry.name.endsWith('.sql')) {
      files.push(path);
    }
  }
  return files.sort();
}
async function noSymlinks(path: string): Promise<void> {
  let current = resolve(path);
  while (true) {
    try {
      if ((await lstat(current)).isSymbolicLink()) {
        throw new SqlGenerationError('Symlink input/output paths are not supported');
      }
    } catch (error) {
      if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) {
        throw error;
      }
    }
    const parent = dirname(current);
    if (parent === current) {
      return;
    }
    current = parent;
  }
}

export async function generate(
  options: GenerateOptions,
): Promise<{ outputPath: string; queryCount: number }> {
  let temporary: string | undefined;
  try {
    const sqlDir = resolve(options.sqlDir);
    const outputPath = resolve(options.outDir, 'queries.ts');
    await noSymlinks(sqlDir);
    await noSymlinks(outputPath);
    const files = await sqlFiles(sqlDir);
    if (!files.length) {
      throw new SqlGenerationError('No .sql files found');
    }
    const exports = new Set<string>(['__spaniel']);
    const parts = [header, 'import * as __spaniel from "spaniel-sql";\n'];
    for (const file of files) {
      const path = relative(sqlDir, file).split(sep).join('/');
      try {
        const names = queryNames(path);
        for (const name of [names.fn, `${names.type}Params`, `${names.type}Row`]) {
          if (exports.has(name)) {
            throw new SqlGenerationError('Generated export collision');
          }
          exports.add(name);
        }
        const sql = new TextDecoder('utf-8', { fatal: true }).decode(await readFile(file));
        const source = inspectSql(sql);
        const analysis = await analyzeSql(options.database, sql);
        analysis.params.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
        if (JSON.stringify(analysis.params.map((f) => f.name)) !== JSON.stringify(source.params)) {
          throw new SqlGenerationError('Parameter metadata mismatch');
        }
        for (const annotation of source.annotations) {
          const fields = annotation.scope === 'param' ? analysis.params : analysis.result;
          const index = fields.findIndex((f) => f.name === annotation.name);
          const field = fields[index];
          if (!field) {
            throw new SqlGenerationError('Unknown annotation target');
          }
          const selected = bigType(field.type);
          if (!selected.count) {
            throw new SqlGenerationError('Annotation target contains no NUMERIC');
          }
          fields[index] = { name: field.name, type: selected.type };
        }
        const definition = {
          name: names.fn,
          sql,
          params: analysis.params,
          result: analysis.result,
        };
        parts.push(
          `export type ${names.type}Params = ${tsFields(analysis.params, 'input')};\nexport type ${names.type}Row = ${tsFields(analysis.result, 'output')};\nexport function ${names.fn}(executor: __spaniel.SpannerExecutor${analysis.params.length ? `, params: ${names.type}Params` : ''}): Promise<${names.type}Row[]> {\n  const definition = ${JSON.stringify(definition)} as const satisfies __spaniel.QueryDefinition;\n  return __spaniel.executeQuery(executor, definition, ${analysis.params.length ? 'params' : '{}'});\n}\n`,
        );
      } catch (cause) {
        throw new SqlGenerationError(`Generation failed for ${path}`, { cause });
      }
    }
    const content = parts.join('\n');
    let previous: string | undefined;
    try {
      previous = await readFile(outputPath, 'utf8');
    } catch (error) {
      if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) {
        throw error;
      }
    }
    if (previous !== undefined && !previous.startsWith(header)) {
      throw new SqlGenerationError('Refusing to overwrite non-generated file');
    }
    if (options.check) {
      if (previous !== content) {
        throw new SqlGenerationError('Generated queries are missing or out of date');
      }
    } else if (previous !== content) {
      await mkdir(dirname(outputPath), { recursive: true });
      temporary = join(dirname(outputPath), `.spaniel-${randomUUID()}.tmp`);
      await writeFile(temporary, content, { flag: 'wx' });
      await noSymlinks(outputPath);
      await rename(temporary, outputPath);
      temporary = undefined;
    }
    return { outputPath, queryCount: files.length };
  } catch (cause) {
    if (cause instanceof SqlGenerationError) {
      throw cause;
    }
    throw new SqlGenerationError('SQL generation failed', { cause });
  } finally {
    if (temporary) {
      await unlink(temporary);
    }
  }
}
