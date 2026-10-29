import { ref, computed, watch, type Ref } from 'vue';
import type { NearestSatellite } from '~/types/satellite';
import type { WikipediaArticle } from '~/types/wikipedia';

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

export const useWikipedia = (
  closestScientific: Ref<NearestSatellite | null>,
  closestCommercial: Ref<NearestSatellite | null>,
  isInterfering: Ref<boolean>
) => {
  const currentArticle = ref<WikipediaArticle | null>(null);
  const isLoading = ref<boolean>(false);
  const fetchError = ref<string | null>(null);
  const lastFetchedKey = ref<string>('');

  // Fallback mappings for satellite purposes to Wikipedia topics
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

  const fetchArticleForSatellite = async (sat: NearestSatellite): Promise<void> => {
    const rawPurpose = sat.purpose || '';
    const cacheKey = `${sat.name}-${rawPurpose}`;

    if (cacheKey === lastFetchedKey.value && currentArticle.value) {
      return;
    }

    isLoading.value = true;
    fetchError.value = null;

    try {
      const purposeLower = rawPurpose.toLowerCase();
      let query = PURPOSE_MAP[purposeLower];

      if (!query) {
        for (const [key, mapping] of Object.entries(PURPOSE_MAP)) {
          if (purposeLower.includes(key)) {
            query = mapping;
            break;
          }
        }
      }

      if (!query) {
        query = rawPurpose ? `${rawPurpose} satellite` : sat.name;
      }

      // Search Wikipedia for best match
      const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&utf8=&format=json&origin=*`;
      const searchRes = await $fetch<WikiSearchResponse>(searchUrl);
      let targetTitle = searchRes.query?.search?.[0]?.title;

      if (!targetTitle) {
        targetTitle = 'Earth observation satellite';
      }

      // Fetch summary
      const summaryUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(targetTitle)}`;
      const summaryData = await $fetch<WikiSummaryResponse>(summaryUrl);

      currentArticle.value = {
        title: summaryData.title || targetTitle,
        displayTitle: summaryData.displaytitle || targetTitle,
        extract: summaryData.extract || `Article on ${targetTitle}. Satellite purpose: ${sat.purpose}.`,
        thumbnailUrl: summaryData.thumbnail?.source || null,
        pageUrl: summaryData.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${encodeURIComponent(targetTitle)}`,
        description: summaryData.description || sat.purpose
      };

      lastFetchedKey.value = cacheKey;
    } catch (err: unknown) {
      console.warn('[useWikipedia] Error fetching article:', err);
      fetchError.value = 'Could not load Wikipedia article.';
      currentArticle.value = {
        title: sat.purpose || sat.name,
        displayTitle: sat.purpose || sat.name,
        extract: `${sat.name} is a scientific satellite dedicated to ${sat.purpose || 'research'}. It is currently passing overhead at ${sat.distance} km.`,
        thumbnailUrl: null,
        pageUrl: `https://en.wikipedia.org/wiki/Special:Search?search=${encodeURIComponent(sat.purpose || sat.name)}`,
        description: sat.purpose
      };
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

  // Interference on text: words get redacted or distorted when commercial sat passes overhead
  const interferedExtract = computed<string>(() => {
    if (!currentArticle.value) return '';
    const original = currentArticle.value.extract;

    if (!isInterfering.value || !closestCommercial.value) {
      return original;
    }

    const commName = closestCommercial.value.name;
    const words = original.split(' ');

    return words
      .map((word, i) => {
        // Redact ~25% of words when commercial satellite interferes
        if (i > 0 && i % 4 === 0) {
          return '█'.repeat(Math.max(3, Math.min(8, word.length)));
        }
        if (i > 0 && i % 19 === 0) {
          return `[SIGNAL CORRUPTED BY ${commName}]`;
        }
        return word;
      })
      .join(' ');
  });

  return {
    currentArticle,
    interferedExtract,
    isLoading,
    fetchError,
    fetchArticleForSatellite
  };
};
