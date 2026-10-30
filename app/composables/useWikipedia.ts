import { ref, computed, watch, onMounted, onUnmounted, type Ref } from 'vue';
import type { NearestSatellite, SatellitePosition } from '~/types/satellite';
import { generateArticleMarkdown, downloadMarkdownFile } from '~/utils/htmlToMarkdown';
import {
  crossWord,
  confidentialRedact,
  qualityLossImage,
  raysImage,
  raysText,
  fallingLetters,
  type AttackType,
  type AttackEvent,
  type CommercialSatelliteDwell
} from '~/attackScript';

interface WikiSearchResponse {
  query?: {
    search?: Array<{
      title: string;
      snippet?: string;
    }>;
  };
}

const ATTACK_OPTIONS: AttackType[] = [
  'satellitePass'
];
const DOMAINE = 'fr.wikipedia.org';

// Helper to safely attack only text nodes in HTML without touching markup or tags
function attackHtmlText(html: string, attackFn: (text: string, force: number) => string, force: number): string {
  return html.replace(/(<[^>]+>)|([^<]+)/g, (match, tag, text) => {
    if (tag) {
      return tag;
    }
    if (/[a-zA-Z0-9\u00C0-\u017F]/.test(text)) {
      return attackFn(text, force);
    }
    return text;
  });
}

// Helper to apply qualityLossImage filter to all <img> elements in HTML
function attackHtmlImages(html: string, force: number): string {
  const filter = qualityLossImage('', force);
  return html.replace(/<img\b([^>]*)>/gi, (match, attrs) => {
    if (/style=["']/i.test(attrs)) {
      return `<img ${attrs.replace(/style=["']([^"']*)["']/i, `style="$1; filter: ${filter};"`)}>`;
    }
    return `<img style="filter: ${filter};" ${attrs}>`;
  });
}

/**
 * ============================================================================
 * PARAMÈTRE D'AUGMENTATION DE FORCE PAR DURÉE (FORCE DWELL INTERVAL)
 * ============================================================================
 * Définit l'intervalle en secondes pour que la force d'interférence monte de +1.
 * Réglé exactement sur 10 secondes :
 *
 *   0s à 9s   : Force 0 (Approche / Détection du satellite, aucun dégât)
 *   10s à 19s : Force 1 (+1)
 *   20s à 29s : Force 2 (+1)
 *   30s à 39s : Force 3 (+1)
 *   40s à 49s : Force 4 (+1)
 *   50s à 59s : Force 5 (+1)
 *   60s à 69s : Force 6 (+1)
 *   70s à 79s : Force 7 (+1)
 *   80s à 89s : Force 8 (+1)
 *   90s à 99s : Force 9 (+1)
 *   100s et + : Force 10 (Maximum / Rupture critique)
 */
export const FORCE_INCREASE_INTERVAL_SECONDS = 10;
export const MAX_FORCE_LEVEL = 10;

/**
 * Calculates current attack force based on dwell time, individual satellite initial delay, and interval.
 * Allows multiple satellites to attack at different times across a range of seconds rather than simultaneously.
 */
export function calculateDwellForce(
  dwellSeconds: number,
  initialDelaySeconds: number = FORCE_INCREASE_INTERVAL_SECONDS,
  intervalSeconds: number = FORCE_INCREASE_INTERVAL_SECONDS
): number {
  // Grace period before the first attack (0s to initialDelaySeconds - 1: Force 0 / Approche)
  if (dwellSeconds < initialDelaySeconds) return 0;
  // 1st attack triggers at initialDelaySeconds (Force 1)
  // Subsequent attacks escalate by +1 every intervalSeconds of presence
  const elapsedAfterInitial = dwellSeconds - initialDelaySeconds;
  return Math.min(MAX_FORCE_LEVEL, 1 + Math.floor(elapsedAfterInitial / Math.max(1, intervalSeconds)));
}

export const useWikipedia = (
  closestScientific: Ref<NearestSatellite | null>,
  commercialSatsInZone: Ref<SatellitePosition[]>,
  isSecondUsbConnected?: Ref<boolean>,
  userLat?: Ref<number>,
  userLon?: Ref<number>
) => {
  const currentTitle = ref<string>('Satellite_artificiel');
  const urlCadre = ref<string>(`https://${DOMAINE}/wiki/Satellite_artificiel`);
  const urlOuvrir = ref<string>(`https://${DOMAINE}/wiki/Satellite_artificiel`);

  const cleanHtml = ref<string>('');
  const attackedHtml = ref<string>('');
  const imageFilter = ref<string>('none');
  const isLoading = ref<boolean>(false);
  const fetchError = ref<string | null>(null);

  // Critical breakdown limit
  const criticalSatelliteLimit = ref<number>(5);

  // History of attacks executed on the current page (persists even when satellites leave)
  const attackLog = ref<AttackEvent[]>([]);
  const latestAttack = ref<AttackEvent | null>(null);

  // Track each commercial satellite's presence duration and attack level since the last Wikipedia change
  const activeDwells = ref<Record<string, CommercialSatelliteDwell>>({});

  const activeDwellsList = computed<CommercialSatelliteDwell[]>(() => {
    return Object.values(activeDwells.value).sort((a, b) => b.dwellSeconds - a.dwellSeconds);
  });

  // Individual attack force counters
  const forceConfidential = ref<number>(0);
  const forceCrossWord = ref<number>(0);
  const forceImage = ref<number>(0);
  const forceRays = ref<number>(0);
  const forceRaysText = ref<number>(0);
  const forceFallingLetters = ref<number>(0);

  // Healing tracking
  const isHealed = ref<boolean>(false);
  const healedBySatName = ref<string | null>(null);
  const previousSatName = ref<string>('');
  const previousArticleTitle = ref<string>('');

  // State preservation before Starlink override (for 2nd USB stick)
  const savedScientificPage = ref<{
    title: string;
    urlCadre: string;
    urlOuvrir: string;
    cleanHtml: string;
    attackedHtml: string;
  } | null>(null);
  const hasTriggeredSecondUsbDownload = ref<boolean>(false);

  // Progressive breakdown ratio from 0.0 (nominal) to 1.0 (rupture critique)
  const breakdownProgress = computed<number>(() => {
    const list = Object.values(activeDwells.value);
    if (list.length === 0) return 0;
    const activeList = list.filter((d) => d.inZone);
    const activeSum = activeList.reduce((acc, cur) => acc + cur.force, 0);
    const totalSum = list.reduce((acc, cur) => acc + cur.force, 0);
    const maxSingle = Math.max(0, ...list.map((d) => d.force));

    // Progress smoothly and progressively:
    // Requires sustained saturation (active sum of forces >= 18, total historical force >= 32, or max single >= 10)
    const ratioActive = activeSum / 18;
    const ratioTotal = totalSum / 32;
    const ratioSingle = maxSingle / 10;
    const p = Math.max(ratioActive, ratioTotal, ratioSingle);
    return Math.min(1, Math.max(0, p));
  });

  const isTotallyBroken = computed<boolean>(() => {
    return breakdownProgress.value >= 1;
  });

  // French mappings for satellite mission purposes
  const PURPOSE_MAP_FR: Record<string, string> = {
    'earth observation': 'Satellite d\'observation de la Terre',
    'meteorology': 'Satellite météorologique',
    'meteorological': 'Satellite météorologique',
    'science': 'Satellite scientifique',
    'astronomy': 'Télescope spatial',
    'astrophysics': 'Astrophysique',
    'geodesy': 'Géodésie',
    'navigation': 'Système de positionnement par satellites',
    'solar': 'Observatoire solaire',
    'space weather': 'Météorologie de l\'espace',
    'climate': 'Climatologie',
    'oceanography': 'Océanographie spatiale',
    'research': 'Recherche spatiale'
  };

  const resolveTargetQuery = (purpose: string, name: string): string => {
    const purposeLower = (purpose || '').toLowerCase();
    let query = PURPOSE_MAP_FR[purposeLower];

    if (!query) {
      for (const [key, mapping] of Object.entries(PURPOSE_MAP_FR)) {
        if (purposeLower.includes(key)) {
          query = mapping;
          break;
        }
      }
    }

    return query || (purpose ? `${purpose} satellite` : name);
  };

  const resetPageAttacks = () => {
    activeDwells.value = {};
    attackLog.value = [];
    latestAttack.value = null;
    forceConfidential.value = 0;
    forceCrossWord.value = 0;
    forceImage.value = 0;
    forceRays.value = 0;
    forceRaysText.value = 0;
    forceFallingLetters.value = 0;
    imageFilter.value = 'none';
    attackedHtml.value = cleanHtml.value;
  };

  const fetchArticleForSatellite = async (sat: NearestSatellite): Promise<void> => {
    isLoading.value = true;
    fetchError.value = null;

    try {
      const query = resolveTargetQuery(sat.purpose, sat.name);

      // 1. Search Wikipedia (FR)
      const searchUrl = `https://${DOMAINE}/w/api.php?format=json&origin=*&action=query&list=search&srnamespace=0&srlimit=10&srsearch=${encodeURIComponent(query)}`;
      const searchRes = await $fetch<WikiSearchResponse>(searchUrl);
      const targetTitle = searchRes.query?.search?.[0]?.title || 'Satellite artificiel';

      currentTitle.value = targetTitle;
      const wikiPath = `/wiki/${encodeURIComponent(targetTitle.replace(/ /g, '_'))}`;
      urlCadre.value = `https://${DOMAINE}${wikiPath}`;
      urlOuvrir.value = `https://${DOMAINE}${wikiPath}`;

      const satChanged = previousSatName.value && previousSatName.value !== sat.name;
      const pageStaysSame = previousArticleTitle.value && previousArticleTitle.value === targetTitle;

      if (satChanged && pageStaysSame) {
        // HEAL: nearest scientific satellite changed, but page stays the same!
        isHealed.value = true;
        healedBySatName.value = sat.name;
        resetPageAttacks();
      } else if (satChanged || !cleanHtml.value) {
        // Different scientific purpose / page: load new page fresh and clean
        isHealed.value = false;
        healedBySatName.value = null;

        // Fetch full HTML through our server route
        const html = await $fetch<string>(`/api/wiki-html?title=${encodeURIComponent(targetTitle)}&lang=fr`);
        cleanHtml.value = html;
        attackedHtml.value = html;

        resetPageAttacks();
      }

      previousSatName.value = sat.name;
      previousArticleTitle.value = targetTitle;
    } catch (err: unknown) {
      console.warn('[useWikipedia] Error fetching article:', err);
      fetchError.value = 'Impossible de charger l\'article Wikipédia.';
    } finally {
      isLoading.value = false;
    }
  };

  const downloadCurrentArticleMarkdown = () => {
    if (!cleanHtml.value) return;
    const md = generateArticleMarkdown({
      title: currentTitle.value,
      html: cleanHtml.value,
      satName: closestScientific.value?.name,
      satPurpose: closestScientific.value?.purpose,
      userLat: userLat?.value,
      userLon: userLon?.value,
      sourceUrl: urlOuvrir.value
    });
    const filename = `${currentTitle.value.replace(/[^a-zA-Z0-9_\u00C0-\u017F-]/g, '_')}_TouchGrass.md`;
    downloadMarkdownFile(filename, md);
  };

  // Watch for second USB stick plug-in: download MD and pause attacks
  if (isSecondUsbConnected) {
    watch(
      isSecondUsbConnected,
      (connected) => {
        if (connected) {
          // 1. Download MD of the current scientific Wikipedia page
          if (!hasTriggeredSecondUsbDownload.value && cleanHtml.value) {
            hasTriggeredSecondUsbDownload.value = true;
            downloadCurrentArticleMarkdown();
          }
          // Attacks are paused via tickDwellTimes and AppWikiArticle guards
        } else {
          // Second USB stick removed: reset download trigger and resume normal tracking/attacks
          hasTriggeredSecondUsbDownload.value = false;
        }
      }
    );
  }

  watch(
    () => closestScientific.value?.name,
    () => {
      // Only switch scientific satellite article if not paused by second USB stick
      if (closestScientific.value && !isSecondUsbConnected?.value) {
        fetchArticleForSatellite(closestScientific.value);
      }
    },
    { immediate: true }
  );

  // Periodic dwell timer: every 1 second, track duration of commercial satellites in zone
  // When on Starlink override (second USB stick connected), attacks are stopped and wait for USB removal
  let dwellTimer: ReturnType<typeof setInterval> | null = null;

  const tickDwellTimes = () => {
    if (!cleanHtml.value || isLoading.value || isTotallyBroken.value || isSecondUsbConnected?.value) {
      return;
    }

    const currentZoneNames = new Set(commercialSatsInZone.value.map((s) => s.name));

    // 1. Process commercial satellites currently inside the zone
    for (const sat of commercialSatsInZone.value) {
      let entry = activeDwells.value[sat.name];

      if (!entry) {
        // Compute staggered attack timing across a range of seconds so multiple satellites never attack simultaneously
        const satIndex = Object.keys(activeDwells.value).length;
        const nameHash = sat.name.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
        const jitter = nameHash % 3; // 0, 1, or 2 seconds
        // Range: 10s for the 1st satellite, 14s for the 2nd, 18s for the 3rd, etc. (range of 10 to 22+ seconds)
        const initialDelaySeconds = 10 + (satIndex * 4) + jitter;
        // Also de-synchronize recurring attack intervals (10 to 13 seconds)
        const intervalSeconds = 10 + ((nameHash + satIndex) % 4);

        // Satellite orbital interference pass affecting both text and images in its path
        entry = {
          name: sat.name,
          attackType: 'satellitePass',
          dwellSeconds: 1,
          force: 0,
          inZone: true,
          distanceKm: sat.distance,
          firstSeenAt: new Date(),
          initialDelaySeconds,
          intervalSeconds
        };
        activeDwells.value[sat.name] = entry;
      } else {
        entry.inZone = true;
        entry.distanceKm = sat.distance;
        entry.dwellSeconds += 1;
      }

      // Check if progressive dwell time unlocks higher attack force
      const calculatedForce = calculateDwellForce(
        entry.dwellSeconds,
        entry.initialDelaySeconds ?? FORCE_INCREASE_INTERVAL_SECONDS,
        entry.intervalSeconds ?? FORCE_INCREASE_INTERVAL_SECONDS
      );

      if (calculatedForce > entry.force) {
        entry.force = calculatedForce;

        if (isHealed.value) {
          isHealed.value = false;
          healedBySatName.value = null;
        }

        const evt: AttackEvent = {
          satelliteName: sat.name,
          attackType: entry.attackType,
          force: calculatedForce,
          timestamp: new Date()
        };

        const existingIdx = attackLog.value.findIndex((a) => a.satelliteName === sat.name);
        if (existingIdx >= 0) {
          attackLog.value[existingIdx] = evt;
        } else {
          attackLog.value.push(evt);
        }
        latestAttack.value = evt;

        if (entry.attackType === 'confidentialRedact') {
          forceConfidential.value = Math.max(forceConfidential.value, calculatedForce);
          attackedHtml.value = attackHtmlText(cleanHtml.value, confidentialRedact, forceConfidential.value);
        } else if (entry.attackType === 'crossWord') {
          forceCrossWord.value = Math.max(forceCrossWord.value, calculatedForce);
          attackedHtml.value = attackHtmlText(cleanHtml.value, crossWord, forceCrossWord.value);
        } else if (entry.attackType === 'qualityLossImage') {
          forceImage.value = Math.max(forceImage.value, calculatedForce);
          imageFilter.value = qualityLossImage('', forceImage.value);
          attackedHtml.value = attackHtmlImages(cleanHtml.value, forceImage.value);
        } else if (entry.attackType === 'raysImage') {
          forceRays.value = Math.max(forceRays.value, calculatedForce);
        } else if (entry.attackType === 'raysText') {
          forceRaysText.value = Math.max(forceRaysText.value, calculatedForce);
          attackedHtml.value = attackHtmlText(cleanHtml.value, raysText, forceRaysText.value);
        } else if (entry.attackType === 'fallingLetters') {
          forceFallingLetters.value = Math.max(forceFallingLetters.value, calculatedForce);
          attackedHtml.value = attackHtmlText(cleanHtml.value, fallingLetters, forceFallingLetters.value);
        }
      }
    }

    // 2. Mark satellites that have exited the zone (dwell stops incrementing, but attack remains!)
    for (const [satName, entry] of Object.entries(activeDwells.value)) {
      if (!currentZoneNames.has(satName)) {
        entry.inZone = false;
      }
    }
  };

  onMounted(() => {
    dwellTimer = setInterval(tickDwellTimes, 1000);
  });

  onUnmounted(() => {
    if (dwellTimer) {
      clearInterval(dwellTimer);
      dwellTimer = null;
    }
  });

  return {
    currentTitle,
    urlCadre,
    urlOuvrir,
    cleanHtml,
    attackedHtml,
    imageFilter,
    attackLog,
    latestAttack,
    activeDwells,
    activeDwellsList,
    breakdownProgress,
    isTotallyBroken,
    criticalSatelliteLimit,
    isHealed,
    healedBySatName,
    isLoading,
    fetchError,
    fetchArticleForSatellite,
    downloadCurrentArticleMarkdown
  };
};
