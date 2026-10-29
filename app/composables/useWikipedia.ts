import { ref, computed, watch, type Ref } from 'vue';
import type { NearestSatellite, SatellitePosition } from '~/types/satellite';
import { crossWord, confidentialRedact, qualityLossImage, type AttackType, type AttackEvent } from '~/attackScript';

interface WikiSearchResponse {
  query?: {
    search?: Array<{
      title: string;
      snippet?: string;
    }>;
  };
}

const ATTACK_OPTIONS: AttackType[] = ['confidentialRedact', 'crossWord', 'qualityLossImage'];
const DOMAINE = 'fr.wikipedia.org';

// Helper to safely attack only text nodes in HTML without touching markup or tags
function attackHtmlText(html: string, attackFn: (text: string, force: number) => string, force: number): string {
  // Regex matches either HTML tags <...> or raw text between tags
  return html.replace(/(<[^>]+>)|([^<]+)/g, (match, tag, text) => {
    if (tag) {
      return tag;
    }
    // If the text has alphanumeric content, attack it
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

export const useWikipedia = (
  closestScientific: Ref<NearestSatellite | null>,
  newlyEnteredCommercialSats: Ref<SatellitePosition[]>
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
    attackLog.value = [];
    latestAttack.value = null;
    forceConfidential.value = 0;
    forceCrossWord.value = 0;
    forceImage.value = 0;
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
        // Commercial satellites already inside the zone do NOT attack because they did not just enter
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
      if (!enteredSats || enteredSats.length === 0 || !cleanHtml.value) {
        return;
      }

      // If page was previously healed, new enter events resume attacks
      if (isHealed.value) {
        isHealed.value = false;
        healedBySatName.value = null;
      }

      let nextHtml = attackedHtml.value || cleanHtml.value;

      for (const sat of enteredSats) {
        if (isTotallyBroken.value) {
          break;
        }

        // Randomly choose attack for this entering satellite
        const chosenAttack = ATTACK_OPTIONS[Math.floor(Math.random() * ATTACK_OPTIONS.length)];

        let currentForce = 1;

        if (chosenAttack === 'confidentialRedact') {
          forceConfidential.value++;
          currentForce = forceConfidential.value;
          nextHtml = attackHtmlText(nextHtml, confidentialRedact, forceConfidential.value);
        } else if (chosenAttack === 'crossWord') {
          forceCrossWord.value++;
          currentForce = forceCrossWord.value;
          nextHtml = attackHtmlText(nextHtml, crossWord, forceCrossWord.value);
        } else if (chosenAttack === 'qualityLossImage') {
          forceImage.value++;
          currentForce = forceImage.value;
          nextHtml = attackHtmlImages(nextHtml, forceImage.value);
          imageFilter.value = qualityLossImage('', forceImage.value);
        }

        const attackEvt: AttackEvent = {
          satelliteName: sat.name,
          attackType: chosenAttack,
          force: currentForce,
          timestamp: new Date()
        };

        attackLog.value.push(attackEvt);
        latestAttack.value = attackEvt;

        // If total attacks now reaches the critical breakdown threshold:
        if (attackLog.value.length >= criticalSatelliteLimit.value) {
          // Total breakdown: blackout all text and blur all images
          nextHtml = attackHtmlText(cleanHtml.value, (t) => {
            return t.split(' ').map((w) => `<mark class="app-wiki-article__censor">${'█'.repeat(Math.max(3, w.length))}</mark>`).join(' ');
          }, 5);
          nextHtml = attackHtmlImages(nextHtml, 5);
          imageFilter.value = 'blur(28px) contrast(20%) brightness(20%) grayscale(100%)';
          break;
        }
      }

      attackedHtml.value = nextHtml;
    },
    { deep: true }
  );

  return {
    currentTitle,
    urlCadre,
    urlOuvrir,
    cleanHtml,
    attackedHtml,
    imageFilter,
    attackLog,
    latestAttack,
    isTotallyBroken,
    criticalSatelliteLimit,
    isHealed,
    healedBySatName,
    isLoading,
    fetchError,
    fetchArticleForSatellite
  };
};
