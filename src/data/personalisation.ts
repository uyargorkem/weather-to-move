import {BASELINE, getProperty} from '../properties';
import {fetchHourlyWeather, liveHours, type HourlyWeather} from './insights';
import {toHours, type ArchiveResponse} from './openMeteo';
import type {WeatherInsights} from './types';

const archives = import.meta.glob<string>(['../../data/raw/*.json', '!../../data/raw/range.json'], {
  query: '?url', import: 'default',
});

async function loadArchive(id: string, start: string, end: string) {
  const asset = archives[`../../data/raw/${id}.json`];
  if (!asset) throw new Error(`Missing hourly weather for ${id}`);
  const response = await fetch(await asset());
  if (!response.ok) throw new Error(`Could not load hourly weather for ${id}`);
  const archive = await response.json() as ArchiveResponse;
  const {time, rain, snowfall} = archive.hourly;
  if (time[0]?.slice(0, 10) !== start || time.at(-1)?.slice(0, 10) !== end) {
    throw new Error(`Hourly weather does not match the report for ${id}`);
  }
  if (rain?.length !== time.length || snowfall?.length !== time.length) {
    throw new Error(`Missing rain or snowfall measurements for ${id}`);
  }
  return toHours(archive);
}

export async function loadPersonalisationHours(data: WeatherInsights): Promise<HourlyWeather> {
  const {rangeStart: start, rangeEnd: end, propertyId} = data;
  if (data.source === 'live') {
    return liveHours.get(data) ?? fetchHourlyWeather(getProperty(propertyId), BASELINE, {start, end});
  }
  const [property, baseline] = await Promise.all([
    loadArchive(propertyId, start, end),
    loadArchive(BASELINE.id, start, end),
  ]);
  return {property, baseline};
}
