// The IFS archive covers both locations and every year in the report.
const ARCHIVE_ENDPOINT = 'https://archive-api.open-meteo.com/v1/archive';
export const ARCHIVE_MODEL = 'ecmwf_ifs';
export const TIMEZONE = 'Europe/London';
const RETRIES = 3;

export const HOURLY_VARS = [
  'temperature_2m',
  'apparent_temperature',
  'precipitation',
  'rain',
  'snowfall',
  'wind_speed_10m',
  'wind_direction_10m',
  'wind_gusts_10m',
  'cloud_cover',
] as const;

export interface ArchiveResponse {
  latitude: number;
  longitude: number;
  timezone: string;
  utc_offset_seconds?: number;
  hourly: {
    time: string[];
    temperature_2m: (number | null)[];
    apparent_temperature: (number | null)[];
    precipitation: (number | null)[];
    rain?: (number | null)[];
    snowfall?: (number | null)[];
    wind_speed_10m: (number | null)[];
    wind_direction_10m: (number | null)[];
    wind_gusts_10m: (number | null)[];
    cloud_cover: (number | null)[];
  };
}

/** One local-time hour of weather, with the calendar fields the metrics need. */
export interface Hour {
  /** ISO local time as returned by the API, e.g. "2025-06-14T15:00". */
  time: string;
  year: number;
  /** 0 = January. */
  month: number;
  day: number;
  /** 0 = Sunday … 6 = Saturday. */
  dow: number;
  /** 0–23 local. */
  hour: number;
  temp: number;
  apparent: number;
  precip: number;
  rain?: number;
  snowfall?: number;
  wind: number;
  windDir: number;
  gust: number;
  cloud: number;
}

export interface DateRange {
  start: string;
  end: string;
}

const iso = (d: Date) => d.toISOString().slice(0, 10);
const londonClock = new Intl.DateTimeFormat('sv-SE', {
  timeZone: TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});

/** Ten calendar years including the current year through yesterday. */
export function tenYearRange(now = new Date()): DateRange {
  const londonToday = londonClock.format(now).slice(0, 10);
  const end = new Date(Date.parse(londonToday) - 86_400_000);
  const start = new Date(Date.UTC(Math.max(2017, end.getUTCFullYear() - 9), 0, 1));
  return {start: iso(start), end: iso(end)};
}

export function archiveUrl(endpoint: string, lat: number, lon: number, range: DateRange): string {
  const params = new URLSearchParams({
    latitude: lat.toFixed(4),
    longitude: lon.toFixed(4),
    start_date: range.start,
    end_date: range.end,
    hourly: HOURLY_VARS.join(','),
    models: ARCHIVE_MODEL,
    timezone: TIMEZONE,
    wind_speed_unit: 'kmh',
  });
  return `${endpoint}?${params}`;
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function fetchOnce(url: string, fetchFn: typeof fetch): Promise<ArchiveResponse> {
  const res = await fetchFn(url);
  if (!res.ok) {
    let reason = `${res.status} ${res.statusText}`;
    try {
      const body = (await res.json()) as {reason?: string};
      if (body.reason) reason = body.reason;
    } catch {
      // keep the HTTP status
    }
    const err = new Error(`Open-Meteo request failed: ${reason}`) as Error & {status?: number};
    err.status = res.status;
    throw err;
  }
  return (await res.json()) as ArchiveResponse;
}

/** Retry network and server errors without switching models mid-record. */
export async function fetchArchive(lat: number, lon: number, range: DateRange, fetchFn = fetch): Promise<ArchiveResponse> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fetchOnce(archiveUrl(ARCHIVE_ENDPOINT, lat, lon, range), fetchFn);
    } catch (err) {
      const status = (err as {status?: number}).status;
      if (attempt >= RETRIES || (status && status < 500)) throw err;
      await sleep(500 * 2 ** (attempt - 1));
    }
  }
}

/** Flattens the column-oriented API response into rows, dropping hours with any missing value. */
export function toHours(res: ArchiveResponse): Hour[] {
  const h = res.hourly;
  const firstDate = h.time[0]?.slice(0, 10);
  const lastDate = h.time.at(-1)?.slice(0, 10);
  if (!firstDate || !lastDate) return [];
  const out: Hour[] = [];
  for (let i = 0; i < h.time.length; i++) {
    const temp = h.temperature_2m[i];
    const apparent = h.apparent_temperature[i];
    const precip = h.precipitation[i];
    const wind = h.wind_speed_10m[i];
    const windDir = h.wind_direction_10m[i];
    const gust = h.wind_gusts_10m[i];
    const cloud = h.cloud_cover[i];
    if ([temp, apparent, precip, wind, windDir, gust, cloud].some(v => v == null)) continue;
    // The archive applies one UTC offset to the entire response. Convert each
    // timestamp to London time so commute windows also match during BST.
    const t = res.utc_offset_seconds === undefined ? h.time[i] : londonClock.format(
      Date.parse(`${h.time[i]}Z`) - res.utc_offset_seconds * 1000,
    ).replace(' ', 'T');
    const date = t.slice(0, 10);
    if (date < firstDate || date > lastDate) continue;
    // "YYYY-MM-DDTHH:MM" — parse by hand to stay in the API's local time, not the browser's.
    const year = +t.slice(0, 4);
    const month = +t.slice(5, 7) - 1;
    const day = +t.slice(8, 10);
    const hour = +t.slice(11, 13);
    const dow = new Date(Date.UTC(year, month, day)).getUTCDay();
    out.push({
      time: t,
      year,
      month,
      day,
      dow,
      hour,
      temp: temp!,
      apparent: apparent!,
      precip: precip!,
      rain: h.rain?.[i] ?? undefined,
      snowfall: h.snowfall?.[i] ?? undefined,
      wind: wind!,
      windDir: windDir!,
      gust: gust!,
      cloud: cloud!,
    });
  }
  return out;
}
