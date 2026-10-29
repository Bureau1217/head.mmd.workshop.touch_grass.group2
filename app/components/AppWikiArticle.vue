<template>
  <article class="app-wiki-article">
    <!-- Healing Notice (when scientific satellite changed but page remained the same) -->
    <div v-if="isHealed" class="app-wiki-article__heal-notice">
      <span class="app-wiki-article__heal-badge">Healed</span>
      <p class="app-wiki-article__heal-text">
        Passing scientific satellite <strong>{{ healedBySatName }}</strong> matches the current purpose. The page has been healed and restored.
      </p>
    </div>

    <!-- Totally Broken Notice when critical satellite limit reached -->
    <div v-else-if="isTotallyBroken" class="app-wiki-article__broken-notice">
      <div class="app-wiki-article__broken-header">
        <span class="app-wiki-article__broken-badge">Critical Breakdown</span>
        <span class="app-wiki-article__broken-counter">{{ attackLog.length }} / {{ criticalSatelliteLimit }} Attacks</span>
      </div>
      <p class="app-wiki-article__broken-text">
        Maximum satellite saturation reached. The signal is totally collapsed: all text is redacted and image is degraded.
      </p>
    </div>

    <!-- Active Attacks Breakdown Notice -->
    <div
      v-else-if="attackLog.length > 0"
      class="app-wiki-article__attack-notice"
    >
      <div class="app-wiki-article__attack-header">
        <span class="app-wiki-article__attack-badge">{{ attackLog.length }} {{ attackLog.length === 1 ? 'Attack' : 'Attacks' }} Recorded</span>
        <span class="app-wiki-article__attack-zone">Zone: {{ attackZoneRangeKm }} km (Damage persists until healed)</span>
      </div>
      <div class="app-wiki-article__assignments">
        <div
          v-for="(item, idx) in attackLog"
          :key="`${item.satelliteName}-${idx}`"
          class="app-wiki-article__assignment-tag"
        >
          <span class="app-wiki-article__assignment-sat">{{ item.satelliteName }}</span>
          <span class="app-wiki-article__assignment-arrow">entered →</span>
          <span
            class="app-wiki-article__assignment-type"
            :class="`app-wiki-article__assignment-type--${item.attackType}`"
          >
            {{ formatAttackName(item.attackType) }}
          </span>
        </div>
      </div>
    </div>

    <!-- Scientific Satellite Meta Header -->
    <div v-if="closestScientific" class="app-wiki-article__satellite-meta">
      <div class="app-wiki-article__meta-row">
        <span class="app-wiki-article__meta-label">Nearest Scientific Satellite</span>
        <span class="app-wiki-article__meta-value">{{ closestScientific.name }}</span>
      </div>
      <div class="app-wiki-article__meta-row">
        <span class="app-wiki-article__meta-label">Purpose</span>
        <span class="app-wiki-article__meta-value">{{ closestScientific.purpose }}</span>
      </div>
      <div class="app-wiki-article__meta-row">
        <span class="app-wiki-article__meta-label">Distance / Elevation</span>
        <span class="app-wiki-article__meta-value">{{ closestScientific.distance }} km / {{ closestScientific.elevation }}°</span>
      </div>
    </div>

    <!-- Article Content -->
    <div v-if="article" class="app-wiki-article__body">
      <header class="app-wiki-article__header">
        <h1 class="app-wiki-article__title">{{ article.displayTitle }}</h1>
        <div class="app-wiki-article__source">
          <span>From Wikipedia, the free encyclopedia</span>
          <span class="app-wiki-article__sep">·</span>
          <a
            :href="article.pageUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="app-wiki-article__link"
          >
            Read original ↗
          </a>
        </div>
      </header>

      <div class="app-wiki-article__content-wrapper">
        <!-- Thumbnail image with persistent qualityLossImage filter -->
        <div v-if="article.thumbnailUrl" class="app-wiki-article__media">
          <img
            :src="article.thumbnailUrl"
            :alt="article.title"
            :style="{ filter: imageFilter }"
            class="app-wiki-article__image"
          />
        </div>

        <!-- Main text with persistent confidentialRedact and crossWord attacks -->
        <div class="app-wiki-article__text-block">
          <p
            class="app-wiki-article__paragraph"
            v-html="interferedExtract"
          />
        </div>
      </div>
    </div>

    <div v-else-if="isLoading" class="app-wiki-article__loading">
      <p>Receiving satellite purpose from Wikipedia...</p>
    </div>

    <div v-else class="app-wiki-article__empty">
      <p>Scanning overhead sky for passing scientific satellites...</p>
    </div>
  </article>
</template>

<script setup lang="ts">
import type { NearestSatellite } from '~/types/satellite';
import type { WikipediaArticle } from '~/types/wikipedia';
import type { AttackEvent, AttackType } from '~/attackScript';

defineProps<{
  closestScientific: NearestSatellite | null;
  article: WikipediaArticle | null;
  interferedExtract: string;
  imageFilter: string;
  attackLog: AttackEvent[];
  isTotallyBroken: boolean;
  criticalSatelliteLimit: number;
  attackZoneRangeKm: number;
  isHealed: boolean;
  healedBySatName: string | null;
  isLoading: boolean;
}>();

const formatAttackName = (type: AttackType): string => {
  if (type === 'confidentialRedact') return 'Confidential Redact';
  if (type === 'crossWord') return 'Cross Word';
  if (type === 'qualityLossImage') return 'Image Loss';
  return type;
};
</script>

<style lang="scss" scoped>
@use "~/assets/variables" as *;

.app-wiki-article {
  display: flex;
  flex-direction: column;
  gap: $spacing-lg;
  padding: $spacing-md 0;

  &__heal-notice {
    display: flex;
    align-items: center;
    gap: $spacing-md;
    padding: $spacing-sm $spacing-md;
    border: 1px solid $color-quaternary;
    background: rgba($color-quaternary, 0.08);
    font-size: $font-size-sm;
    font-family: $font-mono;
  }

  &__heal-badge {
    background: $color-quaternary;
    color: $color-black;
    padding: 2px 6px;
    font-size: $font-size-xs;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    flex-shrink: 0;
  }

  &__heal-text {
    margin: 0;
    color: $color-text;
  }

  &__broken-notice {
    display: flex;
    flex-direction: column;
    gap: $spacing-xs;
    padding: $spacing-md;
    border: 2px solid $color-primary;
    background: rgba($color-primary, 0.08);
    font-family: $font-mono;
  }

  &__broken-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  &__broken-badge {
    background: $color-primary;
    color: $color-white;
    padding: 3px 8px;
    font-size: $font-size-xs;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  &__broken-counter {
    color: $color-primary;
    font-weight: 700;
    font-size: $font-size-xs;
  }

  &__broken-text {
    margin: 0;
    color: $color-text;
    font-size: $font-size-sm;
  }

  &__attack-notice {
    display: flex;
    flex-direction: column;
    gap: $spacing-xs;
    padding: $spacing-sm $spacing-md;
    border: 1px solid $color-commercial;
    background: rgba($color-commercial, 0.05);
    font-size: $font-size-sm;
    font-family: $font-mono;
  }

  &__attack-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  &__attack-badge {
    background: $color-commercial;
    color: $color-white;
    padding: 2px 6px;
    font-size: $font-size-xs;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  &__attack-zone {
    color: $color-text-muted;
    font-size: $font-size-xs;
  }

  &__assignments {
    display: flex;
    flex-wrap: wrap;
    gap: $spacing-xs;
    margin-top: $spacing-xs;
  }

  &__assignment-tag {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    background: $color-white;
    border: 1px solid $color-border;
    border-radius: $radius-sm;
    padding: 2px 6px;
    font-size: 11px;
  }

  &__assignment-sat {
    font-weight: 600;
    color: $color-text;
  }

  &__assignment-arrow {
    color: $color-text-faint;
  }

  &__assignment-type {
    font-weight: 700;

    &--confidentialRedact {
      color: $color-black;
    }

    &--crossWord {
      color: $color-secondary;
    }

    &--qualityLossImage {
      color: $color-primary;
    }
  }

  &__satellite-meta {
    display: flex;
    flex-wrap: wrap;
    gap: $spacing-md $spacing-xl;
    padding: $spacing-sm 0;
    border-bottom: 1px solid $color-border;
    font-family: $font-mono;
    font-size: $font-size-xs;
  }

  &__meta-row {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  &__meta-label {
    color: $color-text-muted;
    text-transform: uppercase;
    font-size: 10px;
    letter-spacing: 0.05em;
  }

  &__meta-value {
    color: $color-text;
    font-weight: 600;
  }

  &__body {
    display: flex;
    flex-direction: column;
    gap: $spacing-md;
  }

  &__header {
    border-bottom: 1px solid $color-border;
    padding-bottom: $spacing-sm;
  }

  &__title {
    margin: 0 0 $spacing-xs 0;
    font-family: $font-serif;
    font-size: $font-size-2xl;
    font-weight: 400;
    line-height: 1.2;
    color: $color-text;
  }

  &__source {
    display: flex;
    align-items: center;
    gap: $spacing-xs;
    font-size: $font-size-xs;
    color: $color-text-muted;
    font-family: $font-sans;
  }

  &__sep {
    color: $color-text-faint;
  }

  &__link {
    color: $color-text-muted;
    text-decoration: underline;

    &:hover {
      color: $color-text;
    }
  }

  &__content-wrapper {
    display: flex;
    flex-direction: column;
    gap: $spacing-md;

    @media (min-width: $breakpoint-md) {
      flex-direction: row-reverse;
      align-items: flex-start;
    }
  }

  &__media {
    flex-shrink: 0;
    border: 1px solid $color-border;
    padding: $spacing-xs;
    background: $color-surface;
    max-width: 260px;
    width: 100%;
    overflow: hidden;
  }

  &__image {
    width: 100%;
    height: auto;
    display: block;
    transition: filter $transition-base;
  }

  &__text-block {
    flex: 1;
  }

  &__paragraph {
    margin: 0;
    font-size: $font-size-md;
    line-height: 1.8;
    color: $color-text;
    font-family: $font-sans;

    :deep(.app-wiki-article__censor) {
      background-color: #111111;
      color: #111111;
      border-radius: 2px;
      padding: 0 1px;
      user-select: none;
      display: inline;
      line-height: 1;
    }

    :deep(.app-wiki-article__strike) {
      text-decoration: line-through;
      text-decoration-thickness: 2px;
      text-decoration-color: #111111;
      color: #666666;
    }
  }

  &__loading,
  &__empty {
    padding: $spacing-xl 0;
    font-family: $font-mono;
    font-size: $font-size-sm;
    color: $color-text-muted;
  }
}
</style>
