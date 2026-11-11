import type {WeatherSource} from './types';
import {getProperty} from '../properties';
import {FIXTURES} from './fixtures';

/** Pre-computed insights bundled with the app — no network, no API credits. */
export const fixtureSource: WeatherSource = {
  async load(propertyId) {
    const property = getProperty(propertyId);
    const fixture = FIXTURES[property.id];
    if (!fixture) {
      throw new Error(`No bundled data for property ${property.id}. Run \`npm run fetch\` then \`npm run compute\`.`);
    }
    // Brief delay so the loading state is visible in the demo.
    await new Promise(r => setTimeout(r, 400));
    return fixture;
  },
};
