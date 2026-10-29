<template>
  <div class="app-root">
    <NuxtRouteAnnouncer />

    <!-- Minimal Header -->
    <AppHeader
      :user-lat="userLat"
      :user-lon="userLon"
      :device-azimuth="deviceAzimuth"
      :visible-count="visibleSatellites.length"
    />

    <!-- Main Content: Full-page Wikipedia iframe layout with real orbital logic -->
    <main class="app-main">
      <AppWikiArticle
        :closest-scientific="closestScientific"
        :current-title="currentTitle"
        :url-cadre="urlCadre"
        :url-ouvrir="urlOuvrir"
        :clean-html="cleanHtml"
        :attacked-html="attackedHtml"
        :image-filter="imageFilter"
        :attack-log="attackLog"
        :latest-attack="latestAttack"
        :is-totally-broken="isTotallyBroken"
        :critical-satellite-limit="criticalSatelliteLimit"
        :is-healed="isHealed"
        :healed-by-sat-name="healedBySatName"
        :is-loading="isWikiLoading"
        @test-jump="handleTestJump"
      />
    </main>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue';

// 1. Device compass & GPS coordinates
const {
  userLat,
  userLon,
  deviceAzimuth
} = useLocation();

// 2. Satellite orbital propagation & attack zone tracking
const {
  closestCommercial,
  closestScientific,
  visibleSatellites,
  commercialSatsInZone,
  newlyEnteredCommercialSats,
  cachedSats,
  startTracking,
  stopTracking
} = useSatellites(userLat, userLon, deviceAzimuth);

// 3. Wikipedia article logic with iframe layout, text/image attacks & healing
const {
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
  isLoading: isWikiLoading,
  fetchArticleForSatellite
} = useWikipedia(closestScientific, newlyEnteredCommercialSats);

// "Tester un saut": picks another scientific satellite to test page change / healing!
const handleTestJump = () => {
  const sciSats = cachedSats.value.filter((s) => s.type === 'scientific');
  if (sciSats.length > 1) {
    const randomSat = sciSats[Math.floor(Math.random() * sciSats.length)];
    closestScientific.value = {
      name: randomSat.name,
      type: 'scientific',
      purpose: randomSat.purpose,
      country: randomSat.country,
      distance: Math.round(500 + Math.random() * 600),
      azimuth: Math.round(Math.random() * 360),
      elevation: Math.round(20 + Math.random() * 70)
    };
  }
};

onMounted(() => {
  startTracking();
});

onUnmounted(() => {
  stopTracking();
});
</script>

<style lang="scss" scoped>
@use "~/assets/variables" as *;

.app-root {
  display: flex;
  flex-direction: column;
  height: 100vh;
  width: 100vw;
  overflow: hidden;
  background-color: $color-bg;
  color: $color-text;
}

.app-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  height: calc(100vh - 54px);
  overflow: hidden;
}
</style>
