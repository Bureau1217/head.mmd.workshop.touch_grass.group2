import type { RawSatelliteData, SatelliteType } from '~/types/satellite';

// In-memory cache for satellites
let cachedSatellites: RawSatelliteData[] | null = null;
let lastCacheTime = 0;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour cache in accordance with KeepTrack API guidelines

interface KeepTrackSatBrief {
  tle1?: string;
  tle2?: string;
  type?: number;
  name?: string;
  altName?: string;
  purpose?: string;
  vmag?: number;
  launchDate?: string;
  country?: string;
  rcs?: string;
  bus?: string;
  payload?: string;
  status?: string;
  source?: string;
}

const SCIENTIFIC_KEYWORDS = [
  'science',
  'earth observation',
  'meteorolog',
  'astronomy',
  'astrophysics',
  'geodesy',
  'research',
  'solar',
  'space weather',
  'physics',
  'climate',
  'planetary',
  'oceanography',
  'atmospheric',
  'remote sensing',
  'environment',
  'magnetosphere',
  'ionosphere'
];

const COMMERCIAL_CONSTELLATIONS = [
  'STARLINK',
  'ONEWEB',
  'IRIDIUM',
  'GLOBALSTAR',
  'PLANET',
  'SPIRE',
  'FLOCK',
  'SKYSAT',
  'KUIPER',
  'SES',
  'INTELSAT',
  'EUTELSAT',
  'INMARSAT',
  'O3B'
];

// Fallback satellites in case KeepTrack API is temporarily unavailable
const FALLBACK_SATELLITES: RawSatelliteData[] = [
  {
    id: 'STARLINK-38128',
    name: 'STARLINK-38128',
    altName: 'Starlink Broadband',
    type: 'commercial',
    purpose: 'Commercial Communication',
    country: 'US',
    tle1: '1 A0001U 26160A   26301.45047979  .00013273  00000+0  45341-3 0  9998',
    tle2: '2 A0001  70.0018  93.7384 0002667 289.0949  70.9937 15.30428578 17810'
  },
  {
    id: 'VANGUARD-1',
    name: 'Vanguard 1',
    altName: 'Vanguard I',
    type: 'scientific',
    purpose: 'Science',
    country: 'US',
    tle1: '1 00005U 58002B   26299.98820243  .00000352  00000+0  46212-3 0  9991',
    tle2: '2 00005  34.2449 267.5280 1838954  12.8229 351.3296 10.86084798457618'
  },
  {
    id: 'LEGION-4',
    name: 'LEGION 4',
    type: 'scientific',
    purpose: 'Earth observation',
    country: 'US',
    tle1: '1 60456U 24147A   26301.91666667  .00001234  00000-0  12345-4 0  9992',
    tle2: '2 60456  97.4567 123.4567 0012345 123.4567 234.5678 15.12345678 12345'
  }
];

export default defineEventHandler(async (event): Promise<RawSatelliteData[]> => {
  const now = Date.now();

  // Return cached data if fresh
  if (cachedSatellites && (now - lastCacheTime < CACHE_TTL_MS)) {
    return cachedSatellites;
  }

  const config = useRuntimeConfig(event);
  const apiKey = (config.public.apiKey as string) || process.env.API_KEY || '';

  if (!apiKey) {
    console.warn('[API:active-sats] No API_KEY configured. Using fallback data.');
    return cachedSatellites || FALLBACK_SATELLITES;
  }

  try {
    const upstreamRes = await fetch('https://api.keeptrack.space/v4/sats/brief', {
      headers: {
        'X-API-Key': apiKey,
        'Accept': 'application/json'
      }
    });

    if (!upstreamRes.ok) {
      console.error(`[API:active-sats] KeepTrack API error: ${upstreamRes.status} ${upstreamRes.statusText}`);
      return cachedSatellites || FALLBACK_SATELLITES;
    }

    const data = await upstreamRes.json() as KeepTrackSatBrief[];

    if (!Array.isArray(data) || data.length === 0) {
      console.warn('[API:active-sats] KeepTrack returned empty array');
      return cachedSatellites || FALLBACK_SATELLITES;
    }

    const scientificList: RawSatelliteData[] = [];
    const commercialList: RawSatelliteData[] = [];

    for (const sat of data) {
      if (!sat.tle1 || !sat.tle2 || !sat.name) continue;

      const purposeLower = (sat.purpose || '').toLowerCase();
      const nameUpper = sat.name.toUpperCase();

      // Check if scientific
      const isScientific = SCIENTIFIC_KEYWORDS.some((kw) => purposeLower.includes(kw));

      // Check if commercial
      const isCommercial = COMMERCIAL_CONSTELLATIONS.some((c) => nameUpper.includes(c)) ||
        purposeLower.includes('commercial') ||
        purposeLower.includes('broadcasting') ||
        (purposeLower.includes('communication') && !purposeLower.includes('military'));

      if (isScientific) {
        scientificList.push({
          id: sat.name,
          name: sat.name,
          altName: sat.altName,
          type: 'scientific',
          purpose: sat.purpose || 'Scientific Research',
          country: sat.country,
          launchDate: sat.launchDate,
          tle1: sat.tle1,
          tle2: sat.tle2
        });
      } else if (isCommercial) {
        commercialList.push({
          id: sat.name,
          name: sat.name,
          altName: sat.altName,
          type: 'commercial',
          purpose: sat.purpose || 'Commercial Communication',
          country: sat.country,
          launchDate: sat.launchDate,
          tle1: sat.tle1,
          tle2: sat.tle2
        });
      }
    }

    // Limit to balanced set: up to 600 scientific and up to 400 commercial
    // Ensures fast client-side SGP4 calculation and guaranteed satellites overhead
    const selectedScientific = scientificList.slice(0, 600);
    const selectedCommercial = commercialList.slice(0, 400);

    const merged = [...selectedScientific, ...selectedCommercial];

    cachedSatellites = merged;
    lastCacheTime = now;

    console.log(`[API:active-sats] Successfully cached ${merged.length} satellites (${selectedScientific.length} scientific, ${selectedCommercial.length} commercial)`);

    return merged;
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error('[API:active-sats] Fetch exception:', errorMsg);
    return cachedSatellites || FALLBACK_SATELLITES;
  }
});