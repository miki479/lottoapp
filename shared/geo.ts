// Plain geography helpers shared by the app, the Edge Functions and the loader script. No Node/Deno APIs.

const EARTH_M = 6_371_000;
const M_PER_DEG_LAT = 111_320;
const rad = (d: number) => (d * Math.PI) / 180;

/** Great-circle distance in metres. */
export function distanceM(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const h = Math.sin(rad(bLat - aLat) / 2) ** 2 + Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(rad(bLon - aLon) / 2) ** 2;
  return 2 * EARTH_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

export interface BBox { minLat: number; maxLat: number; minLon: number; maxLon: number }

/** The lat/lon rectangle that contains the circle of `radiusM` around a point: what an index lookup filters on before the exact distance. */
export function boundingBox(lat: number, lon: number, radiusM: number): BBox {
  const dLat = radiusM / M_PER_DEG_LAT;
  // a degree of longitude shrinks with the latitude; near the poles the box simply covers every longitude
  const cos = Math.cos(rad(Math.min(89.9, Math.abs(lat))));
  const dLon = radiusM / (M_PER_DEG_LAT * cos);
  return {
    minLat: Math.max(-90, lat - dLat), maxLat: Math.min(90, lat + dLat),
    minLon: dLon >= 180 ? -180 : Math.max(-180, lon - dLon), maxLon: dLon >= 180 ? 180 : Math.min(180, lon + dLon),
  };
}

export const inBox = (b: BBox, lat: number, lon: number) => lat >= b.minLat && lat <= b.maxLat && lon >= b.minLon && lon <= b.maxLon;

/** Coordinates rounded to `decimals` places (3 = a ~100 m grid): all the app ever tells the server about where the player is. */
export function roundCoord(v: number, decimals = 3): number {
  const f = 10 ** decimals;
  return Math.round(v * f) / f;
}

/** The worst distance rounding to 3 decimals can move a point (half a cell diagonal, with a little margin). */
export const ROUNDING_ERROR_M = 80;

/** A usable position: real numbers inside the globe, and not the (0, 0) a broken sensor reports. */
export const validPoint = (lat: unknown, lon: unknown): boolean =>
  typeof lat === "number" && typeof lon === "number" && Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180 && !(lat === 0 && lon === 0);
