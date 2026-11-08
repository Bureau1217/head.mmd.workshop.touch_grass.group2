<template>
  <Transition name="satellite-map">
    <aside
      class="app-satellite-map"
      role="dialog"
      aria-label="Satellite positions map"
    >
      <header class="app-satellite-map__header">
        <div class="app-satellite-map__heading">
          <strong>Satellite map</strong>
          <span>{{ satellites.length }} tracked</span>
        </div>
        <button
          type="button"
          class="app-satellite-map__close"
          aria-label="Close satellite map"
          @click="emit('close')"
        >
          ×
        </button>
      </header>

      <div class="app-satellite-map__legend" aria-label="Map legend">
        <span><i class="app-satellite-map__dot app-satellite-map__dot--user" />You</span>
        <span><i class="app-satellite-map__dot app-satellite-map__dot--scientific" />Scientific</span>
        <span><i class="app-satellite-map__dot app-satellite-map__dot--commercial" />Commercial</span>
        <span>
          <i class="app-satellite-map__zone-key" />
          Attack zone ({{ attackZoneRangeKm }} km)
        </span>
      </div>

      <div class="app-satellite-map__frame">
        <div class="app-satellite-map__tiles" aria-hidden="true">
          <img
            v-for="tile in tiles"
            :key="`${tile.x}-${tile.y}-${zoom}`"
            :src="`https://tile.openstreetmap.org/${zoom}/${tile.urlX}/${tile.y}.png`"
            :style="tileStyle(tile)"
            alt=""
          >
        </div>
        <svg
          class="app-satellite-map__markers"
          viewBox="0 0 512 512"
          role="img"
          :aria-label="`${satellites.length} satellite positions and your location`"
        >
          <path
            :d="attackZonePath"
            class="app-satellite-map__attack-zone"
            :aria-label="`Commercial attack zone, ${attackZoneRangeKm} kilometers`"
          >
            <title>Commercial attack zone: {{ attackZoneRangeKm }} km</title>
          </path>
          <g
            v-for="(satellite, index) in satellites"
            :key="`${satellite.name}-${index}`"
            :transform="`translate(${projectPosition(satellite.longitude, satellite.latitude).x} ${projectPosition(satellite.longitude, satellite.latitude).y})`"
            :display="isVisible(satellite.longitude, satellite.latitude) ? undefined : 'none'"
            class="app-satellite-map__marker-group"
            tabindex="0"
            role="button"
            :aria-label="`${satellite.name}, ${satellite.purpose}`"
            @mouseenter="showSatellite(satellite)"
            @mouseleave="hideSatellite"
            @focus="showSatellite(satellite)"
            @blur="hideSatellite"
          >
            <circle r="10" class="app-satellite-map__marker-hit-area" />
            <circle
              r="3.5"
              :class="[
                'app-satellite-map__marker',
                `app-satellite-map__marker--${satellite.type}`,
                { 'app-satellite-map__marker--highlighted': isHighlighted(satellite) }
              ]"
            />
          </g>
          <circle
            cx="256"
            cy="256"
            r="6"
            class="app-satellite-map__marker app-satellite-map__marker--user"
          >
            <title>Your location</title>
          </circle>
        </svg>
        <div
          v-if="hoveredSatellite"
          class="app-satellite-map__tooltip"
          role="status"
        >
          <strong>{{ hoveredSatellite.name }}</strong>
          <span>{{ hoveredSatellite.purpose }}</span>
          <span>
            Distance:
            {{ hoveredSatellite.distance === null ? '—' : `${hoveredSatellite.distance.toLocaleString()} km` }}
          </span>
        </div>
        <a
          class="app-satellite-map__attribution"
          href="https://www.openstreetmap.org/copyright"
          target="_blank"
          rel="noopener noreferrer"
        >
          © OpenStreetMap contributors
        </a>
      </div>
    </aside>
  </Transition>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import type { CommercialSatelliteDwell } from '~/attackScript';
import type { SatelliteMapPosition } from '~/types/satellite';

const props = defineProps<{
  satellites: SatelliteMapPosition[];
  userLat: number;
  userLon: number;
  attackZoneRangeKm: number;
  activeDwellsList: CommercialSatelliteDwell[];
  pageSatelliteName: string | null;
}>();

const emit = defineEmits<{
  close: [];
}>();

const hoveredSatellite = ref<SatelliteMapPosition | null>(null);

const zoom = 4;
const tileSize = 256;
const viewportSize = 512;

const worldSize = computed(() => tileSize * 2 ** zoom);

const projectWorldX = (longitude: number): number => {
  const normalizedLongitude = ((longitude + 180) % 360 + 360) % 360;
  return (normalizedLongitude / 360) * worldSize.value;
};

const projectWorldY = (latitude: number): number => {
  const clampedLatitude = Math.max(-85.05112878, Math.min(85.05112878, latitude));
  const radians = (clampedLatitude * Math.PI) / 180;
  const mercatorY = (1 - Math.asinh(Math.tan(radians)) / Math.PI) / 2;
  return mercatorY * worldSize.value;
};

const centerX = computed(() => projectWorldX(props.userLon));
const centerY = computed(() => projectWorldY(props.userLat));
const left = computed(() => centerX.value - viewportSize / 2);
const top = computed(() => centerY.value - viewportSize / 2);

const tiles = computed(() => {
  const tileCount = 2 ** zoom;
  const firstX = Math.floor(left.value / tileSize);
  const lastX = Math.floor((left.value + viewportSize - 1) / tileSize);
  const firstY = Math.max(0, Math.floor(top.value / tileSize));
  const lastY = Math.min(
    tileCount - 1,
    Math.floor((top.value + viewportSize - 1) / tileSize)
  );
  const result: Array<{ x: number; y: number; urlX: number }> = [];

  for (let x = firstX; x <= lastX; x += 1) {
    for (let y = firstY; y <= lastY; y += 1) {
      result.push({
        x,
        y,
        urlX: ((x % tileCount) + tileCount) % tileCount
      });
    }
  }

  return result;
});

const tileStyle = (tile: { x: number; y: number }) => ({
  left: `${((tile.x * tileSize - left.value) / viewportSize) * 100}%`,
  top: `${((tile.y * tileSize - top.value) / viewportSize) * 100}%`
});

const projectPosition = (longitude: number, latitude: number) => {
  let x = projectWorldX(longitude) - centerX.value;
  if (x > worldSize.value / 2) x -= worldSize.value;
  if (x < -worldSize.value / 2) x += worldSize.value;

  return {
    x: viewportSize / 2 + x,
    y: viewportSize / 2 + projectWorldY(latitude) - centerY.value
  };
};

const isCommercialSatelliteActive = (name: string): boolean => props.activeDwellsList.some(
  (dwell) => dwell.name === name && dwell.inZone && dwell.force > 0
);

const isHighlighted = (satellite: SatelliteMapPosition): boolean =>
  satellite.name === props.pageSatelliteName
  || (satellite.type === 'commercial' && isCommercialSatelliteActive(satellite.name));

const showSatellite = (satellite: SatelliteMapPosition) => {
  hoveredSatellite.value = satellite;
};

const hideSatellite = () => {
  hoveredSatellite.value = null;
};

const isVisible = (longitude: number, latitude: number): boolean => {
  const position = projectPosition(longitude, latitude);
  return position.x >= 0 && position.x <= viewportSize
    && position.y >= 0 && position.y <= viewportSize;
};

const attackZonePath = computed(() => {
  const earthRadiusKm = 6371.0088;
  const angularDistance = props.attackZoneRangeKm / earthRadiusKm;
  const latitude = (props.userLat * Math.PI) / 180;
  const longitude = (props.userLon * Math.PI) / 180;
  const points: string[] = [];

  for (let bearingDegrees = 0; bearingDegrees <= 360; bearingDegrees += 5) {
    const bearing = (bearingDegrees * Math.PI) / 180;
    const pointLatitude = Math.asin(
      Math.sin(latitude) * Math.cos(angularDistance)
      + Math.cos(latitude) * Math.sin(angularDistance) * Math.cos(bearing)
    );
    const pointLongitude = longitude + Math.atan2(
      Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(latitude),
      Math.cos(angularDistance) - Math.sin(latitude) * Math.sin(pointLatitude)
    );
    const position = projectPosition(
      (pointLongitude * 180) / Math.PI,
      (pointLatitude * 180) / Math.PI
    );

    points.push(`${position.x.toFixed(2)} ${position.y.toFixed(2)}`);
  }

  return `M ${points.join(' L ')} Z`;
});

</script>

<style lang="scss" scoped>
@use "~/assets/variables" as *;

.app-satellite-map {
  position: fixed;
  z-index: 1100;
  bottom: $spacing-md;
  left: $spacing-md;
  width: min(28rem, calc(100vw - 2rem), calc(100vh - 7rem));
  overflow: hidden;
  border: 1px solid $color-border;
  border-radius: $radius-md;
  background: $color-white;
  box-shadow: 0 12px 36px rgba(0, 0, 0, 0.28);
  color: $color-text;
  font-family: $font-mono;
  font-size: $font-size-xs;

  &__header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: $spacing-sm $spacing-md;
    background: $color-black;
    color: $color-white;
  }

  &__heading {
    display: flex;
    flex-direction: column;
    gap: $spacing-xs;

    span {
      color: rgba(255, 255, 255, 0.7);
    }
  }

  &__close {
    padding: $spacing-xs $spacing-sm;
    border: 0;
    border-radius: $radius-sm;
    background: transparent;
    color: $color-white;
    font: inherit;
    font-size: $font-size-lg;
    cursor: pointer;

    &:hover {
      background: rgba(255, 255, 255, 0.14);
    }
  }

  &__legend {
    display: flex;
    flex-wrap: wrap;
    gap: $spacing-sm $spacing-md;
    padding: $spacing-sm $spacing-md;
    background: $color-black;
    color: $color-white;

    span {
      display: inline-flex;
      align-items: center;
      gap: $spacing-xs;
      white-space: nowrap;
    }
  }

  &__dot {
    width: 0.6rem;
    height: 0.6rem;
    border-radius: $radius-full;

    &--user {
      background: $color-tertiary;
    }

    &--scientific {
      background: $color-primary;
    }

    &--commercial {
      background: $color-secondary;
    }
  }

  &__zone-key {
    width: 0.8rem;
    height: 0.8rem;
    border: 1px dashed $color-tertiary;
    border-radius: $radius-full;
    background: rgba(150, 115, 240, 0.18);
  }

  &__frame {
    position: relative;
    aspect-ratio: 1;
    overflow: hidden;
    background: $color-surface;
  }

  &__tiles {
    position: absolute;
    inset: 0;
    pointer-events: none;

    img {
      position: absolute;
      display: block;
      width: 50%;
      height: 50%;
      filter: grayscale(1) invert(1) brightness(0.64) contrast(0.82);
    }
  }

  &__markers {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
  }

  &__marker {
    stroke: $color-black;
    stroke-width: 1;

    &--scientific {
      fill: $color-primary;
    }

    &--commercial {
      fill: $color-secondary;
    }

    &--user {
      fill: $color-tertiary;
      stroke-width: 2;
    }

    &--highlighted {
      stroke: $color-white;
      stroke-width: 2;
    }
  }

  &__marker-group {
    cursor: pointer;
    pointer-events: all;

    &:focus-visible .app-satellite-map__marker {
      stroke-width: 3;
    }
  }

  &__marker-hit-area {
    fill: transparent;
    pointer-events: all;
    stroke: transparent;
  }

  &__tooltip {
    position: absolute;
    z-index: 1;
    top: $spacing-sm;
    right: $spacing-sm;
    display: flex;
    flex-direction: column;
    gap: $spacing-xs;
    width: min(14rem, calc(50% - 0.75rem));
    padding: $spacing-sm;
    border: 1px solid $color-border;
    border-radius: $radius-md;
    background: rgba(17, 17, 17, 0.94);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.35);
    color: $color-white;
    pointer-events: none;

    span {
      overflow-wrap: anywhere;
      color: rgba(255, 255, 255, 0.78);
      line-height: 1.35;
    }
  }

  &__attack-zone {
    fill: rgba(150, 115, 240, 0.18);
    stroke: $color-tertiary;
    stroke-dasharray: 6 4;
    stroke-width: 2;
  }

  &__attribution {
    position: absolute;
    right: $spacing-xs;
    bottom: $spacing-xs;
    padding: 2px $spacing-xs;
    border-radius: $radius-sm;
    background: rgba(17, 17, 17, 0.75);
    color: $color-white;
    font-family: $font-sans;
    font-size: 0.625rem;
    text-decoration: none;
  }
}

.satellite-map-enter-active,
.satellite-map-leave-active {
  transition: opacity $transition-fast, transform $transition-fast;
}

.satellite-map-enter-from,
.satellite-map-leave-to {
  opacity: 0;
  transform: translateY(-$spacing-sm);
}
</style>
