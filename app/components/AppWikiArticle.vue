<template>
  <article class="app-wiki-article">
    <!-- Commercial Interference Notice -->
    <div
      v-if="isInterfering && closestCommercial"
      class="app-wiki-article__interference-notice"
    >
      <span class="app-wiki-article__interference-badge">Interference active</span>
      <p class="app-wiki-article__interference-text">
        Commercial satellite <strong>{{ closestCommercial.name }}</strong> is passing overhead ({{ closestCommercial.distance }} km away, elevation {{ closestCommercial.elevation }}°). Transmission is disrupted.
      </p>
    </div>

    <!-- Active Scientific Satellite Meta Header -->
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
        <div v-if="article.thumbnailUrl" class="app-wiki-article__media">
          <img
            :src="article.thumbnailUrl"
            :alt="article.title"
            class="app-wiki-article__image"
          />
        </div>

        <div class="app-wiki-article__text-block">
          <p
            class="app-wiki-article__paragraph"
            :class="{ 'app-wiki-article__paragraph--interfered': isInterfering }"
          >
            {{ interferedExtract }}
          </p>
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

defineProps<{
  closestScientific: NearestSatellite | null;
  closestCommercial: NearestSatellite | null;
  article: WikipediaArticle | null;
  interferedExtract: string;
  isInterfering: boolean;
  isLoading: boolean;
}>();
</script>

<style lang="scss" scoped>
@use "~/assets/variables" as *;

.app-wiki-article {
  display: flex;
  flex-direction: column;
  gap: $spacing-lg;
  padding: $spacing-md 0;

  &__interference-notice {
    display: flex;
    align-items: center;
    gap: $spacing-md;
    padding: $spacing-sm $spacing-md;
    border: 1px solid $color-commercial;
    background: rgba($color-commercial, 0.06);
    font-size: $font-size-sm;
    font-family: $font-mono;
  }

  &__interference-badge {
    background: $color-commercial;
    color: $color-white;
    padding: 2px 6px;
    font-size: $font-size-xs;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    flex-shrink: 0;
  }

  &__interference-text {
    margin: 0;
    color: $color-text;
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
  }

  &__image {
    width: 100%;
    height: auto;
    display: block;
  }

  &__text-block {
    flex: 1;
  }

  &__paragraph {
    margin: 0;
    font-size: $font-size-md;
    line-height: 1.8;
    color: $color-text;

    &--interfered {
      letter-spacing: 0.02em;
      color: #333333;
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
