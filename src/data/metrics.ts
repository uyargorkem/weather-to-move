import type {Hour} from './openMeteo';
import {COMMUTE_METRIC_TITLE, COMMUTE_WEATHER, RAIN_INTENSITIES, WEEKEND_METRIC_TITLE, OUTDOOR_METRIC_TITLE, OUTDOOR_DAY_BANDS, WIND_RAIN_METRIC_TITLE, SEASONS, SEASON_MONTHS, formatCommuteRate, type CommuteDetail, type CommuteWeather, type CommuteWindow, type ComfortDetail, type MetricResult, type OutdoorDayBands, type RainIntensity, type WeekendDetail, type WeatherInsights, type WindRainDetail} from './types';

// Default weather rules. The detailed report can override them.
export const T = {
  comfort: {startHour: 8, endHour: 20, minApparent: 14, maxApparent: 26, maxPrecip: 0.1, maxWind: 25},
  weekend: {startHour: 12, endHour: 18, minApparent: 12, minUsableHours: 4},
  commute: {am: [7, 9] as readonly [number, number], pm: [17, 19] as readonly [number, number], weather: null as CommuteWeather | null},
  windRain: {minPrecip: 0.5, minWind: 20, severeGust: 60, intensity: null as RainIntensity | null},
};
export type WeatherRules = typeof T;
export const DRIZZLE_LIMIT_MM = 0.5;

export function formatCommuteHour(value: number) {
  if (value === 0 || value === 24) return 'midnight';
  if (value === 12) return 'noon';
  return `${value % 12} ${value < 12 ? 'am' : 'pm'}`;
}

export function formatCommuteHours([start, end]: readonly [number, number]) {
  return `${formatCommuteHour(start)} to ${formatCommuteHour(end)}`;
}

export const COMPASS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];

const zeros = () => new Array<number>(12).fill(0);
const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);
const fmt = (n: number) => Math.round(n).toLocaleString('en-GB');

export function isComfortable(h: Hour, c = T.comfort): boolean {
  return h.apparent >= c.minApparent && h.apparent <= c.maxApparent && h.precip < c.maxPrecip && h.wind < c.maxWind;
}

/** Comfort with the temperature floor relaxed — "fine for sitting out with a jumper on". */
export function isRelaxedComfortable(h: Hour, weekend = T.weekend): boolean {
  return h.apparent >= weekend.minApparent && h.precip < T.comfort.maxPrecip && h.wind < T.comfort.maxWind;
}

export function isWindDrivenRain(h: Hour, windRain = T.windRain): boolean {
  return h.wind >= windRain.minWind && (windRain.intensity
    ? matchesRainIntensity(h, windRain.intensity)
    : h.precip >= windRain.minPrecip);
}

function matchesRainIntensity(hour: Hour, intensity: RainIntensity): boolean {
  const {min, max} = RAIN_INTENSITIES[intensity];
  const rain = hour.rain ?? 0;
  return rain >= min && rain < max;
}

/** Length of the window in years, from the first to the last hour. */
export function spanYears(hours: Hour[]): number {
  if (hours.length === 0) return 1;
  const first = hours[0];
  const last = hours[hours.length - 1];
  const ms = Date.UTC(last.year, last.month, last.day) - Date.UTC(first.year, first.month, first.day) + 86_400_000;
  return Math.max(ms / (365.25 * 86_400_000), 1 / 365.25);
}

// ---------------------------------------------------------------------------
// Comfortable Outdoor Hours

export function comfortMonthly(hours: Hour[], years: number, comfort = T.comfort): number[] {
  const m = zeros();
  for (const h of hours) {
    if (h.hour >= comfort.startHour && h.hour < comfort.endHour && isComfortable(h, comfort)) m[h.month]++;
  }
  return m.map(v => v / years);
}

export function comfortHeat(hours: Hour[], comfort = T.comfort): ComfortDetail {
  const ok = Array.from({length: 12}, () => new Array<number>(24).fill(0));
  const total = Array.from({length: 12}, () => new Array<number>(24).fill(0));
  for (const h of hours) {
    total[h.month][h.hour]++;
    if (isComfortable(h, comfort)) ok[h.month][h.hour]++;
  }
  return {heat: ok.map((row, m) => row.map((v, hr) => (total[m][hr] ? v / total[m][hr] : 0)))};
}

/** Compare days with complete outdoor-hour coverage in both locations. */
export function outdoorDayBands(homeHours: Hour[], baselineHours: Hour[], years: number, comfort = T.comfort): OutdoorDayBands {
  const hoursByDate = (hours: Hour[]) => {
    const days = new Map<string, {recorded: number; comfortable: number}>();
    for (const hour of hours) {
      if (hour.hour < comfort.startHour || hour.hour >= comfort.endHour) continue;
      const date = hour.time.slice(0, 10);
      const day = days.get(date) ?? {recorded: 0, comfortable: 0};
      day.recorded++;
      if (isComfortable(hour, comfort)) day.comfortable++;
      days.set(date, day);
    }
    return days;
  };
  const band = (hours: number) => hours === 0 ? 0 : Math.min(3, Math.ceil(hours / 2));
  const home = OUTDOOR_DAY_BANDS.map(() => 0);
  const baseline = OUTDOOR_DAY_BANDS.map(() => 0);
  const baselineDays = hoursByDate(baselineHours);
  const expected = comfort.endHour - comfort.startHour;
  for (const [date, homeDay] of hoursByDate(homeHours)) {
    const baselineDay = baselineDays.get(date);
    if (homeDay.recorded !== expected || baselineDay?.recorded !== expected) continue;
    home[band(homeDay.comfortable)]++;
    baseline[band(baselineDay.comfortable)]++;
  }
  return {home: home.map(days => days / years), baseline: baseline.map(days => days / years)};
}

// ---------------------------------------------------------------------------
// Outdoor-friendly weekend afternoons

interface Afternoon {
  year: number;
  month: number;
  day: number;
  dow: number;
  usable: boolean;
}

export function weekendAfternoons(hours: Hour[], weekend = T.weekend): Afternoon[] {
  const byDay = new Map<string, {h: Hour; ok: number}>();
  for (const h of hours) {
    if (h.dow !== 0 && h.dow !== 6) continue;
    if (h.hour < weekend.startHour || h.hour >= weekend.endHour) continue;
    const key = `${h.year}-${h.month}-${h.day}`;
    const entry = byDay.get(key) ?? {h, ok: 0};
    if (isRelaxedComfortable(h, weekend)) entry.ok++;
    byDay.set(key, entry);
  }
  return [...byDay.values()].map(({h, ok}) => ({
    year: h.year,
    month: h.month,
    day: h.day,
    dow: h.dow,
    usable: ok >= weekend.minUsableHours,
  }));
}

export function weekendsMonthly(afternoons: Afternoon[], years: number): number[] {
  const m = zeros();
  for (const a of afternoons) if (a.usable) m[a.month]++;
  return m.map(v => v / years);
}

const seasonOf = (month: number) => SEASONS.findIndex(season => SEASON_MONTHS[season].includes(month));

export function weekendDetail(afternoons: Afternoon[], years: number): WeekendDetail {
  const usable = [0, 0, 0, 0];
  const total = [0, 0, 0, 0];
  for (const a of afternoons) {
    const s = seasonOf(a.month);
    total[s]++;
    if (a.usable) usable[s]++;
  }
  // Longest run of whole weekends (Sat + Sun) with no usable afternoon.
  const byWeekend = new Map<string, boolean>();
  for (const a of afternoons) {
    // Key a weekend by its Saturday.
    const sat = new Date(Date.UTC(a.year, a.month, a.day - (a.dow === 0 ? 1 : 0)));
    const key = sat.toISOString().slice(0, 10);
    byWeekend.set(key, (byWeekend.get(key) ?? false) || a.usable);
  }
  let streak = 0;
  let longest = 0;
  for (const key of [...byWeekend.keys()].sort()) {
    streak = byWeekend.get(key) ? 0 : streak + 1;
    longest = Math.max(longest, streak);
  }
  return {
    bySeason: SEASONS.map((season, i) => ({
      season,
      usable: Math.round(usable[i] / years),
      total: Math.round(total[i] / years),
    })),
    longestUnusableStreak: longest,
  };
}

// ---------------------------------------------------------------------------
// Wet commutes

interface CommuteStats {
  /** [month] → {wet, total} for AM and PM commutes. */
  am: {wet: number; total: number}[];
  pm: {wet: number; total: number}[];
}

function matchesCommuteWeather(hour: Hour, weather: CommuteWeather | null): boolean {
  if (weather === null) return hour.precip >= 0.2;
  if (weather === 'snow') return (hour.snowfall ?? 0) > 0;
  return matchesRainIntensity(hour, weather);
}

export function commuteStats(hours: Hour[], commute = T.commute): CommuteStats {
  const am = Array.from({length: 12}, () => ({wet: 0, total: 0}));
  const pm = Array.from({length: 12}, () => ({wet: 0, total: 0}));
  const seen = new Map<string, {month: number; am: boolean; pm: boolean; amWet: boolean; pmWet: boolean}>();
  for (const h of hours) {
    if (h.dow === 0 || h.dow === 6) continue;
    // Open-Meteo labels precipitation by the end of the preceding hour.
    const inAm = h.hour > commute.am[0] && h.hour <= commute.am[1];
    const inPm = h.hour > commute.pm[0] && h.hour <= commute.pm[1];
    if (!inAm && !inPm) continue;
    const key = `${h.year}-${h.month}-${h.day}`;
    const d = seen.get(key) ?? {month: h.month, am: false, pm: false, amWet: false, pmWet: false};
    const wet = matchesCommuteWeather(h, commute.weather);
    if (inAm) {
      d.am = true;
      d.amWet ||= wet;
    } else {
      d.pm = true;
      d.pmWet ||= wet;
    }
    seen.set(key, d);
  }
  for (const d of seen.values()) {
    if (d.am) {
      am[d.month].total++;
      if (d.amWet) am[d.month].wet++;
    }
    if (d.pm) {
      pm[d.month].total++;
      if (d.pmWet) pm[d.month].wet++;
    }
  }
  return {am, pm};
}

const share = (wet: number, total: number) => (total ? wet / total : 0);

/** Percent of commutes (AM + PM pooled) that were wet, per month. */
export function commuteMonthly(s: CommuteStats): number[] {
  return s.am.map((a, i) => share(a.wet + s.pm[i].wet, a.total + s.pm[i].total) * 100);
}

export function commuteDetail(s: CommuteStats): CommuteDetail {
  return {
    amWetShare: s.am.map(a => share(a.wet, a.total)),
    pmWetShare: s.pm.map(p => share(p.wet, p.total)),
  };
}

// ---------------------------------------------------------------------------
// Wind-driven rain

export function windRainMonthly(hours: Hour[], years: number, windRain = T.windRain): number[] {
  const m = zeros();
  for (const h of hours) if (isWindDrivenRain(h, windRain)) m[h.month]++;
  return m.map(v => v / years);
}

export function windRainDetail(hours: Hour[], years: number, windRain = T.windRain): WindRainDetail {
  const rose = new Array<number>(16).fill(0);
  const speedTotals = new Array<number>(16).fill(0);
  let severe = 0;
  for (const h of hours) {
    if (!isWindDrivenRain(h, windRain)) continue;
    const direction = Math.round(h.windDir / 22.5) % 16;
    rose[direction]++;
    speedTotals[direction] += h.wind;
    if (h.gust >= windRain.severeGust) severe++;
  }
  const dominant = rose.indexOf(Math.max(...rose));
  return {
    rose: rose.map(v => Math.round(v / years)),
    meanSpeedByDirection: rose.map((count, i) => count ? speedTotals[i] / count : null),
    dominantDirection: COMPASS[dominant],
    severeHoursPerYear: Math.round(severe / years),
  };
}

// ---------------------------------------------------------------------------
// Assembly

export interface Computed {
  years: number;
  comfort: number[];
  weekends: number[];
  commute: number[];
  commuteRates: {am: number; pm: number; combined: number};
  weekendTotal: number;
  windRain: number[];
  detail: {comfort: ComfortDetail; weekends: WeekendDetail; commute: CommuteDetail; windRain: WindRainDetail};
}

export function compute(hours: Hour[], annualise = true, rules: WeatherRules = T): Computed {
  const years = annualise ? spanYears(hours) : 1;
  const afternoons = weekendAfternoons(hours, rules.weekend);
  const cs = commuteStats(hours, rules.commute);
  const totals = [cs.am, cs.pm].map(months => ({
    wet: sum(months.map(month => month.wet)),
    total: sum(months.map(month => month.total)),
  }));
  return {
    years,
    comfort: comfortMonthly(hours, years, rules.comfort),
    weekends: weekendsMonthly(afternoons, years),
    commute: commuteMonthly(cs),
    commuteRates: {
      am: share(totals[0].wet, totals[0].total),
      pm: share(totals[1].wet, totals[1].total),
      combined: share(totals[0].wet + totals[1].wet, totals[0].total + totals[1].total),
    },
    weekendTotal: afternoons.length / years,
    windRain: windRainMonthly(hours, years, rules.windRain),
    detail: {
      comfort: comfortHeat(hours, rules.comfort),
      weekends: weekendDetail(afternoons, years),
      commute: commuteDetail(cs),
      windRain: windRainDetail(hours, years, rules.windRain),
    },
  };
}

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function peakMonth(monthly: number[], months: readonly number[] = MONTH_NAMES.map((_, i) => i)): string | undefined {
  const max = Math.max(0, ...months.map(month => monthly[month]));
  const peaks = months.filter(month => monthly[month] === max);
  return max > 0 && peaks.length === 1 ? MONTH_NAMES[peaks[0]] : undefined;
}

/** Turns the raw monthly series for property and baseline into the four MetricResults. */
export function toMetrics(p: Computed, b: Computed, annualised = true, commute = T.commute): Record<MetricResult['key'], MetricResult> {
  const comfortH = sum(p.comfort);
  const weekendsN = sum(p.weekends);
  const commutePct = p.commuteRates.combined * 100;
  const windRainH = sum(p.windRain);
  const {am, pm} = p.commuteRates;
  const condition = commute.weather ? COMMUTE_WEATHER[commute.weather].result : 'wet';
  const unit = `% ${condition}`;
  const morningRate = formatCommuteRate(am * 100, unit);
  const eveningRate = formatCommuteRate(pm * 100, unit);
  const outdoorPeak = peakMonth(p.comfort);
  const bestSeason = p.detail.weekends.bySeason.filter(season => season.usable > 0)
    .sort((a, b) => b.usable / b.total - a.usable / a.total)[0];

  return {
    comfort: {
      key: 'comfort',
      title: OUTDOOR_METRIC_TITLE,
      value: comfortH,
      baseline: sum(b.comfort),
      display: `${fmt(comfortH)} hours${annualised ? ' a year' : ''}`,
      unit: 'h',
      insights: outdoorPeak ? [`${outdoorPeak} had the most hours of good outdoor weather.`] : [],
      monthly: p.comfort,
      baselineMonthly: b.comfort,
    },
    weekends: {
      key: 'weekends',
      title: WEEKEND_METRIC_TITLE,
      value: weekendsN,
      baseline: sum(b.weekends),
      display: `${fmt(weekendsN)} of ${fmt(p.weekendTotal)}`,
      unit: 'afternoons',
      insights: bestSeason
        ? [annualised
          ? `${bestSeason.season} had the highest share of outdoor-friendly afternoons.`
          : `${bestSeason.season} was best for spending time outdoors. ${bestSeason.usable} of ${bestSeason.total} weekend afternoons were suitable.`]
        : ['No weekend afternoons met all three conditions.'],
      monthly: p.weekends,
      baselineMonthly: b.weekends,
    },
    commute: {
      key: 'commute',
      title: COMMUTE_METRIC_TITLE,
      value: commutePct,
      baseline: b.commuteRates.combined * 100,
      display: formatCommuteRate(commutePct, unit),
      unit,
      insights: morningRate === eveningRate
        ? ['Morning and evening commutes had similar rates.']
        : [`Morning commutes: ${morningRate}. Evening commutes: ${eveningRate}.`],
      monthly: p.commute,
      baselineMonthly: b.commute,
    },
    windRain: {
      key: 'windRain',
      title: WIND_RAIN_METRIC_TITLE,
      value: windRainH,
      baseline: sum(b.windRain),
      display: `${fmt(windRainH)} hours${annualised ? ' a year' : ''}`,
      unit: 'h',
      insights: windRainH
        ? [`Driving rain came most often from the ${compassName(p.detail.windRain.dominantDirection)}.`,
          'At a viewing, look at how sheltered the garden and entrances are.']
        : ['No wind-driven rain in this period.'],
      monthly: p.windRain,
      baselineMonthly: b.windRain,
    },
  };
}

/** Derive narrower comparisons using the same period and units as the headline metrics. */
export function toFilteredMetrics(p: Computed, b: Computed, metrics: WeatherInsights['metrics'], commute = T.commute): NonNullable<WeatherInsights['filters']> {
  const weekends: NonNullable<WeatherInsights['filters']>['weekends'] = {};
  for (const [i, {season, total}] of p.detail.weekends.bySeason.entries()) {
    if (!total || !b.detail.weekends.bySeason[i].total) continue;
    const months = SEASON_MONTHS[season];
    const value = sum(months.map(month => p.weekends[month]));
    const peak = peakMonth(p.weekends, months);
    weekends[season] = {
      ...metrics.weekends,
      title: `${WEEKEND_METRIC_TITLE} (${season})`,
      value,
      baseline: sum(months.map(month => b.weekends[month])),
      display: `${fmt(value)} of ${fmt(total)}`,
      insights: peak ? [`${peak} had the most outdoor-friendly afternoons this season.`]
        : value === 0 ? ['No outdoor-friendly afternoons this season.'] : [],
    };
  }

  const commuteMetric = (window: CommuteWindow, label: string): MetricResult => {
    const shareKey = window === 'am' ? 'amWetShare' : 'pmWetShare';
    const value = p.commuteRates[window] * 100;
    const peak = peakMonth(p.detail.commute[shareKey]);
    return {
      ...metrics.commute,
      title: `${COMMUTE_METRIC_TITLE} (${label})`,
      value,
      baseline: b.commuteRates[window] * 100,
      display: formatCommuteRate(value, metrics.commute.unit),
      insights: [`Weekdays, ${formatCommuteHours(commute[window])}.`,
        ...(peak ? [`${peak} had the highest share of ${label.toLowerCase()} commutes ${commute.weather ? COMMUTE_WEATHER[commute.weather].result : 'with wet weather'}.`] : [])],
      monthly: p.detail.commute[shareKey].map(rate => rate * 100),
      baselineMonthly: b.detail.commute[shareKey].map(rate => rate * 100),
    };
  };
  return {
    weekends,
    commute: {
      am: commuteMetric('am', 'Morning'),
      pm: commuteMetric('pm', 'Evening'),
    },
  };
}

function compassName(abbr: string): string {
  const names: Record<string, string> = {N: 'north', E: 'east', S: 'south', W: 'west'};
  if (abbr.length === 1) return names[abbr];
  if (abbr.length === 2) return `${names[abbr[0]]}-${names[abbr[1]]}`;
  // "SSW" → "south-south-west"
  return abbr
    .split('')
    .map(c => names[c])
    .join('-');
}
