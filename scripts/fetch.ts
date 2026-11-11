// Downloads hourly Open-Meteo data for the baseline and every
// property in data/locations.json into data/raw/<id>.json. Existing files are
// kept unless --force is passed, so re-running costs no API calls.
//
//   npm run fetch            # only missing locations
//   npm run fetch -- --force # re-download everything
//   npm run fetch -- --start=2017-01-01 --end=2026-11-10
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {BASELINE, PROPERTIES} from '../src/properties';
import {fetchArchive, HOURLY_VARS, tenYearRange, type ArchiveResponse} from '../src/data/openMeteo';

const args = process.argv.slice(2);
const start = args.find(arg => arg.startsWith('--start='))?.slice('--start='.length);
const end = args.find(arg => arg.startsWith('--end='))?.slice('--end='.length);
const validDate = (value: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(value) && new Date(value).toJSON()?.slice(0, 10) === value;
if ((start !== undefined || end !== undefined) && (!start || !end || !validDate(start) || !validDate(end) || start > end)) {
  throw new Error('Supply both --start=YYYY-MM-DD and --end=YYYY-MM-DD in chronological order.');
}
const force = args.includes('--force') || start !== undefined;
const rawDir = resolve(import.meta.dirname, '../data/raw');
mkdirSync(rawDir, {recursive: true});

const range = start && end ? {start, end} : tenYearRange();
const rangeFile = resolve(rawDir, 'range.json');
const previous = existsSync(rangeFile) ? (JSON.parse(readFileSync(rangeFile, 'utf8')) as typeof range) : null;
if (previous && (previous.start !== range.start || previous.end !== range.end) && !force) {
  // Keep the whole raw set on one date range so property and baseline line up.
  console.log(`Existing raw data covers ${previous.start} → ${previous.end}; reusing that range (pass --force to refresh).`);
  Object.assign(range, previous);
}
console.log(`Range ${range.start} → ${range.end}\n`);

const downloads: {file: string; response: ArchiveResponse}[] = [];
const hourCount = (Date.parse(range.end) - Date.parse(range.start)) / 3_600_000 + 24;
for (const loc of [BASELINE, ...Object.values(PROPERTIES)]) {
  const file = resolve(rawDir, `${loc.id}.json`);
  if (existsSync(file) && !force) {
    console.log(`${loc.id.padEnd(10)} ${loc.label} — already downloaded`);
    continue;
  }
  process.stdout.write(`${loc.id.padEnd(10)} ${loc.label} … `);
  const res = await fetchArchive(loc.lat, loc.lon, range);
  const {time} = res.hourly;
  if (time.length !== hourCount || time[0] !== `${range.start}T00:00` || time.at(-1) !== `${range.end}T23:00` ||
      new Set(time).size !== hourCount ||
      HOURLY_VARS.some(key => {
        const values = res.hourly[key];
        return values?.length !== hourCount || values.some(value => !Number.isFinite(value));
      })) {
    throw new Error(`Incomplete Open-Meteo data for ${loc.label} in the requested range.`);
  }
  downloads.push({file, response: res});
  console.log(`${res.hourly.time.length} hours`);
}
for (const {file, response} of downloads) {
  writeFileSync(file, JSON.stringify(response));
}
writeFileSync(rangeFile, JSON.stringify(range));
console.log('\nNow run `npm run compute` to rebuild the bundled fixtures.');
