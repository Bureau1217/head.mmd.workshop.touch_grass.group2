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
            <span class="app-main__status-label">Attack Zone ({{ attackZoneRangeKm }} km):</span>
            <span v-if="isTotallyBroken" class="app-main__status-val app-main__status-val--broken">
              🚨 {{ attackLog.length }}/{{ criticalSatelliteLimit }} Attacks — CRITICAL BREAKDOWN: Transmission Collapsed
            </span>
            <span v-else-if="attackLog.length > 0" class="app-main__status-val app-main__status-val--alert">
              ⚠️ {{ attackLog.length }} attacks recorded — In zone right now: {{ commercialSatsInZone.length }} (Damage persists until healed)
            </span>
            <span v-else-if="commercialSatsInZone.length > 0" class="app-main__status-val app-main__status-val--muted">
              {{ commercialSatsInZone.length }} commercial in zone (no enter events on this page yet)
            </span>
            <span v-else class="app-main__status-val app-main__status-val--muted">
              Zone clear. No attacks recorded.
            </span>
          </div>
        </div>

        <!-- Wikipedia Article on Satellite Purpose with Persistent Attacks & Healing -->
        <AppWikiArticle
          :closest-scientific="closestScientific"
          :article="currentArticle"
          :interfered-extract="interferedExtract"
          :image-filter="imageFilter"
          :attack-log="attackLog"
          :is-totally-broken="isTotallyBroken"
          :critical-satellite-limit="criticalSatelliteLimit"
          :attack-zone-range-km="attackZoneRangeKm"
          :is-healed="isHealed"
          :healed-by-sat-name="healedBySatName"
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

// 2. Satellite orbital propagation & attack zone tracking
const {
  closestCommercial,
  closestScientific,
  visibleSatellites,
  commercialSatsInZone,
  newlyEnteredCommercialSats,
  attackZoneRangeKm,
  startTracking,
  stopTracking
} = useSatellites(userLat, userLon, deviceAzimuth);

// 3. Wikipedia article with enter-event attacks, persistence, and healing
const {
  currentArticle,
  interferedExtract,
  imageFilter,
  attackLog,
  isTotallyBroken,
  criticalSatelliteLimit,
  isHealed,
  healedBySatName,
  isLoading: isWikiLoading
} = useWikipedia(closestScientific, newlyEnteredCommercialSats);

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

    &--broken {
      color: $color-primary;
      font-weight: 700;
    }

    &--muted {
      color: $color-text-faint;
    }
  }
}
</style>
