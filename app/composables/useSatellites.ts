import { ref, computed, type Ref } from 'vue';
import { Satellite, GroundStation, type Degrees, type Kilometers } from 'ootk';
import type {
  RawSatelliteData,
  SatelliteType,
  SatellitePosition,
  SatelliteMapPosition,
  NearestSatellite
} from '~/types/satellite';

interface KeepTrackSatBrief {
  tle1?: string;
  tle2?: string;
  name?: string;
  altName?: string;
  purpose?: string;
  launchDate?: string;
  country?: string;
  status?: string;
}

const SCIENTIFIC_KEYWORDS = [
  'aeronomy', 'air density', 'altimetry', 'asteroid', 'astrometry', 'science', 'scientific',
  'earth observation', 'astronomy', 'astrophysics', 'atmospheric science', 'atmospheric research',
  'meteorolog', 'geodesy', 'research', 'cosmology', 'comet', 'earth science', 'earth sciences',
  'ecology', 'environmental', 'solar', 'space weather', 'physics', 'fundamental physics', 'climate',
  'planetary', 'lunar', 'mars', 'mars orbiter', 'jupiter polar orbiter', 'oceanography',
  'ocean observation', 'ocean monitoring', 'atmospheric', 'remote sensing', 'environment',
  'earth obeservation', 'earth obseervation', 'magnetosphere', 'ionosphere', 'ionospheric',
  'ionospheic', 'life science', 'life sciences', 'gravity field mapping', 'radio astronomy',
  'cosmic rays', 'particle imaging', 'upper atmosphere', 'thermospheric', 'whale monitoring'
];

const COMMERCIAL_CONSTELLATIONS = [
  'STARLINK', 'ONEWEB', 'IRIDIUM', 'GLOBALSTAR', 'PLANET', 'SPIRE', 'FLOCK', 'SKYSAT', 'KUIPER',
  'SES', 'INTELSAT', 'EUTELSAT', 'INMARSAT', 'O3B'
];

const MAP_REFRESH_INTERVAL_MS = 30_000;

type TleLine1 = NonNullable<ConstructorParameters<typeof Satellite>[0]['tle1']>;
type TleLine2 = NonNullable<ConstructorParameters<typeof Satellite>[0]['tle2']>;

const isTleLine1 = (line: string): line is TleLine1 => line.startsWith('1 ');
const isTleLine2 = (line: string): line is TleLine2 => line.startsWith('2 ');

const classifySatellites = (data: KeepTrackSatBrief[]): {
  tracking: RawSatelliteData[];
  map: RawSatelliteData[];
} => {
  const scientific: RawSatelliteData[] = [];
  const commercial: RawSatelliteData[] = [];

  for (const sat of data) {
    if (!sat.tle1 || !sat.tle2 || !sat.name) continue;

    const purpose = sat.purpose || '';
    const purposeLower = purpose.toLowerCase();
    const nameUpper = sat.name.toUpperCase();
    const isScientific = SCIENTIFIC_KEYWORDS.some((keyword) => purposeLower.includes(keyword));
    const isCommercial = COMMERCIAL_CONSTELLATIONS.some((constellation) => nameUpper.includes(constellation)) ||
      purposeLower.includes('commercial') ||
      purposeLower.includes('broadcasting') ||
      (purposeLower.includes('communication') && !purposeLower.includes('military'));

    let type: SatelliteType | null = null;
    if (isScientific) {
      type = 'scientific';
    } else if (isCommercial) {
      type = 'commercial';
    }
    if (!type) continue;

    const satellite: RawSatelliteData = {
      id: sat.name,
      name: sat.name,
      altName: sat.altName,
      type,
      purpose: purpose || (type === 'scientific' ? 'Scientific Research' : 'Commercial Communication'),
      status: sat.status,
      country: sat.country,
      launchDate: sat.launchDate,
      tle1: sat.tle1,
      tle2: sat.tle2
    };

    if (type === 'scientific') scientific.push(satellite);
    else commercial.push(satellite);
  }

  return {
    tracking: [...scientific.slice(0, 600), ...commercial.slice(0, 400)],
    map: [...scientific, ...commercial]
  };
};

export const useSatellites = (
  userLat: Ref<number>,
  userLon: Ref<number>,
  deviceAzimuth?: Ref<number>
) => {
  const { public: { proxyUrl } } = useRuntimeConfig();
  const cachedSats = ref<RawSatelliteData[]>([]);
  const mapCatalogSats = ref<RawSatelliteData[]>([]);
  const closestCommercial = ref<NearestSatellite | null>(null);
  const closestScientific = ref<NearestSatellite | null>(null);
  const visibleSatellites = ref<SatellitePosition[]>([]);
  const satelliteMapPositions = ref<SatelliteMapPosition[]>([]);
  const isLoading = ref<boolean>(false);
  const lastCalculatedAt = ref<Date | null>(null);

  // Attack zone: focused overhead range around the user in kilometers
  const attackZoneRangeKm = ref<number>(800);

  // Commercial satellites currently inside the attack zone
  const commercialSatsInZone = ref<SatellitePosition[]>([]);

  // Commercial satellites that have just crossed into the zone during this tick
  const newlyEnteredCommercialSats = ref<SatellitePosition[]>([]);

  // Internal set of satellites known to be in the zone on the previous tick
  let knownSatsInZone = new Set<string>();
  let isFirstCalculation = true;

  // Fetch satellite TLE data from server
  const loadSatelliteCatalog = async (): Promise<void> => {
    try {
      isLoading.value = true;
      const normalizedProxyUrl = proxyUrl.replace(/\/+$/, '');
      if (!normalizedProxyUrl) {
        throw new Error('Set NUXT_PUBLIC_PROXY_URL or VITE_PROXY_URL to the Cloudflare Worker URL.');
      }

      const data = await $fetch<KeepTrackSatBrief[]>(`${normalizedProxyUrl}/sats/brief`);
      if (!Array.isArray(data)) {
        throw new TypeError('KeepTrack returned an invalid satellite catalog.');
      }
      const classified = classifySatellites(data);
      cachedSats.value = classified.tracking;
      mapCatalogSats.value = classified.map;
    } catch (err: unknown) {
      console.error('[useSatellites] Error fetching satellite catalog:', err);
    } finally {
      isLoading.value = false;
    }
  };

  // Propagate all satellite positions relative to user
  const updatePositions = () => {
    if (cachedSats.value.length === 0) {
      return;
    }

    const hasUserLocation = Number.isFinite(userLat.value) && Number.isFinite(userLon.value);
    const userLocation = hasUserLocation
      ? new GroundStation({
          lat: userLat.value as Degrees,
          lon: userLon.value as Degrees,
          alt: 0.4 as Kilometers
        })
      : null;

    let nearestComm: NearestSatellite | null = null;
    let nearestSci: NearestSatellite | null = null;
    let minCommDist = Infinity;
    let minSciDist = Infinity;

    // Backup scientific satellite in case none are above 0°
    let backupSci: NearestSatellite | null = null;
    let backupSciDist = Infinity;

    const visibleList: SatellitePosition[] = [];
    const inZoneList: SatellitePosition[] = [];

    for (const satData of cachedSats.value) {
      try {
        if (!isTleLine1(satData.tle1) || !isTleLine2(satData.tle2)) continue;
        const sat = new Satellite({
          name: satData.name,
          tle1: satData.tle1,
          tle2: satData.tle2
        });

        const rae = userLocation?.rae(sat) ?? null;
        if (!userLocation) continue;

        if (!rae) continue;

        const { rng, az, el } = rae;
        const roundedDist = Math.round(rng);
        const roundedAz = Math.round(az);
        const roundedEl = Math.round(el);

        // Keep backup scientific satellite in case none are above 0°
        if (satData.type === 'scientific' && rng < backupSciDist) {
          backupSciDist = rng;
          backupSci = {
            rawId: satData.id,
            name: satData.name,
            altName: satData.altName,
            type: 'scientific',
            purpose: satData.purpose,
            country: satData.country,
            distance: roundedDist,
            azimuth: roundedAz,
            elevation: roundedEl
          };
        }

        // Above the horizon (elevation > 0)
        if (el > 0) {
          const satPos: SatellitePosition = {
            name: satData.name,
            altName: satData.altName,
            type: satData.type,
            purpose: satData.purpose,
            country: satData.country,
            distance: roundedDist,
            azimuth: roundedAz,
            elevation: roundedEl
          };

          visibleList.push(satPos);

          if (satData.type === 'commercial') {
            // Overhead attack zone: within configured range and elevation >= 15°
            if (rng <= attackZoneRangeKm.value && roundedEl >= 15) {
              inZoneList.push(satPos);
            }

            if (rng < minCommDist) {
              minCommDist = rng;
              nearestComm = {
                ...satPos,
                rawId: satData.id
              };
            }
          }

          if (satData.type === 'scientific' && rng < minSciDist) {
            minSciDist = rng;
            nearestSci = {
              ...satPos,
              rawId: satData.id
            };
          }
        }
      } catch {
        // Ignore single calculation errors
      }
    }

    // Detect ENTER events: satellites in zone now that were not in zone before
    const enteredThisTick: SatellitePosition[] = [];

    if (isFirstCalculation) {
      // On first calculation, seed known zone satellites so initial page loads cleanly
      knownSatsInZone = new Set(inZoneList.map((s) => s.name));
      isFirstCalculation = false;
    } else {
      for (const sat of inZoneList) {
        if (!knownSatsInZone.has(sat.name)) {
          enteredThisTick.push(sat);
        }
      }
      // Update known satellites set
      knownSatsInZone = new Set(inZoneList.map((s) => s.name));
    }

    visibleList.sort((a, b) => b.elevation - a.elevation);
    // Focus on the closest overhead commercial satellites (capped to top 3) to prevent saturation
    inZoneList.sort((a, b) => a.distance - b.distance);
    const focusedZoneList = inZoneList.slice(0, 3);

    visibleSatellites.value = visibleList;
    commercialSatsInZone.value = focusedZoneList;
    newlyEnteredCommercialSats.value = enteredThisTick;
    closestCommercial.value = nearestComm;
    closestScientific.value = nearestSci || backupSci;
    lastCalculatedAt.value = new Date();
  };

  const updateMapPositions = () => {
    const hasUserLocation = Number.isFinite(userLat.value) && Number.isFinite(userLon.value);
    const userLocation = hasUserLocation
      ? new GroundStation({
          lat: userLat.value as Degrees,
          lon: userLon.value as Degrees,
          alt: 0.4 as Kilometers
        })
      : null;
    const mapPositions: SatelliteMapPosition[] = [];

    for (const satData of mapCatalogSats.value) {
      try {
        if (!isTleLine1(satData.tle1) || !isTleLine2(satData.tle2)) continue;
        const sat = new Satellite({
          name: satData.name,
          tle1: satData.tle1,
          tle2: satData.tle2
        });
        const lla = sat.lla();
        if (!lla || !Number.isFinite(lla.lat) || !Number.isFinite(lla.lon)) continue;

        const rae = userLocation?.rae(sat) ?? null;
        mapPositions.push({
          name: satData.name,
          type: satData.type,
          purpose: satData.purpose,
          status: satData.status ?? null,
          latitude: lla.lat,
          longitude: lla.lon,
          distance: rae ? Math.round(rae.rng) : null,
          elevation: rae ? Math.round(rae.el) : null
        });
      } catch {
        // Ignore invalid orbital records while keeping the rest of the map available.
      }
    }

    satelliteMapPositions.value = mapPositions;
  };

  let trackingInterval: ReturnType<typeof setInterval> | null = null;
  let catalogRefreshInterval: ReturnType<typeof setInterval> | null = null;
  let mapRefreshInterval: ReturnType<typeof setInterval> | null = null;

  const startTracking = async () => {
    await loadSatelliteCatalog();
    updatePositions();
    updateMapPositions();

    if (!trackingInterval) {
      trackingInterval = setInterval(updatePositions, 3000);
    }

    if (!catalogRefreshInterval) {
      catalogRefreshInterval = setInterval(loadSatelliteCatalog, 60 * 60 * 1000);
    }

    if (!mapRefreshInterval) {
      mapRefreshInterval = setInterval(updateMapPositions, MAP_REFRESH_INTERVAL_MS);
    }
  };

  const stopTracking = () => {
    if (trackingInterval) {
      clearInterval(trackingInterval);
      trackingInterval = null;
    }
    if (catalogRefreshInterval) {
      clearInterval(catalogRefreshInterval);
      catalogRefreshInterval = null;
    }
    if (mapRefreshInterval) {
      clearInterval(mapRefreshInterval);
      mapRefreshInterval = null;
    }
  };

  return {
    cachedSats,
    closestCommercial,
    closestScientific,
    visibleSatellites,
    satelliteMapPositions,
    commercialSatsInZone,
    newlyEnteredCommercialSats,
    attackZoneRangeKm,
    isLoading,
    lastCalculatedAt,
    loadSatelliteCatalog,
    updatePositions,
    startTracking,
    stopTracking
  };
};
