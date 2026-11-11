import type {MetricResult, WeatherInsights, WeatherSource} from './types';
import {COMMUTE_METRIC_TITLE, WEEKEND_METRIC_TITLE, OUTDOOR_METRIC_TITLE, WIND_RAIN_METRIC_TITLE} from './types';
import {getProperty, BASELINE} from '../properties';

// Sample weather for previewing the UI.

const comfortMonthly = [18, 24, 55, 96, 148, 182, 206, 190, 138, 82, 32, 16];
const comfortBaseline = [16, 21, 49, 88, 136, 170, 192, 178, 126, 74, 28, 14];

const weekendsMonthly = [1.2, 1.4, 2.6, 4.1, 5.9, 6.8, 7.4, 7.0, 5.2, 3.3, 1.6, 1.0];
const weekendsBaseline = [1.1, 1.3, 2.4, 3.8, 5.5, 6.4, 7.0, 6.6, 4.8, 3.0, 1.5, 0.9];

const commuteMonthly = [38, 34, 31, 26, 22, 19, 17, 21, 25, 33, 37, 39];
const commuteBaseline = [40, 36, 33, 28, 24, 20, 18, 22, 27, 35, 39, 41];

const windRainMonthly = [31, 27, 22, 12, 8, 5, 4, 7, 11, 24, 29, 34];
const windRainBaseline = [26, 23, 19, 10, 7, 4, 4, 6, 9, 20, 25, 29];

const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);
const fmt = (n: number) => Math.round(n).toLocaleString('en-GB');

function metric(
  partial: Omit<MetricResult, 'value' | 'baseline' | 'display'> & {display?: (v: number) => string},
): MetricResult {
  const value = sum(partial.monthly);
  const baseline = sum(partial.baselineMonthly);
  const display = partial.display ?? ((v: number) => `${fmt(v)} ${partial.unit}`);
  return {...partial, value, baseline, display: display(value)};
}

export function buildDummyInsights(propertyId: string): WeatherInsights {
  const property = getProperty(propertyId);
  const comfort = metric({
    key: 'comfort',
    title: OUTDOOR_METRIC_TITLE,
    unit: 'h',
    insights: ['July had the most mild, dry hours with light winds.'],
    monthly: comfortMonthly,
    baselineMonthly: comfortBaseline,
    display: v => `${fmt(v)} hours a year`,
  });
  const weekends = metric({
    key: 'weekends',
    title: WEEKEND_METRIC_TITLE,
    unit: 'afternoons',
    insights: ['Summer: 21 of 26 weekend afternoons were outdoor-friendly on average.'],
    monthly: weekendsMonthly,
    baselineMonthly: weekendsBaseline,
    display: v => `${fmt(v)} of 104`,
  });
  const commute = metric({
    key: 'commute',
    title: COMMUTE_METRIC_TITLE,
    unit: '% wet',
    insights: ['Evening commutes were wetter than mornings.'],
    monthly: commuteMonthly,
    baselineMonthly: commuteBaseline,
    display: v => `${Math.round(v / 12)}% wet`,
  });
  // Commute is a share, so headline is the yearly mean, not the sum.
  commute.value = commute.value / 12;
  commute.baseline = commute.baseline / 12;
  commute.display = `${Math.round(commute.value)}% wet`;

  const windRain = metric({
    key: 'windRain',
    title: WIND_RAIN_METRIC_TITLE,
    unit: 'h',
    insights: ['Driving rain came most often from the south-west.'],
    monthly: windRainMonthly,
    baselineMonthly: windRainBaseline,
    display: v => `${fmt(v)} hours a year`,
  });

  // 12 x 24 comfort heat map: share of hours comfortable, peaking summer afternoons.
  const heat = comfortMonthly.map((m, mi) => {
    const seasonal = m / 206;
    return Array.from({length: 24}, (_, h) => {
      if (h < 7 || h > 21) return 0;
      const diurnal = Math.exp(-Math.pow((h - 15) / 4.2, 2));
      const v = seasonal * diurnal * (mi >= 4 && mi <= 8 ? 0.95 : 0.8);
      return Math.max(0, Math.min(1, v));
    });
  });

  const rose = [4, 3, 2, 2, 3, 4, 6, 9, 16, 28, 42, 38, 26, 14, 8, 5];

  return {
    propertyId: property.id,
    propertyLabel: property.label,
    baselineLabel: BASELINE.label,
    rangeStart: '2024-11-06',
    rangeEnd: '2026-11-06',
    source: 'sample',
    metrics: {comfort, weekends, commute, windRain},
    detail: {
      comfort: {heat},
      weekends: {
        bySeason: [
          {season: 'Winter', usable: 4, total: 26},
          {season: 'Spring', usable: 13, total: 26},
          {season: 'Summer', usable: 21, total: 26},
          {season: 'Autumn', usable: 10, total: 26},
        ],
        longestUnusableStreak: 7,
      },
      commute: {
        amWetShare: commuteMonthly.map(v => (v - 4) / 100),
        pmWetShare: commuteMonthly.map(v => (v + 4) / 100),
      },
      windRain: {rose, dominantDirection: 'SW', severeHoursPerYear: 38},
    },
  };
}

export const dummySource: WeatherSource = {
  async load(propertyId) {
    // Small delay so the loading state is visible in the demo.
    await new Promise(r => setTimeout(r, 600));
    return buildDummyInsights(propertyId);
  },
};
