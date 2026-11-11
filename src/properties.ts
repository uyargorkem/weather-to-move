import locations from '../data/locations.json';

export interface Property {
  id: string;
  label: string;
  lat: number;
  lon: number;
}

// The saved Rightmove pages carry no coordinates (only the outward postcode),
// so demo properties are looked up by Rightmove property ID in data/locations.json.
export const PROPERTIES: Record<string, Property> = Object.fromEntries(locations.properties.map(p => [p.id, p]));

export const BASELINE: Property = locations.baseline;

export const DEFAULT_PROPERTY_ID = locations.properties[0].id;

export function getProperty(id: string | null | undefined): Property {
  return PROPERTIES[id ?? ''] ?? PROPERTIES[DEFAULT_PROPERTY_ID];
}

/** Reads the property ID from a Rightmove URL or the SingleFile header comment. */
export function detectPropertyId(): string {
  const fromUrl = location.pathname.match(/properties\/(\d+)/)?.[1];
  if (fromUrl) return fromUrl;
  const fromParam = new URLSearchParams(location.search).get('property');
  if (fromParam) return fromParam;
  const fromComment = document.documentElement.innerHTML
    .slice(0, 2000)
    .match(/rightmove\.co\.uk\/properties\/(\d+)/)?.[1];
  return fromComment ?? DEFAULT_PROPERTY_ID;
}
