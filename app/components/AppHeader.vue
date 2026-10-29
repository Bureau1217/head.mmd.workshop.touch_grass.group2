<template>
  <header class="app-header">
    <div class="app-header__left">
      <span class="app-header__title">touch grass</span>
      <span class="app-header__sep">/</span>
      <span class="app-header__coords">
        {{ userLat.toFixed(2) }}°N, {{ userLon.toFixed(2) }}°E
      </span>
      <span class="app-header__sep">/</span>
      <span class="app-header__compass">
        compass {{ deviceAzimuth }}°
      </span>
    </div>

    <div class="app-header__right">
      <span class="app-header__stat">
        {{ visibleCount }} satellites overhead
      </span>
    </div>
  </header>
</template>

<script setup lang="ts">
defineProps<{
  userLat: number;
  userLon: number;
  deviceAzimuth: number;
  visibleCount: number;
}>();
</script>

<style lang="scss" scoped>
@use "~/assets/variables" as *;

.app-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: $spacing-sm;
  padding: $spacing-md;
  border-bottom: 1px solid $color-border;
  font-family: $font-mono;
  font-size: $font-size-sm;

  &__left {
    display: flex;
    align-items: center;
    gap: $spacing-sm;
    flex-wrap: wrap;
  }

  &__title {
    font-weight: 700;
    color: $color-text;
    letter-spacing: -0.02em;
  }

  &__sep {
    color: $color-text-faint;
  }

  &__coords,
  &__compass {
    color: $color-text-muted;
  }

  &__right {
    display: flex;
    align-items: center;
  }

  &__stat {
    color: $color-text-muted;
  }
}
</style>
