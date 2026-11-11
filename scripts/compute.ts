// Computes the insights for every property from the raw files in data/raw
// (no network) and writes src/data/fixtures/<id>.json, which the app bundles.
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {BASELINE, PROPERTIES} from '../src/properties';
import {toHours, type ArchiveResponse, type DateRange} from '../src/data/openMeteo';
import {summariseInsights} from '../src/data/insights';
import {METRIC_KEYS} from '../src/data/types';

const rawDir = resolve(import.meta.dirname, '../data/raw');
const outDir = resolve(import.meta.dirname, '../src/data/fixtures');
mkdirSync(outDir, {recursive: true});

const readRaw = (id: string): ArchiveResponse => {
  const file = resolve(rawDir, `${id}.json`);
  if (!existsSync(file)) throw new Error(`Missing ${file} — run \`npm run fetch\` first.`);
  return JSON.parse(readFileSync(file, 'utf8')) as ArchiveResponse;
};

const range = JSON.parse(readFileSync(resolve(rawDir, 'range.json'), 'utf8')) as DateRange;
const baseline = toHours(readRaw(BASELINE.id));
console.log(`Range ${range.start} → ${range.end}, baseline ${BASELINE.label}\n`);

for (const property of Object.values(PROPERTIES)) {
  const insights = summariseInsights(property, BASELINE, range, toHours(readRaw(property.id)), baseline);
  writeFileSync(resolve(outDir, `${property.id}.json`), JSON.stringify(insights));
  console.log(`${property.id} ${property.label}`);
  for (const k of METRIC_KEYS) {
    const m = insights.metrics[k];
    console.log(`  ${m.title.padEnd(36)} ${m.display}`);
  }
  console.log();
}
