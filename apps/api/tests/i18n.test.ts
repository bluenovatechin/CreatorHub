/**
 * TESTS: translations (AGENTS.md rule 7). Runs without a database.
 *   1. The website's en.json and gu.json have exactly the same keys (no screen shows a raw key in one language).
 *   2. Every 'errors.xxx' key the API or the shared rules can send exists in the website texts (en/gu) or, for
 *      team-only errors, in the admin panel's MESSAGES list (apps/admin/src/lib.tsx).
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.resolve(__dirname, '../../..');
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf8');
const flat = (o: Record<string, unknown>, prefix = ''): string[] =>
  Object.entries(o).flatMap(([k, v]) => (v && typeof v === 'object' ? flat(v as Record<string, unknown>, `${prefix}${k}.`) : [`${prefix}${k}`]));
const sourceFiles = (dir: string): string[] =>
  fs.readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? sourceFiles(`${dir}/${e.name}`) : /\.ts$/.test(e.name) && !/\.test\.ts$/.test(e.name) ? [`${dir}/${e.name}`] : []);

const en = new Set(flat(JSON.parse(read('apps/web/src/i18n/en.json'))));
const gu = new Set(flat(JSON.parse(read('apps/web/src/i18n/gu.json'))));

describe('translations', () => {
  it('English and Gujarati have the same keys', () => {
    expect([...en].filter((k) => !gu.has(k))).toEqual([]);
    expect([...gu].filter((k) => !en.has(k))).toEqual([]);
  });

  it('every error key the API can send has a text (website or admin panel)', () => {
    const admin = read('apps/admin/src/lib.tsx');
    const used = new Set<string>();
    for (const f of [...sourceFiles('apps/api/src'), ...sourceFiles('packages/shared/src')]) {
      for (const m of read(f).matchAll(/'(errors\.[A-Za-z_.]+)'/g)) used.add(m[1]);
    }
    const missing = [...used].filter((k) => !en.has(k) && !admin.includes(`'${k}'`));
    expect(missing).toEqual([]);
  });
});
