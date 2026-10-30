<template>
  <header class="app-header">
    <div class="app-header__left">
      <span
        class="app-header__title"
        title="Double-cliquez pour afficher les informations de mission et d'interférence"
        @dblclick="emit('toggleOverlay')"
      >
        touch grass
      </span>
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
      <!-- USB stick detection: Red dot indicator at top of page -->
      <div
        v-if="isUsbConnected"
        class="app-header__usb"
        :title="usbTooltip"
      >
        <span class="app-header__usb-dot" />
        <span class="app-header__usb-label">USB</span>
      </div>
      <span v-if="isUsbConnected" class="app-header__sep">/</span>

      <span class="app-header__stat">
        {{ visibleCount }} satellites overhead
      </span>
    </div>
  </header>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { UsbDevice } from '~/types/usb';

const props = withDefaults(
  defineProps<{
    userLat: number;
    userLon: number;
    deviceAzimuth: number;
    visibleCount: number;
    isUsbConnected?: boolean;
    usbDevices?: UsbDevice[];
  }>(),
  {
    isUsbConnected: false,
    usbDevices: () => []
  }
);

const emit = defineEmits<{
  (e: 'toggleOverlay'): void;
}>();

const usbTooltip = computed<string>(() => {
  if (!props.isUsbConnected) return 'Aucune clé USB détectée';
  if (props.usbDevices.length === 0) return 'Clé USB connectée';
  return `Clé USB connectée : ${props.usbDevices.map((d) => d.name).join(', ')}`;
});
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
    cursor: pointer;
    user-select: none;
    transition: color $transition-fast;

    &:hover {
      color: $color-primary;
    }
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
    gap: $spacing-sm;
  }

  &__usb {
    display: inline-flex;
    align-items: center;
    gap: $spacing-xs;
    cursor: default;
    user-select: none;
  }

  &__usb-dot {
    width: 10px;
    height: 10px;
    border-radius: $radius-full;
    background-color: $color-usb-dot;
    box-shadow: 0 0 6px $color-usb-glow;
    display: inline-block;
    animation: usb-pulse 2s infinite ease-in-out;
  }

  &__usb-label {
    color: $color-usb-dot;
    font-weight: 700;
    font-size: $font-size-xs;
    letter-spacing: 0.05em;
  }

  &__stat {
    color: $color-text-muted;
  }
}

@keyframes usb-pulse {
  0% {
    transform: scale(0.9);
    box-shadow: 0 0 0 0 rgba(255, 59, 48, 0.7);
  }
  70% {
    transform: scale(1.15);
    box-shadow: 0 0 0 6px rgba(255, 59, 48, 0);
  }
  100% {
    transform: scale(0.9);
    box-shadow: 0 0 0 0 rgba(255, 59, 48, 0);
  }
}
</style>
