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
  const isLoading = ref<boolean>(false);
  const lastCalculatedAt = ref<Date | null>(null);

  // Attack zone: distance range around the user in kilometers
  const attackZoneRangeKm = ref<number>(1200);

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
      alt: 0.4 as Kilometers
    });

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
            if (rng <= attackZoneRangeKm.value) {
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

    visibleSatellites.value = visibleList;
    commercialSatsInZone.value = inZoneList;
    newlyEnteredCommercialSats.value = enteredThisTick;
    closestCommercial.value = nearestComm;
    closestScientific.value = nearestSci || backupSci;
    lastCalculatedAt.value = new Date();
  };

  let trackingInterval: ReturnType<typeof setInterval> | null = null;
  let catalogRefreshInterval: ReturnType<typeof setInterval> | null = null;

  const startTracking = async () => {
    await loadSatelliteCatalog();
    updatePositions();

    if (!trackingInterval) {
      trackingInterval = setInterval(updatePositions, 3000);
    }

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
