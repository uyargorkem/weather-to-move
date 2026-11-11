import type {WeatherInsights, WeatherSource} from './types';
import {BASELINE, getProperty} from '../properties';
import {tenYearRange, type DateRange} from './openMeteo';
import {buildInsights} from './insights';
import {FIXTURES} from './fixtures';

// Bump when coordinates or thresholds change so cached browsers refetch.
const CACHE_VERSION = 'v13';
const cacheKey = (id: string, r: DateRange) => `wtm:${CACHE_VERSION}:${id}:${r.start}:${r.end}`;

function readCache(key: string): WeatherInsights | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as WeatherInsights) : null;
  } catch {
    return null;
  }
}

function writeCache(key: string, value: WeatherInsights) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // quota or private mode — fine, we just refetch next time
  }
}

const inflight = new Map<string, Promise<WeatherInsights>>();

export const openMeteoSource: WeatherSource = {
  load(propertyId) {
    const property = getProperty(propertyId);
    const range = tenYearRange();
    const key = cacheKey(property.id, range);

    const cached = readCache(key);
    if (cached) return Promise.resolve(cached);

    let p = inflight.get(key);
    if (!p) {
      p = buildInsights(property, BASELINE, range)
        .then(insights => {
          writeCache(key, insights);
          return insights;
        })
        .catch(err => {
          // Offline / rate-limited: fall back to the bundled snapshot if we have one.
          const fixture = FIXTURES[property.id];
          if (fixture) {
            console.warn('[weather-to-move] using bundled fixture:', err);
            return fixture;
          }
          throw err;
        })
        .finally(() => inflight.delete(key));
      inflight.set(key, p);
    }
    return p;
  },
};
