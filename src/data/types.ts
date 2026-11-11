export type MetricKey = 'comfort' | 'weekends' | 'commute' | 'windRain';

export const METRIC_KEYS: MetricKey[] = ['comfort', 'weekends', 'commute', 'windRain'];

export const WEEKEND_METRIC_TITLE = 'Outdoor-friendly weekend afternoons';
export const COMMUTE_METRIC_TITLE = 'Wet commutes';
export const OUTDOOR_METRIC_TITLE = 'Comfortable Outdoor Hours';
export const WIND_RAIN_METRIC_TITLE = 'Wind-driven rain';
export const METRIC_DEFINITIONS: Partial<Record<MetricKey, string>> = {
  comfort: 'Mild, dry hours with light winds, 8 am to 8 pm.',
  weekends: 'At least four mild, dry hours with light winds, noon to 6 pm.',
  commute: 'Weekday commute windows with rain or snow, 7–9 am or 5–7 pm.',
  windRain: 'Hours with rain and winds of at least 20 km/h.',
};

/** One metric as shown on a stat card: a per-year headline plus a monthly profile. */
export interface MetricResult {
  key: MetricKey;
  title: string;
  definition?: string;
  /** Headline value for the property, averaged per year over the window. */
  value: number;
  /** Same computation for the baseline location. */
  baseline: number;
  /** Formatted headline, e.g. "1,240 h". */
  display: string;
  /** Short unit for charts, e.g. "h". */
  unit: string;
  /** Findings for the selected dates and filters. */
  insights: string[];
  /** Average value per calendar month (Jan..Dec), per year. */
  monthly: number[];
  /** Baseline monthly profile. */
  baselineMonthly: number[];
}

export interface CommuteDetail {
  /** Share of wet commutes per month, AM and PM separately (0..1). */
  amWetShare: number[];
  pmWetShare: number[];
}

export const SEASONS = ['Winter', 'Spring', 'Summer', 'Autumn'] as const;
export type Season = (typeof SEASONS)[number];
export const SEASON_MONTHS: Record<Season, readonly number[]> = {
  Winter: [0, 1, 11],
  Spring: [2, 3, 4],
  Summer: [5, 6, 7],
  Autumn: [8, 9, 10],
};

export type CommuteWindow = 'am' | 'pm';

export const RAIN_INTENSITIES = {
  drizzle: {label: 'Light Drizzle', result: 'with light drizzle', min: 0.1, max: 0.5, description: '0.1 to under 0.5 mm of rain in an hour'},
  shower: {label: 'Shower', result: 'with showers', min: 0.5, max: 4, description: '0.5 to under 4 mm of rain in an hour'},
  heavyRain: {label: 'Heavy Rain', result: 'with heavy rain', min: 4, max: Infinity, description: '4 mm of rain or more in an hour'},
} as const;

export type RainIntensity = keyof typeof RAIN_INTENSITIES;

export const COMMUTE_WEATHER = {
  ...RAIN_INTENSITIES,
  snow: {label: 'Snow', result: 'with snow', description: 'Any recorded snowfall in an hour'},
} as const;

export type CommuteWeather = keyof typeof COMMUTE_WEATHER;

export function formatCommuteRate(value: number, unit: string) {
  const digits = unit === '% wet' ? 0 : 1;
  const rate = value.toLocaleString('en-GB', {maximumFractionDigits: digits});
  return `${rate}${unit}`;
}

export interface WeekendDetail {
  /** Usable weekend afternoons per season per year. */
  bySeason: {season: Season; usable: number; total: number}[];
  longestUnusableStreak: number;
}

export interface WindRainDetail {
  /** Wind-driven rain hours per year by 16-point compass direction, clockwise from N. */
  rose: number[];
  /** Mean wind speed (km/h) for matching hours, or null when a direction had none. */
  meanSpeedByDirection?: (number | null)[];
  dominantDirection: string;
  severeHoursPerYear: number;
}

export interface ComfortDetail {
  /** heat[month][hour] = share of hours (0..1) that were comfortable. */
  heat: number[][];
  dailyHours?: OutdoorDayBands;
}

export const OUTDOOR_DAY_BANDS = ['0 hours', '1–2 hours', '3–4 hours', '5+ hours'] as const;

export interface OutdoorDayBands {
  home: number[];
  baseline: number[];
}

export interface WeatherInsights {
  propertyId: string;
  propertyLabel: string;
  baselineLabel: string;
  rangeStart: string;
  rangeEnd: string;
  source?: 'live' | 'sample';
  byYear?: WeatherInsights[];
  metrics: Record<MetricKey, MetricResult>;
  filters?: {
    weekends: Partial<Record<Season, MetricResult>>;
    commute: Record<CommuteWindow, MetricResult>;
  };
  detail: {
    comfort: ComfortDetail;
    weekends: WeekendDetail;
    commute: CommuteDetail;
    windRain: WindRainDetail;
  };
}

export interface WeatherSource {
  load(propertyId: string): Promise<WeatherInsights>;
}

export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const dateFormat = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
});

export const formatWeatherDate = (date: string) => dateFormat.format(new Date(date));
