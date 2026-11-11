import {COMMUTE_WEATHER, RAIN_INTENSITIES, type WeatherInsights} from './types';
import type {Property} from '../properties';
import {fetchArchive, toHours, type DateRange, type Hour} from './openMeteo';
import {T, compute, formatCommuteHours, outdoorDayBands, toFilteredMetrics, toMetrics, type WeatherRules} from './metrics';

export interface HourlyWeather {
  property: Hour[];
  baseline: Hour[];
}

type Period = Pick<WeatherInsights, 'propertyId' | 'propertyLabel' | 'baselineLabel' | 'rangeStart' | 'rangeEnd'>;

export function summarisePeriod(period: Period, hours: HourlyWeather, annualised: boolean, rules: WeatherRules = T): WeatherInsights {
  const pc = compute(hours.property, annualised, rules);
  const bc = compute(hours.baseline, annualised, rules);
  const metrics = toMetrics(pc, bc, annualised, rules.commute);
  if (rules.comfort !== T.comfort) {
    const {minApparent, maxApparent, maxWind, maxPrecip} = rules.comfort;
    const rain = maxPrecip > T.comfort.maxPrecip ? 'Light drizzle allowed.' : 'Dry only.';
    metrics.comfort.definition = `8 am to 8 pm, feeling like ${minApparent}–${maxApparent}°C, with winds under ${maxWind} km/h. ${rain}`;
  }
  if (rules.weekend !== T.weekend) {
    metrics.weekends.definition = `At least ${rules.weekend.minUsableHours} hours from noon to 6 pm that feel like ${rules.weekend.minApparent}°C or warmer, with dry weather and light winds.`;
  }
  if (rules.commute !== T.commute) {
    const {am, pm, weather} = rules.commute;
    const condition = weather ? COMMUTE_WEATHER[weather].description : 'At least 0.2 mm of precipitation in an hour';
    metrics.commute.definition = `${condition}. Weekdays ${formatCommuteHours(am)} or ${formatCommuteHours(pm)}.`;
  }
  if (rules.windRain !== T.windRain) {
    const {intensity, minPrecip, minWind} = rules.windRain;
    const rain = intensity ? RAIN_INTENSITIES[intensity].description : `At least ${minPrecip} mm of precipitation in an hour`;
    metrics.windRain.definition = `${rain}, with winds of at least ${minWind} km/h.`;
  }
  return {
    ...period,
    metrics,
    filters: toFilteredMetrics(pc, bc, metrics, rules.commute),
    detail: {
      ...pc.detail,
      comfort: {
        ...pc.detail.comfort,
        dailyHours: outdoorDayBands(hours.property, hours.baseline, pc.years, rules.comfort),
      },
    },
  };
}

/** Compute matching periods from the same hourly series for the dashboard and drawer. */
export function summariseInsights(property: Property, baseline: Property, range: DateRange, propertyHours: Hour[], baselineHours: Hour[]): WeatherInsights {
  const summarise = (period: DateRange, p: Hour[], b: Hour[], annualised: boolean): WeatherInsights => {
    return summarisePeriod({
      propertyId: property.id,
      propertyLabel: property.label,
      baselineLabel: baseline.label,
      rangeStart: period.start,
      rangeEnd: period.end,
    }, {property: p, baseline: b}, annualised);
  };

  const combined = summarise(range, propertyHours, baselineHours, true);
  combined.byYear = [];
  for (let year = Number(range.start.slice(0, 4)); year <= Number(range.end.slice(0, 4)); year++) {
    const p = propertyHours.filter(hour => hour.year === year);
    const b = baselineHours.filter(hour => hour.year === year);
    if (!p.length || !b.length) continue;
    combined.byYear.push(summarise({
      start: range.start.startsWith(String(year)) ? range.start : `${year}-01-01`,
      end: range.end.startsWith(String(year)) ? range.end : `${year}-12-31`,
    }, p, b, false));
  }
  return combined;
}

export async function fetchHourlyWeather(property: Property, baseline: Property, range: DateRange): Promise<HourlyWeather> {
  const [p, b] = await Promise.all([fetchArchive(property.lat, property.lon, range), fetchArchive(baseline.lat, baseline.lon, range)]);
  return {property: toHours(p), baseline: toHours(b)};
}

export const liveHours = new WeakMap<WeatherInsights, HourlyWeather>();

/** Keep the hourly rows available for changes to the live report. */
export async function buildInsights(property: Property, baseline: Property, range: DateRange): Promise<WeatherInsights> {
  const hours = await fetchHourlyWeather(property, baseline, range);
  const data = summariseInsights(property, baseline, range, hours.property, hours.baseline);
  data.source = 'live';
  liveHours.set(data, hours);
  return data;
}
