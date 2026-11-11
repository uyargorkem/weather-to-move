import {describe, expect, it} from 'vitest';
import type {Hour} from './openMeteo';
import {summariseInsights, summarisePeriod} from './insights';
import {toHours, tenYearRange, type ArchiveResponse} from './openMeteo';
import {
  comfortMonthly,
  DRIZZLE_LIMIT_MM,
  T,
  commuteDetail,
  commuteMonthly,
  commuteStats,
  compute,
  spanYears,
  weekendAfternoons,
  weekendDetail,
  windRainDetail,
  windRainMonthly,
} from './metrics';

/** Builds a run of hours starting at a UTC date, with per-hour overrides. */
function hours(start: string, count: number, fill: (h: Hour, i: number) => Partial<Hour> = () => ({})): Hour[] {
  const base = new Date(start + 'T00:00:00Z');
  return Array.from({length: count}, (_, i) => {
    const d = new Date(base.getTime() + i * 3_600_000);
    const h: Hour = {
      time: d.toISOString().slice(0, 16),
      year: d.getUTCFullYear(),
      month: d.getUTCMonth(),
      day: d.getUTCDate(),
      dow: d.getUTCDay(),
      hour: d.getUTCHours(),
      temp: 20,
      apparent: 20,
      precip: 0,
      wind: 10,
      windDir: 225,
      gust: 20,
      cloud: 30,
    };
    return {...h, ...fill(h, i)};
  });
}

it('uses observed counts and matching London data for a partial year', () => {
  const range = {start: '2025-12-31', end: '2026-01-04'};
  const property = {id: 'test', label: 'Property', lat: 0, lon: 0};
  const baseline = {...property, id: 'london', label: 'London'};
  const p = hours(range.start, 5 * 24, hour => ({precip: hour.year === 2025 ? 1 : 0}));
  const b = hours(range.start, 5 * 24, hour => ({precip: hour.hour === 8 ? 1 : 0}));
  const insights = summariseInsights(property, baseline, range, p, b);
  expect(insights.byYear).toHaveLength(2);
  const current = insights.byYear![1];
  expect(current).toMatchObject({rangeStart: '2026-01-01', rangeEnd: '2026-01-04'});
  expect(current.metrics.comfort).toMatchObject({display: '48 hours', baseline: 44});
  expect(current.metrics.weekends.display).toBe('2 of 2');
  expect(current.metrics.commute).toMatchObject({value: 0, baseline: 50});
  expect(current.detail.weekends.bySeason[0]).toMatchObject({usable: 2, total: 2});
  expect(current.filters?.commute.am).toMatchObject({value: 0, baseline: 100});
  expect(current.filters?.commute.pm).toMatchObject({value: 0, baseline: 0});
});

it('compares weekends only within the selected season', () => {
  const range = {start: '2025-01-01', end: '2025-12-31'};
  const property = {id: 'test', label: 'Property', lat: 0, lon: 0};
  const baseline = {...property, id: 'london', label: 'London'};
  const p = hours(range.start, 365 * 24, hour => ({precip: hour.month === 5 ? 0 : 1}));
  const b = hours(range.start, 365 * 24, hour => ({precip: hour.month === 6 ? 0 : 1}));
  const summer = summariseInsights(property, baseline, range, p, b).byYear?.[0].filters?.weekends.Summer;
  expect(summer).toMatchObject({value: 9, baseline: 8, display: '9 of 27'});
  expect(summer?.monthly.slice(5, 8)).toEqual([9, 0, 0]);
  expect(summer?.baselineMonthly.slice(5, 8)).toEqual([0, 8, 0]);
});

it('applies each preference to the same dates for the home and London', () => {
  const period = {
    propertyId: 'test', propertyLabel: 'Home', baselineLabel: 'Central London',
    rangeStart: '2026-01-03', rangeEnd: '2026-01-05',
  };
  const property = hours(period.rangeStart, 3 * 24, hour => {
    const wet = hour.day === 5 && hour.hour === 7;
    return {apparent: 13, precip: wet ? 1 : 0, wind: wet ? 25 : 10};
  });
  const baseline = hours(period.rangeStart, 3 * 24, hour => ({apparent: hour.day === 5 ? 10 : 20}));
  const defaults = summarisePeriod(period, {property, baseline}, false);
  const custom = summarisePeriod(period, {property, baseline}, false, {
    comfort: {...T.comfort, minApparent: 12},
    weekend: {...T.weekend, minApparent: 14},
    commute: {...T.commute, am: [6, 8]},
    windRain: {...T.windRain, minWind: 30},
  });
  expect(defaults.metrics.comfort.value).toBe(0);
  expect(custom.metrics.comfort).toMatchObject({value: 36, baseline: 24});
  expect(defaults.metrics.weekends.value).toBe(2);
  expect(custom.filters?.weekends.Winter).toMatchObject({value: 0, baseline: 2});
  expect(defaults.filters?.commute.am.value).toBe(0);
  expect(custom.filters?.commute.am).toMatchObject({value: 100, baseline: 0});
  expect(custom.filters?.commute.am.insights[0]).toBe('Weekdays, 6 am to 8 am.');
  expect(defaults.metrics.windRain.value).toBe(1);
  expect(custom.metrics.windRain.value).toBe(0);
  expect(custom.detail.windRain.rose.every(value => value === 0)).toBe(true);
});

it('compares four outdoor-hour bands using complete days and the same preferences', () => {
  const period = {
    propertyId: 'test', propertyLabel: 'Home', baselineLabel: 'Central London',
    rangeStart: '2026-01-01', rangeEnd: '2026-01-05',
  };
  const property = hours(period.rangeStart, 5 * 24, hour => ({
    apparent: hour.hour - 8 < [0, 2, 4, 5, 12][hour.day - 1] ? 20 : 5,
  }));
  const baseline = hours(period.rangeStart, 5 * 24, hour => ({
    apparent: hour.hour - 8 < [1, 3, 5, 5, 12][hour.day - 1] ? 20 : 5,
  })).filter(hour => hour.day !== 5 || hour.hour !== 9);
  expect(summarisePeriod(period, {property, baseline}, false).detail.comfort.dailyHours).toEqual({
    home: [1, 1, 1, 1], baseline: [0, 1, 1, 2],
  });
  const rules = {...T, comfort: {...T.comfort, minApparent: 21}};
  expect(summarisePeriod(period, {property, baseline}, false, rules).detail.comfort.dailyHours).toEqual({
    home: [4, 0, 0, 0], baseline: [4, 0, 0, 0],
  });
});

describe('tenYearRange', () => {
  it('includes ten calendar years through yesterday', () => {
    const r = tenYearRange(new Date('2026-11-11T10:00:00Z'));
    expect(r).toEqual({start: '2017-01-01', end: '2026-11-10'});
  });
});

describe('toHours', () => {
  it('parses local time and skips rows with nulls', () => {
    const res: ArchiveResponse = {
      latitude: 0,
      longitude: 0,
      timezone: 'Europe/London',
      hourly: {
        time: ['2025-06-14T15:00', '2025-06-14T16:00'],
        temperature_2m: [21, null],
        apparent_temperature: [20, 20],
        precipitation: [0, 0],
        wind_speed_10m: [5, 5],
        wind_direction_10m: [200, 200],
        wind_gusts_10m: [10, 10],
        cloud_cover: [0, 0],
      },
    };
    const out = toHours(res);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({year: 2025, month: 5, day: 14, hour: 15, dow: 6});
  });

  it('converts fixed-offset archive timestamps to London summer time', () => {
    const res: ArchiveResponse = {
      latitude: 0, longitude: 0, timezone: 'Europe/London', utc_offset_seconds: 0,
      hourly: {
        time: ['2025-06-14T07:00'], temperature_2m: [21], apparent_temperature: [20],
        precipitation: [0.5], rain: [0.5], snowfall: [0], wind_speed_10m: [5],
        wind_direction_10m: [180], wind_gusts_10m: [10], cloud_cover: [30],
      },
    };
    expect(toHours(res)[0]).toMatchObject({hour: 8, rain: 0.5, snowfall: 0});
  });
});

describe('comfortMonthly', () => {
  it('includes drizzle only when allowed and keeps heavier rain out', () => {
    const day = hours('2025-06-02', 24, hour => ({
      precip: hour.hour === 9 ? 0.3 : hour.hour === 10 ? 0.5 : 0,
    }));
    expect(comfortMonthly(day, 1)[5]).toBe(10);
    expect(comfortMonthly(day, 1, {...T.comfort, maxPrecip: DRIZZLE_LIMIT_MM})[5]).toBe(11);
  });

  it('counts only 08–20 hours that meet every threshold', () => {
    // One full day in June, all comfortable → 12 hours.
    const day = hours('2025-06-02', 24);
    expect(comfortMonthly(day, 1)[5]).toBe(12);
  });
  it('rejects rain, wind, cold and heat', () => {
    const day = hours('2025-06-02', 24, (h) =>
      h.hour === 10 ? {precip: 0.5} : h.hour === 11 ? {wind: 30} : h.hour === 12 ? {apparent: 10} : h.hour === 13 ? {apparent: 30} : {},
    );
    expect(comfortMonthly(day, 1)[5]).toBe(8);
  });
  it('divides by the number of years', () => {
    const day = hours('2025-06-02', 24);
    expect(comfortMonthly(day, 2)[5]).toBe(6);
  });
});

describe('weekend afternoons', () => {
  it('finds Saturday and Sunday and needs 4 of 6 relaxed-comfortable hours', () => {
    // 2025-06-07 is a Saturday. Make Saturday fine, Sunday rained out from 13:00.
    const weekend = hours('2025-06-07', 48, (h) => (h.day === 8 && h.hour >= 13 ? {precip: 1} : {}));
    const afternoons = weekendAfternoons(weekend);
    expect(afternoons.map(a => a.usable)).toEqual([true, false]);
  });
  it('accepts a cool but dry afternoon (relaxed 12 °C floor)', () => {
    const sat = hours('2025-06-07', 24, () => ({apparent: 13}));
    expect(weekendAfternoons(sat)[0].usable).toBe(true);
  });
  it('reports seasons and the longest run of write-off weekends', () => {
    // Three consecutive weekends in June: usable, unusable, unusable.
    const run = hours('2025-06-07', 24 * 16, (h) => (h.day >= 14 ? {precip: 2} : {}));
    const afternoons = weekendAfternoons(run);
    const d = weekendDetail(afternoons, 1);
    expect(d.bySeason[2]).toEqual({season: 'Summer', usable: 2, total: 6});
    expect(d.longestUnusableStreak).toBe(2);
  });
});

describe('commute', () => {
  it('uses independently selected start and finish hours', () => {
    const day = hours('2025-06-02', 24, hour => ({
      precip: hour.hour === 7 || hour.hour === 21 ? 0.2 : 0,
    }));
    const custom = commuteStats(day, {...T.commute, am: [7, 8], pm: [16, 21]});
    expect(custom.am[5]).toEqual({wet: 0, total: 1});
    expect(custom.pm[5]).toEqual({wet: 1, total: 1});
  });

  it('matches hourly rain bands and keeps snowfall separate', () => {
    const day = hours('2025-06-02', 24, hour => ({
      rain: hour.hour === 8 || hour.hour === 9 ? 0.3 : hour.hour === 18 ? 0.5 : hour.hour === 19 ? 4 : 0,
      snowfall: hour.hour === 9 ? 0.7 : 0,
    }));
    for (const [weather, morning, evening] of [
      ['drizzle', 1, 0], ['shower', 0, 1], ['heavyRain', 0, 1], ['snow', 1, 0],
    ] as const) {
      const filtered = commuteStats(day, {...T.commute, weather});
      expect(filtered.am[5]).toEqual({wet: morning, total: 1});
      expect(filtered.pm[5]).toEqual({wet: evening, total: 1});
    }
  });

  it('marks a commute wet when any hour reaches 0.2 mm, weekdays only', () => {
    // 2025-06-02 is a Monday. Rain at 08:00 Monday, 18:00 Tuesday, 08:00 Saturday.
    const week = hours('2025-06-02', 24 * 7, (h) =>
      (h.day === 2 && h.hour === 8) || (h.day === 3 && h.hour === 18) || (h.day === 7 && h.hour === 8) ? {precip: 0.2} : {},
    );
    const s = commuteStats(week);
    expect(s.am[5]).toEqual({wet: 1, total: 5});
    expect(s.pm[5]).toEqual({wet: 1, total: 5});
    expect(commuteMonthly(s)[5]).toBeCloseTo(20);
    expect(commuteDetail(s).amWetShare[5]).toBeCloseTo(0.2);
  });
});

describe('wind-driven rain', () => {
  it('uses the same rain band and wind minimum for monthly counts and direction', () => {
    const day = hours('2025-01-01', 4, (_hour, i) => ({
      rain: [0.3, 0.5, 4, 0.3][i],
      wind: [34, 30, 32, 20][i],
      windDir: 270,
    }));
    const rules = {...T.windRain, minWind: 30, intensity: 'drizzle' as const};
    expect(windRainMonthly(day, 1, rules)[0]).toBe(1);
    expect(windRainMonthly(day, 1, {...rules, minWind: 20})[0]).toBe(2);
    expect(windRainMonthly(day, 1, {...rules, intensity: 'heavyRain'})[0]).toBe(1);
    const detail = windRainDetail(day, 1, rules);
    expect(detail.dominantDirection).toBe('W');
    expect(detail.rose.reduce((sum, value) => sum + value, 0)).toBe(1);
    expect(detail.meanSpeedByDirection?.[12]).toBe(34);
    expect(detail.meanSpeedByDirection?.[0]).toBeNull();
    expect(windRainDetail(day, 2, {...rules, minWind: 20}).meanSpeedByDirection?.[12]).toBe(27);
  });

  it('needs both rain and wind, bins by direction, counts severe gusts', () => {
    const day = hours('2025-01-01', 24, (h) =>
      h.hour < 3
        ? {precip: 1, wind: 30, windDir: 225, gust: h.hour === 0 ? 70 : 40}
        : h.hour === 3
          ? {precip: 1, wind: 10}
          : h.hour === 4
            ? {precip: 0.1, wind: 40}
            : {},
    );
    expect(windRainMonthly(day, 1)[0]).toBe(3);
    const d = windRainDetail(day, 1);
    expect(d.dominantDirection).toBe('SW');
    expect(d.rose[10]).toBe(3);
    expect(d.severeHoursPerYear).toBe(1);
  });
});

describe('compute', () => {
  it('spans years from first to last hour and returns every series', () => {
    const twoYears = hours('2024-01-01', 24 * 731);
    expect(spanYears(twoYears)).toBeCloseTo(2, 1);
    const c = compute(twoYears);
    expect(c.comfort).toHaveLength(12);
    expect(c.detail.comfort.heat).toHaveLength(12);
    expect(c.detail.comfort.heat[0]).toHaveLength(24);
  });
});
