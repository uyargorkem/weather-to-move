import type {WeatherSource} from './types';
import {dummySource} from './dummy';
import {fixtureSource} from './fixtureSource';
import {openMeteoSource} from './openMeteoSource';

// Bundled fixtures by default so testing never spends API calls.
//   ?source=live   → fetch from Open-Meteo (cached in localStorage)
//   ?source=dummy  → placeholder numbers
const requested = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('source') : null;

export const weatherSource: WeatherSource =
  requested === 'live' ? openMeteoSource : requested === 'dummy' ? dummySource : fixtureSource;
