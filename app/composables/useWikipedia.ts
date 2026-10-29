import { ref, computed, watch, type Ref } from 'vue';
import type { NearestSatellite, SatellitePosition } from '~/types/satellite';
import type { WikipediaArticle } from '~/types/wikipedia';
import { crossWord, confidentialRedact, qualityLossImage, type AttackType, type AttackEvent } from '~/attackScript';

interface WikiSummaryResponse {
  title?: string;
  displaytitle?: string;
  extract?: string;
  thumbnail?: {
    source?: string;
  };
  content_urls?: {
    desktop?: {
      page?: string;
    };
  };
  description?: string;
}

interface WikiSearchResponse {
  query?: {
    search?: Array<{
      title: string;
      snippet?: string;
    }>;
  };
}

const ATTACK_OPTIONS: AttackType[] = ['confidentialRedact', 'crossWord', 'qualityLossImage'];

export const useWikipedia = (
  closestScientific: Ref<NearestSatellite | null>,
  newlyEnteredCommercialSats: Ref<SatellitePosition[]>
) => {
  const currentArticle = ref<WikipediaArticle | null>(null);
  const cleanExtract = ref<string>('');
  const interferedExtract = ref<string>('');
  const imageFilter = ref<string>('none');
  const isLoading = ref<boolean>(false);
  const fetchError = ref<string | null>(null);

  // Critical breakdown limit: number of cumulative attacks on this page that totally breaks it
  const criticalSatelliteLimit = ref<number>(5);

  // History of attacks executed on the current page (persists even when satellites leave)
  const attackLog = ref<AttackEvent[]>([]);

  // Individual attack force counters
  const forceConfidential = ref<number>(0);
  const forceCrossWord = ref<number>(0);
  const forceImage = ref<number>(0);

  // Healing tracking
  const isHealed = ref<boolean>(false);
  const healedBySatName = ref<string | null>(null);
  const previousSatName = ref<string>('');
  const previousArticleTitle = ref<string>('');

  const isTotallyBroken = computed<boolean>(() => {
    return attackLog.value.length >= criticalSatelliteLimit.value;
  });

  // Fallback mappings for satellite purposes
  const PURPOSE_MAP: Record<string, string> = {
    'earth observation': 'Earth observation satellite',
    'meteorology': 'Weather satellite',
    'meteorological': 'Weather satellite',
    'science': 'Scientific satellite',
    'astronomy': 'Space telescope',
    'astrophysics': 'Space telescope',
    'geodesy': 'Satellite geodesy',
    'navigation': 'Satellite navigation',
    'solar': 'Solar observation',
    'space weather': 'Space weather',
    'climate': 'Climate monitoring',
    'oceanography': 'Ocean surface topography'
  };

  const resolveTargetQuery = (purpose: string, name: string): string => {
    const purposeLower = (purpose || '').toLowerCase();
    let query = PURPOSE_MAP[purposeLower];

    if (!query) {
      for (const [key, mapping] of Object.entries(PURPOSE_MAP)) {
        if (purposeLower.includes(key)) {
          query = mapping;
          break;
        }
      }
    }

    return query || (purpose ? `${purpose} satellite` : name);
  };

  const resetPageAttacks = () => {
    attackLog.value = [];
    forceConfidential.value = 0;
    forceCrossWord.value = 0;
    forceImage.value = 0;
    imageFilter.value = 'none';
    interferedExtract.value = cleanExtract.value;
  };

  const fetchArticleForSatellite = async (sat: NearestSatellite): Promise<void> => {
    isLoading.value = true;
    fetchError.value = null;

    try {
      const query = resolveTargetQuery(sat.purpose, sat.name);

      const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&utf8=&format=json&origin=*`;
      const searchRes = await $fetch<WikiSearchResponse>(searchUrl);
      const targetTitle = searchRes.query?.search?.[0]?.title || 'Earth observation satellite';

      const satChanged = previousSatName.value && previousSatName.value !== sat.name;
      const pageStaysSame = previousArticleTitle.value && previousArticleTitle.value === targetTitle;

      if (satChanged && pageStaysSame) {
        // HEAL: nearest scientific satellite changed, but page stays the same!
        isHealed.value = true;
        healedBySatName.value = sat.name;
        resetPageAttacks();
      } else if (satChanged || !currentArticle.value) {
        // Different scientific purpose / page: start fresh and clean!
        // Commercial satellites already inside the zone do NOT attack because they did not just enter
        isHealed.value = false;
        healedBySatName.value = null;

        const summaryUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(targetTitle)}`;
        const summaryData = await $fetch<WikiSummaryResponse>(summaryUrl);

        const text = summaryData.extract || `Article on ${targetTitle}. Satellite purpose: ${sat.purpose}.`;
        cleanExtract.value = text;

        currentArticle.value = {
          title: summaryData.title || targetTitle,
          displayTitle: summaryData.displaytitle || targetTitle,
          extract: text,
          thumbnailUrl: summaryData.thumbnail?.source || null,
          pageUrl: summaryData.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${encodeURIComponent(targetTitle)}`,
          description: summaryData.description || sat.purpose
        };

        resetPageAttacks();
      }

      previousSatName.value = sat.name;
      previousArticleTitle.value = targetTitle;
    } catch (err: unknown) {
      console.warn('[useWikipedia] Error fetching article:', err);
      fetchError.value = 'Could not load Wikipedia article.';

      const fallbackText = `${sat.name} is a scientific spacecraft dedicated to ${sat.purpose || 'research'}.`;
      cleanExtract.value = fallbackText;
      currentArticle.value = {
        title: sat.purpose || sat.name,
        displayTitle: sat.purpose || sat.name,
        extract: fallbackText,
        thumbnailUrl: null,
        pageUrl: `https://en.wikipedia.org/wiki/Special:Search?search=${encodeURIComponent(sat.purpose || sat.name)}`,
        description: sat.purpose
      };
      resetPageAttacks();
      previousSatName.value = sat.name;
    } finally {
      isLoading.value = false;
    }
  };

  watch(
    () => closestScientific.value?.name,
    () => {
      if (closestScientific.value) {
        fetchArticleForSatellite(closestScientific.value);
      }
    },
    { immediate: true }
  );

  // Attack trigger: executes ONLY when a commercial satellite ENTERS the zone!
  // Once attacked, damage is NOT removed when the satellite leaves the zone.
  watch(
    () => newlyEnteredCommercialSats.value,
    (enteredSats) => {
      if (!enteredSats || enteredSats.length === 0 || !currentArticle.value) {
        return;
      }

      // If page was previously healed, new enter events resume attacks
      if (isHealed.value) {
        isHealed.value = false;
        healedBySatName.value = null;
      }

      for (const sat of enteredSats) {
        // If already totally broken, do not add further attacks
        if (isTotallyBroken.value) {
          break;
        }

        // Randomly choose which attack this newly entered satellite launches
        const chosenAttack = ATTACK_OPTIONS[Math.floor(Math.random() * ATTACK_OPTIONS.length)];

        attackLog.value.push({
          satelliteName: sat.name,
          attackType: chosenAttack,
          timestamp: new Date()
        });

        if (chosenAttack === 'confidentialRedact') {
          forceConfidential.value++;
          interferedExtract.value = confidentialRedact(interferedExtract.value, forceConfidential.value);
        } else if (chosenAttack === 'crossWord') {
          forceCrossWord.value++;
          interferedExtract.value = crossWord(interferedExtract.value, forceCrossWord.value);
        } else if (chosenAttack === 'qualityLossImage') {
          forceImage.value++;
          imageFilter.value = qualityLossImage(currentArticle.value?.thumbnailUrl || '', forceImage.value);
        }

        // If total attacks now reaches the critical breakdown threshold:
        if (attackLog.value.length >= criticalSatelliteLimit.value) {
          // Collapse page completely into full blackout and heavy blur
          interferedExtract.value = cleanExtract.value
            .split(' ')
            .map((w) => `<mark class="app-wiki-article__censor">${'█'.repeat(Math.max(3, w.length))}</mark>`)
            .join(' ');
          imageFilter.value = 'blur(28px) contrast(20%) brightness(20%) grayscale(100%)';
          break;
        }
      }
    },
    { deep: true }
  );

  return {
    currentArticle,
    interferedExtract,
    imageFilter,
    attackLog,
    isTotallyBroken,
    criticalSatelliteLimit,
    isHealed,
    healedBySatName,
    isLoading,
    fetchError,
    fetchArticleForSatellite
  };
};
