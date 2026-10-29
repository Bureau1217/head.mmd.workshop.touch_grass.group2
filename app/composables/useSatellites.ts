import { ref, computed, type Ref } from 'vue';
import { Satellite, GroundStation, type Degrees, type Kilometers } from 'ootk';
import type { RawSatelliteData, SatellitePosition, NearestSatellite } from '~/types/satellite';

export const useSatellites = (
  userLat: Ref<number>,
  userLon: Ref<number>,
  deviceAzimuth?: Ref<number>
) => {
  const cachedSats = ref<RawSatelliteData[]>([]);
  const closestCommercial = ref<NearestSatellite | null>(null);
  const closestScientific = ref<NearestSatellite | null>(null);
  const visibleSatellites = ref<SatellitePosition[]>([]);
  const isInterfering = ref<boolean>(false);
  const isLoading = ref<boolean>(false);
  const lastCalculatedAt = ref<Date | null>(null);

  // Measure interference intensity from 0 (none) to 1 (maximum interference)
  const interferenceIntensity = computed<number>(() => {
    if (!closestCommercial.value) return 0;

    // Commercial satellites closer than 1500km cause noticeable interference
    // Closer distance (< 500km) = stronger interference
    const dist = closestCommercial.value.distance;
    const distanceFactor = Math.max(0, Math.min(1, (1500 - dist) / 1000));

    // Optional compass alignment: if phone points near the commercial satellite's azimuth
    if (deviceAzimuth && deviceAzimuth.value !== undefined) {
      const azDiff = Math.abs(deviceAzimuth.value - closestCommercial.value.azimuth);
      const angleDiff = Math.min(azDiff, 360 - azDiff);
      // If pointing within 45 degrees of satellite, interference boosts
      const alignmentBonus = angleDiff < 45 ? (45 - angleDiff) / 45 * 0.3 : 0;
      return Math.min(1, distanceFactor * 0.7 + alignmentBonus);
    }

    return distanceFactor;
  });

  // Fetch satellite TLE data from server
  const loadSatelliteCatalog = async (): Promise<void> => {
    try {
      isLoading.value = true;
      const data = await $fetch<RawSatelliteData[]>('/api/active-sats');
      if (Array.isArray(data)) {
        cachedSats.value = data;
      }
    } catch (err: unknown) {
      console.error('[useSatellites] Error fetching satellite catalog:', err);
    } finally {
      isLoading.value = false;
    }
  };

  // Propagate all satellite positions relative to user
  const updatePositions = () => {
    if (!userLat.value || !userLon.value || cachedSats.value.length === 0) {
      return;
    }

    const userLocation = new GroundStation({
      lat: userLat.value as Degrees,
      lon: userLon.value as Degrees,
      alt: 0.4 as Kilometers // Default ~400m
    });

    let nearestComm: NearestSatellite | null = null;
    let nearestSci: NearestSatellite | null = null;
    let minCommDist = Infinity;
    let minSciDist = Infinity;

    // Fallback if none are above horizon: closest satellite overall
    let backupSci: NearestSatellite | null = null;
    let backupSciDist = Infinity;

    const visibleList: SatellitePosition[] = [];

    for (const satData of cachedSats.value) {
      try {
        const sat = new Satellite({
          name: satData.name,
          tle1: satData.tle1,
          tle2: satData.tle2
        });

        const rae = userLocation.rae(sat);
        if (!rae) continue;

        const { rng, az, el } = rae;
        const roundedDist = Math.round(rng);
        const roundedAz = Math.round(az);
        const roundedEl = Math.round(el);

        // Keep track of backup closest scientific satellite even if below horizon
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

        // Above the horizon (el > 0)
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

          if (satData.type === 'commercial' && rng < minCommDist) {
            minCommDist = rng;
            nearestComm = {
              ...satPos,
              rawId: satData.id
            };
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
        // Ignore single propagation calculation failure
      }
    }

    // Sort visible satellites by elevation (highest in sky first)
    visibleList.sort((a, b) => b.elevation - a.elevation);

    visibleSatellites.value = visibleList;
    closestCommercial.value = nearestComm;
    // If no scientific satellite is currently above the horizon, use backup closest
    closestScientific.value = nearestSci || backupSci;
    isInterfering.value = !!nearestComm;
    lastCalculatedAt.value = new Date();
  };

  let trackingInterval: ReturnType<typeof setInterval> | null = null;
  let catalogRefreshInterval: ReturnType<typeof setInterval> | null = null;

  const startTracking = async () => {
    // 1. Initial catalog fetch
    await loadSatelliteCatalog();
    // 2. Initial position calculation
    updatePositions();

    // 3. Recalculate orbits every 3 seconds locally
    if (!trackingInterval) {
      trackingInterval = setInterval(updatePositions, 3000);
    }

    // 4. Refresh satellite catalog hourly
    if (!catalogRefreshInterval) {
      catalogRefreshInterval = setInterval(loadSatelliteCatalog, 60 * 60 * 1000);
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
  };

  return {
    cachedSats,
    closestCommercial,
    closestScientific,
    visibleSatellites,
    isInterfering,
    interferenceIntensity,
    isLoading,
    lastCalculatedAt,
    loadSatelliteCatalog,
    updatePositions,
    startTracking,
    stopTracking
  };
};
