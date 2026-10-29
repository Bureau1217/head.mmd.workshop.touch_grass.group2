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

    <!-- Main Content Area -->
    <main class="app-main">
      <div class="app-main__container">
        <!-- Minimal Satellite Status Box -->
        <div class="app-main__status-box">
          <div class="app-main__status-line">
            <span class="app-main__status-label">Nearest Scientific:</span>
            <span v-if="closestScientific" class="app-main__status-val">
              {{ closestScientific.name }} ({{ closestScientific.purpose }}) — {{ closestScientific.distance }} km away
            </span>
            <span v-else class="app-main__status-val app-main__status-val--muted">
              None above horizon
            </span>
          </div>

          <div class="app-main__status-line">
            <span class="app-main__status-label">Commercial Overhead:</span>
            <span v-if="closestCommercial" class="app-main__status-val app-main__status-val--alert">
              ⚠️ {{ closestCommercial.name }} at {{ closestCommercial.distance }} km (azimuth {{ closestCommercial.azimuth }}°, elevation {{ closestCommercial.elevation }}°) — Interfere Active
            </span>
            <span v-else class="app-main__status-val app-main__status-val--muted">
              Sky is clear of commercial satellites.
            </span>
          </div>
        </div>

        <!-- Wikipedia Article on Satellite Purpose -->
        <AppWikiArticle
          :closest-scientific="closestScientific"
          :closest-commercial="closestCommercial"
          :article="currentArticle"
          :interfered-extract="interferedExtract"
          :is-interfering="isInterfering"
          :is-loading="isWikiLoading"
        />
      </div>
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

// 2. Satellite orbital propagation
const {
  closestCommercial,
  closestScientific,
  visibleSatellites,
  isInterfering,
  startTracking,
  stopTracking
} = useSatellites(userLat, userLon, deviceAzimuth);

// 3. Wikipedia article synced to nearest scientific satellite
const {
  currentArticle,
  interferedExtract,
  isLoading: isWikiLoading
} = useWikipedia(closestScientific, closestCommercial, isInterfering);

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
  min-height: 100vh;
  background-color: $color-bg;
  color: $color-text;
}

.app-main {
  padding: $spacing-lg $spacing-md;

  &__container {
    max-width: 820px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: $spacing-lg;
  }

  &__status-box {
    background: $color-surface;
    border: 1px solid $color-border;
    padding: $spacing-md;
    font-family: $font-mono;
    font-size: $font-size-xs;
    display: flex;
    flex-direction: column;
    gap: $spacing-xs;
  }

  &__status-line {
    display: flex;
    flex-wrap: wrap;
    gap: $spacing-xs;
  }

  &__status-label {
    color: $color-text-muted;
    font-weight: 700;
  }

  &__status-val {
    color: $color-text;

    &--alert {
      color: $color-commercial;
      font-weight: 600;
    }

    &--muted {
      color: $color-text-faint;
    }
  }
}
</style>
