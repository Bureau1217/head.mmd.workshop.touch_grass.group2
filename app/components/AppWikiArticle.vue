<template>
  <div
    class="app-wiki-article"
    :class="{ 'app-wiki-article--vibrating': isVibrating && !isSecondUsbConnected }"
  >
    <!-- Sticky Overlay: appears only when double-clicking on "touch grass" title in AppHeader -->
    <Transition name="overlay-fade">
      <div
        v-if="showOverlay"
        class="app-wiki-article__overlay-backdrop"
        @click.self="emit('closeOverlay')"
      >
        <div class="app-wiki-article__overlay">
          <div class="app-wiki-article__overlay-header">
            <span class="app-wiki-article__overlay-title">Surveillance orbitale &amp; Interférences</span>
            <button
              type="button"
              class="app-wiki-article__overlay-close"
              title="Fermer le panneau (Échap ou double-clic sur le titre)"
              @click="emit('closeOverlay')"
            >
              ✕
            </button>
          </div>

          <div class="app-wiki-article__texte">
            <!-- Scientific Satellite Status & Reason -->
            <div class="app-wiki-article__line">
              <span v-if="isSecondUsbConnected" class="app-wiki-article__badge app-wiki-article__badge--usb-dual">
                Données scientifiques sauvegardées • Attaques en pause
              </span>
              <span v-else-if="isUsbConnected" class="app-wiki-article__badge app-wiki-article__badge--usb">
                Clé USB branchée
              </span>
              <span v-if="isHealed" class="app-wiki-article__badge app-wiki-article__badge--healed">Page guérie</span>
              <span v-else-if="isTotallyBroken" class="app-wiki-article__badge app-wiki-article__badge--broken">Signal détruit</span>
              <span v-else-if="(breakdownProgress || 0) >= 0.7" class="app-wiki-article__badge app-wiki-article__badge--broken" style="background: rgba(220, 53, 69, 0.15); color: #c82333;">
                Interférence critique ({{ Math.round((breakdownProgress || 0) * 100) }}%)
              </span>
              <span v-else-if="(breakdownProgress || 0) >= 0.35" class="app-wiki-article__badge app-wiki-article__badge--attacked" style="background: rgba(255, 152, 0, 0.15); color: #e65100;">
                Interférence modérée ({{ Math.round((breakdownProgress || 0) * 100) }}%)
              </span>
              <span v-else-if="activeCommercialCount > 0" class="app-wiki-article__badge app-wiki-article__badge--attacked">
                {{ activeCommercialCount }} {{ activeCommercialCount === 1 ? 'brouilleur actif' : 'brouilleurs actifs' }} (Niv. {{ maxForce }}/10)
              </span>
              <span v-else-if="attackLog.length > 0" class="app-wiki-article__badge app-wiki-article__badge--attacked">
                Dégâts persistants (Niv. {{ maxForce }}/10)
              </span>

              <span v-if="closestScientific" class="app-wiki-article__etat">
                <strong>{{ closestScientific.name }}</strong> passe au-dessus de toi ({{ closestScientific.distance }} km, {{ closestScientific.elevation }}°).
              </span>
              <span v-else class="app-wiki-article__etat">
                Recherche d'un satellite scientifique au-dessus de l'horizon...
              </span>

              <span v-if="closestScientific" class="app-wiki-article__raison">
                Mission : « {{ closestScientific.purpose }} » — Article : {{ currentTitle }}.
              </span>
            </div>

            <!-- Commercial Satellites Dwell & Escalation Strip -->
            <div v-if="activeDwellsList && activeDwellsList.length > 0" class="app-wiki-article__attacks-strip">
              <span class="app-wiki-article__attacks-label">Interférences commerciales en cours :</span>
              <span
                v-for="item in activeDwellsList"
                :key="item.name"
                class="app-wiki-article__attack-chip"
                :class="[
                  `app-wiki-article__attack-chip--${item.attackType}`,
                  { 'app-wiki-article__attack-chip--exited': !item.inZone }
                ]"
              >
                <span v-if="item.inZone" class="app-wiki-article__live-dot" />
                <strong>{{ item.name }}</strong>
                <span v-if="item.inZone" class="app-wiki-article__dwell">({{ item.dwellSeconds }}s en zone)</span>
                <span v-else class="app-wiki-article__dwell-exited">(Sorti • Persistant)</span>
                → {{ formatAttackName(item.attackType) }}
                <span v-if="item.force > 0" class="app-wiki-article__force">Force {{ item.force }}/10</span>
                <span v-else class="app-wiki-article__force app-wiki-article__force--intro">Approche (attaque dans {{ Math.max(0, (item.initialDelaySeconds || 10) - item.dwellSeconds) }}s)</span>
              </span>
            </div>
          </div>

          <!-- Action buttons -->
          <div class="app-wiki-article__actions">
            <button
              type="button"
              class="app-wiki-article__btn"
              @click="emit('testJump')"
            >
              Tester un saut
            </button>
            <button
              type="button"
              class="app-wiki-article__btn"
              :class="{
                'app-wiki-article__btn--usb': isUsbConnected && !isSecondUsbConnected,
                'app-wiki-article__btn--usb-dual': isSecondUsbConnected
              }"
              title="Raccourci clavier : touche U (cycle 0 → 1 → 2 → 0)"
              @click="emit('toggleUsbSimulation')"
            >
              {{
                isSecondUsbConnected
                  ? 'Retirer 2ème clé (reprendre les attaques)'
                  : isUsbConnected
                    ? 'Brancher 2ème clé (sauvegarder & pause)'
                    : 'Brancher 1ère clé (Test)'
              }}
            </button>
            <button
              type="button"
              class="app-wiki-article__btn"
              title="Télécharger l'article Wikipédia actuel au format Markdown"
              @click="emit('downloadMarkdown')"
            >
              Télécharger .md
            </button>
            <a
              :href="urlOuvrir"
              target="_blank"
              rel="noopener noreferrer"
              class="app-wiki-article__link"
            >
              Ouvrir sur Wikipédia ↗
            </a>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Popup centré: Données scientifiques sauvegardées (2 clés USB) -->
    <Transition name="modal-pop">
      <div
        v-if="isSecondUsbConnected && showSavedModal"
        class="app-wiki-article__saved-backdrop"
        @click.self="showSavedModal = false"
      >
        <div
          class="app-wiki-article__saved-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="saved-modal-title"
        >
          <!-- En-tête de la boîte de dialogue -->
          <div class="app-wiki-article__saved-modal-header">
            <div class="app-wiki-article__saved-modal-tag">
              <span class="app-wiki-article__saved-dot" />
              <span class="app-wiki-article__saved-dot app-wiki-article__saved-dot--second" />
              <span>ARCHIVAGE DE SECOURS // 2 CLÉS DÉTECTÉES</span>
            </div>
            <button
              type="button"
              class="app-wiki-article__saved-modal-close"
              title="Fermer la boîte de dialogue (Échap ou clic extérieur)"
              @click="showSavedModal = false"
            >
              ✕
            </button>
          </div>

          <!-- Contenu principal -->
          <div class="app-wiki-article__saved-modal-body">
            <h2 id="saved-modal-title" class="app-wiki-article__saved-modal-title">
              Données scientifiques sauvegardées
            </h2>
            <p class="app-wiki-article__saved-modal-desc">
              L'article scientifique en cours a été capturé avec succès et archivé localement au format Markdown (<code>.md</code>).
            </p>

            <div class="app-wiki-article__saved-modal-grid">
              <div class="app-wiki-article__saved-modal-card">
                <span class="app-wiki-article__saved-modal-card-label">Statut du signal</span>
                <span class="app-wiki-article__saved-modal-card-val app-wiki-article__saved-modal-card-val--alert">
                  Attaques suspendues (Pause active)
                </span>
              </div>
              <div class="app-wiki-article__saved-modal-card">
                <span class="app-wiki-article__saved-modal-card-label">Article archivé</span>
                <span class="app-wiki-article__saved-modal-card-val">
                  {{ currentTitle || 'Article Wikipédia' }}
                </span>
              </div>
              <div class="app-wiki-article__saved-modal-card">
                <span class="app-wiki-article__saved-modal-card-label">Action requise</span>
                <span class="app-wiki-article__saved-modal-card-val">
                  Retirer la seconde clé USB pour réactiver les interférences
                </span>
              </div>
            </div>
          </div>

          <!-- Boutons d'action -->
          <div class="app-wiki-article__saved-modal-footer">
            <button
              type="button"
              class="app-wiki-article__saved-btn app-wiki-article__saved-btn--primary"
              @click="emit('downloadMarkdown')"
            >
              Télécharger à nouveau (.md) ↓
            </button>
            <button
              type="button"
              class="app-wiki-article__saved-btn app-wiki-article__saved-btn--secondary"
              @click="showSavedModal = false"
            >
              Continuer la lecture
            </button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Mini-bandeau discret en haut lorsque la modale est minimisée/fermée -->
    <Transition name="banner-slide">
      <aside
        v-if="isSecondUsbConnected && !showSavedModal"
        class="app-wiki-article__saved-banner"
        title="Cliquer pour afficher les détails de la sauvegarde"
        @click="showSavedModal = true"
      >
        <span class="app-wiki-article__saved-dot" />
        <span class="app-wiki-article__saved-dot app-wiki-article__saved-dot--second" />
        <span class="app-wiki-article__saved-title">données scientifiques sauvegardées</span>
        <span class="app-wiki-article__saved-sep">/</span>
        <span class="app-wiki-article__saved-desc">attaques suspendues</span>
        <span class="app-wiki-article__saved-sep">/</span>
        <span class="app-wiki-article__saved-action">afficher les détails ↗</span>
      </aside>
    </Transition>

    <!-- Le vrai site Wikipédia s'affiche ici via srcdoc stable sans rechargement flash -->
    <iframe
      id="cadre"
      ref="iframeRef"
      class="app-wiki-article__cadre"
      :srcdoc="cleanHtml"
      title="Article Wikipédia"
      @load="handleIframeLoad"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import type { NearestSatellite } from '~/types/satellite';
import type { UsbDevice } from '~/types/usb';
import {
  crossWord,
  confidentialRedact,
  qualityLossImage,
  getPixelDegradeSvgFilters,
  raysImage,
  createImageOrbitRaySvgGroup,
  getImageOrbitRayCoordinates,
  raysText,
  getOrbitRayCoordinates,
  fallingLetters,
  type AttackEvent,
  type AttackType,
  type CommercialSatelliteDwell
} from '~/attackScript';
import { playSatellitePassSound, initAudioUnlock } from '~/utils/satelliteSound';

const props = withDefaults(
  defineProps<{
    showOverlay?: boolean;
    closestScientific: NearestSatellite | null;
    currentTitle: string;
    urlCadre: string;
    urlOuvrir: string;
    cleanHtml: string;
    attackedHtml: string;
    imageFilter: string;
    attackLog: AttackEvent[];
    latestAttack: AttackEvent | null;
    activeDwellsList?: CommercialSatelliteDwell[];
    breakdownProgress?: number;
    isTotallyBroken: boolean;
    criticalSatelliteLimit: number;
    isHealed: boolean;
    healedBySatName: string | null;
    isLoading: boolean;
    isUsbConnected?: boolean;
    isSecondUsbConnected?: boolean;
    usbDevices?: UsbDevice[];
  }>(),
  {
    showOverlay: false,
    activeDwellsList: () => [],
    isUsbConnected: false,
    isSecondUsbConnected: false,
    usbDevices: () => []
  }
);

const emit = defineEmits<{
  (e: 'testJump'): void;
  (e: 'toggleUsbSimulation'): void;
  (e: 'downloadMarkdown'): void;
  (e: 'closeOverlay'): void;
}>();

const iframeRef = ref<HTMLIFrameElement | null>(null);
const cleanBodyHtml = ref<string>('');
const isDocReady = ref<boolean>(false);

// Earthquake vibration & audio feedback state
const isVibrating = ref<boolean>(false);
let earthquakeTimer: ReturnType<typeof setTimeout> | null = null;
let earthquakeEndTimer: ReturnType<typeof setTimeout> | null = null;

const triggerEarthquake = () => {
  // If Starlink override is active, attacks are suspended
  if (props.isSecondUsbConnected) {
    isVibrating.value = false;
    return;
  }

  if (earthquakeTimer) clearTimeout(earthquakeTimer);
  if (earthquakeEndTimer) clearTimeout(earthquakeEndTimer);

  // Vibration and sound start immediately at t = 0 (very low),
  // ramp up to peak at the middle of transit (t = 1.2s), and fade away at t = 2.4s.
  isVibrating.value = true;
  playSatellitePassSound();

  const doc = iframeRef.value?.contentDocument;
  if (doc?.body) {
    doc.body.classList.remove('is-earthquake');
    // Force reflow to restart animation smoothly if multiple passes occur
    void doc.body.offsetWidth;
    doc.body.classList.add('is-earthquake');
  }

  earthquakeEndTimer = setTimeout(() => {
    isVibrating.value = false;
    if (doc?.body) {
      doc.body.classList.remove('is-earthquake');
    }
  }, 2400);
};

// Immediate attack cutoff when Starlink is plugged in
watch(
  () => props.isSecondUsbConnected,
  (connected) => {
    if (connected) {
      isVibrating.value = false;
      if (earthquakeTimer) {
        clearTimeout(earthquakeTimer);
        earthquakeTimer = null;
      }
      if (earthquakeEndTimer) {
        clearTimeout(earthquakeEndTimer);
        earthquakeEndTimer = null;
      }
    }
  }
);

// State for the 2nd USB stick saved data popup dialog
const showSavedModal = ref<boolean>(false);

watch(
  () => props.isSecondUsbConnected,
  (connected) => {
    if (connected) {
      showSavedModal.value = true;
    } else {
      showSavedModal.value = false;
    }
  },
  { immediate: true }
);

const handleModalKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Escape' && showSavedModal.value) {
    showSavedModal.value = false;
  }
};

onMounted(() => {
  initAudioUnlock();
  window.addEventListener('keydown', handleModalKeydown);
});

onUnmounted(() => {
  if (earthquakeTimer) clearTimeout(earthquakeTimer);
  if (earthquakeEndTimer) clearTimeout(earthquakeEndTimer);
  window.removeEventListener('keydown', handleModalKeydown);
});

const activeCommercialCount = computed(() => {
  return props.activeDwellsList?.filter((d) => d.inZone).length || 0;
});

const maxForce = computed(() => {
  if (!props.activeDwellsList || props.activeDwellsList.length === 0) return 0;
  return Math.max(...props.activeDwellsList.map((d) => d.force), 0);
});

const formatAttackName = (type: AttackType): string => {
  if (type === 'satellitePass') return 'Passage Orbital (Texte & Images)';
  if (type === 'qualityLossImage') return 'Dégradation Image (Pixels)';
  if (type === 'raysImage') return 'Rayures Satellite (Blanches)';
  if (type === 'raysText') return 'Trace Orbitale (Zéros)';
  if (type === 'fallingLetters') return 'Chute de Lettres (Gravité)';
  if (type === 'confidentialRedact') return 'Fichier Confidentiel (Noir)';
  if (type === 'crossWord') return 'Rayer mots (Barre)';
  return type;
};

// Guarantee base attack styles, pixel degradation filters, and animations are active in iframe
const ensureAttackStyles = (doc: Document) => {
  if (!doc || !doc.head) return;

  // 1. Inject SVG pixelation & quantization filter definitions if missing
  if (!doc.getElementById('satellite-pixel-degrade-svgs')) {
    const svgWrap = doc.createElement('div');
    svgWrap.id = 'satellite-pixel-degrade-svgs';
    svgWrap.style.cssText = 'position: absolute; width: 0; height: 0; overflow: hidden; pointer-events: none;';
    svgWrap.innerHTML = getPixelDegradeSvgFilters();
    doc.body ? doc.body.appendChild(svgWrap) : doc.head.appendChild(svgWrap);
  }

  // 2. Inject CSS rules
  let styleEl = doc.getElementById('satellite-attack-base-styles') as HTMLStyleElement | null;
  if (!styleEl) {
    styleEl = doc.createElement('style');
    styleEl.id = 'satellite-attack-base-styles';
    doc.head.appendChild(styleEl);
  }
  styleEl.textContent = `
    a {
      pointer-events: none !important;
      cursor: default !important;
      text-decoration: underline dotted #a2a9b1 !important;
      color: inherit !important;
    }
    /* Real digital image pixelation (no blur) */
    img, figure, picture, .mw-file-element, .thumbimage {
      image-rendering: pixelated !important;
      image-rendering: crisp-edges !important;
      transition: filter 2s cubic-bezier(0.4, 0, 0.2, 1) !important;
    }
    /* Ensure image containers support absolute ray overlays */
    .app-wiki-article__image-wrap,
    figure,
    .thumbinner,
    .mw-file-description {
      position: relative !important;
    }
    .app-wiki-article__image-orbit-svg {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 6;
      overflow: hidden;
    }
    /* Collapsed Broken Image Placeholder (Signal Lost / Missing Image Icon) */
    .app-wiki-article__image-wrap.is-collapsed {
      display: inline-flex !important;
      align-items: center !important;
      justify-content: center !important;
      position: relative !important;
      border: 1px solid #c8ccd1 !important;
      background-color: #f8f9fa !important;
      border-radius: 2px !important;
      box-sizing: border-box !important;
      transition: all 0.25s ease-out !important;
      overflow: hidden !important;
    }
    .app-wiki-article__image-wrap.is-collapsed img,
    .app-wiki-article__image-wrap.is-collapsed .app-wiki-article__image-orbit-svg,
    .app-wiki-article__image-wrap.is-collapsed .app-wiki-article__rays-overlay {
      display: none !important;
      visibility: hidden !important;
    }
    .app-wiki-article__broken-placeholder {
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      width: 100% !important;
      height: 100% !important;
      user-select: none !important;
    }
    .app-wiki-article__broken-icon {
      display: block !important;
      opacity: 0.65 !important;
      transition: opacity 0.2s ease !important;
    }
    /* Totally broken signal: all image URLs broken and images completely hidden */
    body.is-signal-broken img,
    body.is-signal-broken figure img,
    body.is-signal-broken picture img,
    body.is-signal-broken .mw-file-element,
    body.is-signal-broken .thumbimage {
      display: none !important;
      visibility: hidden !important;
    }
    /* Flyby earthquake tremor animation inside iframe:
       Subtle, low-amplitude physical vibration peaking at ~1.5px without nauseating screen tilting */
    @keyframes iframe-earthquake {
      /* 0% to 20%: Starts very subtle */
      0% { transform: translate(0, 0); }
      5% { transform: translate(0.2px, -0.15px); }
      10% { transform: translate(-0.25px, 0.2px); }
      15% { transform: translate(0.35px, -0.25px); }
      20% { transform: translate(-0.45px, 0.35px); }

      /* 25% to 40%: Building gently as satellite approaches overhead */
      25% { transform: translate(0.65px, -0.5px); }
      30% { transform: translate(-0.85px, 0.65px); }
      35% { transform: translate(1.05px, -0.8px); }
      40% { transform: translate(-1.25px, 0.95px); }

      /* 45% to 55%: Peak subtle vibration at zenith (middle of transit) */
      45% { transform: translate(1.45px, -1.1px); }
      48% { transform: translate(-1.6px, 1.2px); }
      50% { transform: translate(1.65px, -1.25px); }
      52% { transform: translate(-1.5px, 1.15px); }
      55% { transform: translate(1.35px, -1.0px); }

      /* 60% to 75%: Decreasing gently as satellite departs */
      60% { transform: translate(-1.1px, 0.8px); }
      65% { transform: translate(0.85px, -0.65px); }
      70% { transform: translate(-0.6px, 0.45px); }
      75% { transform: translate(0.4px, -0.3px); }

      /* 80% to 100%: Dying out smoothly to rest */
      80% { transform: translate(-0.25px, 0.2px); }
      85% { transform: translate(0.15px, -0.1px); }
      90% { transform: translate(-0.1px, 0.05px); }
      95% { transform: translate(0.05px, -0.05px); }
      100% { transform: translate(0, 0); }
    }
    body.is-earthquake {
      animation: iframe-earthquake 2.4s cubic-bezier(0.4, 0, 0.2, 1) both !important;
    }
    /* Satellite Ray Trails (raysImage): physically converts underlying pixels to gray */
    .app-wiki-article__rays-overlay {
      position: absolute;
      inset: 0;
      pointer-events: none;
      overflow: hidden;
      z-index: 5;
      border-radius: inherit;
    }
    .app-wiki-article__ray-track {
      position: absolute;
      left: -50%;
      width: 200%;
      transform-origin: 50% 50%;
      pointer-events: none;
      /* Blinding pure white satellite optical streak */
      background: linear-gradient(
        180deg,
        transparent 0%,
        rgba(255, 255, 255, 0.35) 15%,
        rgba(255, 255, 255, 0.95) 45%,
        #ffffff 50%,
        rgba(255, 255, 255, 0.95) 55%,
        rgba(255, 255, 255, 0.35) 85%,
        transparent 100%
      );
      box-shadow: 0 0 6px rgba(255, 255, 255, 0.95), 0 0 12px rgba(255, 255, 255, 0.6);
      clip-path: polygon(0 0, 0 0, 0 100%, 0 100%);
      animation: ray-draw-across var(--ray-duration, 4.5s) cubic-bezier(0.2, 0.8, 0.25, 1) forwards;
    }
    @keyframes ray-draw-across {
      0% {
        clip-path: polygon(0 0, 0 0, 0 100%, 0 100%);
        opacity: 0.15;
      }
      10% {
        opacity: 1;
      }
      100% {
        clip-path: polygon(0 0, 100% 0, 100% 100%, 0 100%);
        opacity: 0.95;
      }
    }
    /* Satellite Orbital Interference Line Attack (raysText) */
    .app-wiki-article__orbit-char {
      position: relative;
      display: inline-block;
      vertical-align: baseline;
      font: inherit;
      line-height: inherit;
      margin: 0;
      padding: 0;
    }
    .app-wiki-article__char-orig {
      display: inline-block;
      vertical-align: baseline;
      font: inherit;
      line-height: inherit;
      animation: char-satellite-burn 0.28s ease-out forwards;
      animation-delay: var(--hit-delay, 0s);
    }
    .app-wiki-article__char-zero {
      position: absolute;
      left: 0;
      top: 0;
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: 'Courier New', Courier, monospace !important;
      font-weight: 700 !important;
      color: #111111 !important;
      opacity: 0;
      pointer-events: none;
      animation: zero-satellite-etch 0.38s cubic-bezier(0.2, 0.9, 0.3, 1) forwards;
      animation-delay: var(--hit-delay, 0s);
    }
    @keyframes char-satellite-burn {
      0% {
        opacity: 1;
        transform: scale(1);
        color: inherit;
      }
      40% {
        opacity: 1;
        transform: scale(1.15);
        color: #ffffff;
        text-shadow: 0 0 6px #ffffff;
      }
      100% {
        opacity: 0;
        transform: scale(0.5);
        visibility: hidden;
      }
    }
    @keyframes zero-satellite-etch {
      0% {
        opacity: 0;
        transform: scale(1.8);
        color: #ffffff;
        text-shadow: 0 0 10px #ffffff, 0 0 16px rgba(255, 255, 255, 0.9);
      }
      45% {
        opacity: 1;
        transform: scale(1.25);
        color: #ffffff;
        text-shadow: 0 0 8px #ffffff;
      }
      100% {
        opacity: 1;
        transform: scale(1);
        color: #111111;
        text-shadow: none;
      }
    }
    @keyframes draw-orbit-streak {
      0% {
        stroke-dashoffset: var(--orbit-len, 1200);
        opacity: 1;
      }
      100% {
        stroke-dashoffset: 0;
        opacity: 0.75;
      }
    }
    @keyframes draw-image-orbit-streak {
      0% {
        stroke-dashoffset: var(--image-orbit-len, 1000);
        opacity: 1;
      }
      100% {
        stroke-dashoffset: 0;
        opacity: 0.88;
      }
    }
    /* Falling Letters Attack: letters rip free and drop down with gravity */
    .app-wiki-article__falling-letter {
      display: inline-block;
      position: relative;
      vertical-align: baseline;
      font: inherit;
      line-height: inherit;
      color: inherit;
      transform-origin: 50% 50%;
      will-change: transform, opacity;
      animation: letter-rip-and-drop 2.5s cubic-bezier(0.5, 0, 0.75, 0) forwards;
    }
    @keyframes letter-rip-and-drop {
      0% {
        transform: translate(0, 0) rotate(0deg);
        opacity: 1;
      }
      12% {
        transform: translate(-1px, -3px) rotate(-8deg);
        opacity: 1;
      }
      20% {
        transform: translate(2px, -1px) rotate(12deg);
        opacity: 1;
      }
      65% {
        transform: translate(var(--fall-drift, 20px), calc(var(--fall-drop, 250px) * 0.45)) rotate(calc(var(--fall-rot, 90deg) * 0.6));
        opacity: 0.85;
      }
      100% {
        transform: translate(var(--fall-drift, 40px), var(--fall-drop, 350px)) rotate(var(--fall-rot, 160deg));
        opacity: 0;
      }
    }
    /* Document level transitions */
    body {
      transition: filter 2.5s ease-in-out, background-color 2.5s ease-in-out, color 2.5s ease-in-out !important;
    }
    .app-wiki-article__censor {
      position: relative;
      display: inline-block;
      vertical-align: baseline;
      background: transparent !important;
      background-color: transparent !important;
      padding: 0 !important;
      margin: 0 !important;
      border: 0 !important;
      font: inherit;
      line-height: inherit;
      user-select: none;
      animation: censor-text-blackout 1.6s cubic-bezier(0.22, 1, 0.36, 1) forwards;
    }
    .app-wiki-article__censor::after {
      content: '';
      position: absolute;
      top: -2px;
      bottom: -2px;
      left: -2px;
      width: 0%;
      background-color: #111111;
      border-radius: 2px;
      box-shadow: 0 0 1px #111111;
      pointer-events: none;
      animation: censor-bar-sweep 1.6s cubic-bezier(0.22, 1, 0.36, 1) forwards;
    }
    @keyframes censor-bar-sweep {
      0% {
        width: 0%;
      }
      100% {
        width: calc(100% + 4px);
      }
    }
    @keyframes censor-text-blackout {
      0% {
        color: inherit;
      }
      45% {
        color: inherit;
      }
      100% {
        color: #111111;
      }
    }
    .app-wiki-article__strike {
      position: relative;
      display: inline-block;
      vertical-align: baseline;
      text-decoration: none !important;
      background: transparent !important;
      background-color: transparent !important;
      padding: 0 !important;
      margin: 0 !important;
      border: 0 !important;
      font: inherit;
      line-height: inherit;
      animation: strike-text-soften 1.4s cubic-bezier(0.22, 1, 0.36, 1) forwards;
    }
    .app-wiki-article__strike::after {
      content: '';
      position: absolute;
      top: 50%;
      left: -1px;
      width: 0%;
      height: 2px;
      background-color: #111111;
      transform: translateY(-50%);
      border-radius: 1px;
      pointer-events: none;
      animation: strike-line-sweep 1.4s cubic-bezier(0.22, 1, 0.36, 1) forwards;
    }
    @keyframes strike-line-sweep {
      0% {
        width: 0%;
      }
      100% {
        width: calc(100% + 2px);
      }
    }
    @keyframes strike-text-soften {
      0% {
        color: inherit;
      }
      100% {
        color: #666666;
      }
    }
  `;
};

// Traverse and modify raw text nodes safely in the iframe DOM without re-rendering or flash
const applyTextAttack = (
  doc: Document,
  attackFn: (text: string, force: number) => string,
  force: number
) => {
  if (!doc || !doc.body) return;
  ensureAttackStyles(doc);

  const walker = doc.createTreeWalker(
    doc.body,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode(node: Node) {
        const parent = node.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;
        const tag = parent.tagName.toLowerCase();
        if (
          tag === 'script' ||
          tag === 'style' ||
          tag === 'noscript' ||
          tag === 'mark' ||
          tag === 'del' ||
          tag === 'h1' ||
          parent.closest('mark.app-wiki-article__censor') ||
          parent.closest('del.app-wiki-article__strike') ||
          parent.closest('span.app-wiki-article__falling-letter') ||
          parent.closest('span.app-wiki-article__text-ray')
        ) {
          return NodeFilter.FILTER_REJECT;
        }
        if (node.nodeValue && /[a-zA-Z0-9\u00C0-\u017F]{2,}/.test(node.nodeValue)) {
          return NodeFilter.FILTER_ACCEPT;
        }
        return NodeFilter.FILTER_SKIP;
      }
    }
  );

  const textNodes: Text[] = [];
  while (walker.nextNode()) {
    textNodes.push(walker.currentNode as Text);
  }

  for (const textNode of textNodes) {
    const original = textNode.nodeValue || '';
    const attacked = attackFn(original, force);
    if (attacked !== original) {
      const span = doc.createElement('span');
      span.innerHTML = attacked;
      textNode.replaceWith(...Array.from(span.childNodes));
    }
  }
};

// Liang-Barsky line segment clipping against rectangle in page coordinates
function clipLineToRect(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  rLeft: number,
  rTop: number,
  rRight: number,
  rBottom: number
): { t0: number; t1: number } | null {
  const dx = x2 - x1;
  const dy = y2 - y1;
  let t0 = 0;
  let t1 = 1;

  const p = [-dx, dx, -dy, dy];
  const q = [x1 - rLeft, rRight - x1, y1 - rTop, rBottom - y1];

  for (let i = 0; i < 4; i++) {
    if (p[i] === 0) {
      if (q[i] < 0) return null;
    } else {
      const r = q[i] / p[i];
      if (p[i] < 0) {
        if (r > t1) return null;
        if (r > t0) t0 = r;
      } else {
        if (r < t0) return null;
        if (r < t1) t1 = r;
      }
    }
  }

  if (t0 > t1) return null;
  return { t0, t1 };
}

// Collapses an image wrapper that has sustained multiple satellite passes into the failed-to-load broken icon state
const collapseImageToBrokenIcon = (wrap: HTMLElement, doc: Document) => {
  if (wrap.classList.contains('is-collapsed')) return;

  const originalImg = wrap.querySelector('img');
  const altText = originalImg?.getAttribute('alt') || 'Image';
  const imgW = Math.max(80, wrap.clientWidth || originalImg?.clientWidth || 220);
  const imgH = Math.max(60, wrap.clientHeight || originalImg?.clientHeight || 150);

  wrap.classList.add('is-collapsed');
  wrap.style.width = `${imgW}px`;
  wrap.style.height = `${imgH}px`;

  let placeholder = wrap.querySelector('.app-wiki-article__broken-placeholder');
  if (!placeholder) {
    placeholder = doc.createElement('div');
    placeholder.className = 'app-wiki-article__broken-placeholder';
    placeholder.setAttribute('title', altText);
    placeholder.innerHTML = `
      <svg class="app-wiki-article__broken-icon" viewBox="0 0 48 48" width="40" height="40" fill="none">
        <rect x="5" y="7" width="38" height="34" rx="3" fill="#ffffff" stroke="#a2a9b1" stroke-width="2" />
        <path d="M9 35l11-13 8 9 7-8 9 12H9z" fill="#eaecf0" stroke="#c8ccd1" stroke-width="1" />
        <circle cx="16" cy="17" r="3.2" fill="#c8ccd1" />
        <path d="M22 6l5 12-6 8 6 10-3 6" stroke="#888c91" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" fill="none" />
      </svg>
    `;
    wrap.appendChild(placeholder);
  }
};

// Combined Satellite Orbital Pass:
// A single satellite traverses the screen along an inclined diagonal path,
// affecting BOTH text (flipping characters to '0') and images (drawing glare streaks) in its path.
// When in transit, it triggers an earthquake vibration and organic oscillator rumble matching the flyby envelope.
// Lines continue to cross the screen as force escalates (including during critical interference) until total breakdown.
const applyCombinedSatellitePass = (doc: Document, force: number, isReplay: boolean = false) => {
  if (!doc || !doc.body) return;
  ensureAttackStyles(doc);

  // Keep generating lines continuously until total breakdown (up to 40 passes across the page)
  const targetRayCount = Math.min(40, Math.max(1, force));

  let trackerContainer = doc.getElementById('app-wiki-article-orbit-tracker') as HTMLElement | null;
  if (!trackerContainer) {
    trackerContainer = doc.createElement('div');
    trackerContainer.id = 'app-wiki-article-orbit-tracker';
    trackerContainer.style.display = 'none';
    doc.body.appendChild(trackerContainer);
  }

  const existingTracks = trackerContainer.querySelectorAll('.app-wiki-article__orbit-group');
  const currentRayCount = existingTracks.length;

  const viewportWidth = doc.documentElement.clientWidth || doc.body.clientWidth || 900;
  const viewportHeight = doc.defaultView?.innerHeight || 700;
  const scrollY = doc.defaultView?.scrollY || 0;

  // 1. Gather all candidate images in the article
  const images = Array.from(doc.querySelectorAll<HTMLImageElement>('img')).filter((img) => {
    const src = img.getAttribute('src') || '';
    if (src.includes('badge') || src.includes('icon') || src.includes('symbol')) return false;
    const w = img.clientWidth || img.naturalWidth || parseInt(img.getAttribute('width') || '100', 10);
    const h = img.clientHeight || img.naturalHeight || parseInt(img.getAttribute('height') || '100', 10);
    return w >= 60 && h >= 40;
  });

  const imageWrappers: HTMLElement[] = [];
  images.forEach((img) => {
    let wrapper = img.parentElement as HTMLElement | null;
    if (!wrapper) return;

    if (!wrapper.classList.contains('app-wiki-article__image-wrap') && !wrapper.closest('figure, .thumbinner, .mw-file-description')) {
      const wrap = doc.createElement('div');
      wrap.className = 'app-wiki-article__image-wrap';
      wrap.style.cssText = 'position: relative; display: inline-block; overflow: hidden; vertical-align: top;';
      img.replaceWith(wrap);
      wrap.appendChild(img);
      wrapper = wrap;
    } else {
      wrapper.style.position = 'relative';
      wrapper.style.display = 'inline-block';
      wrapper.style.overflow = 'hidden';
      wrapper.style.verticalAlign = 'top';
    }
    img.style.display = 'block';
    imageWrappers.push(wrapper);
  });

  // 2. Gather candidate text containers
  const containers = Array.from(
    doc.querySelectorAll<HTMLElement>('p, li, dd, dt, blockquote, td, th, h2, h3, figcaption')
  ).filter((el) => {
    if (el.closest('#mw-navigation, #toc, .mw-jump-link, .navbox')) return false;
    return (el.textContent || '').trim().length > 0;
  });

  // 3. Apply each new orbital pass
  for (let r = currentRayCount; r < targetRayCount; r++) {
    const k = r - currentRayCount;
    // When multiple satellite passes occur in a batch, stagger them by 2.8s
    // so they fly by sequentially rather than clumping simultaneously
    const passDelaySec = isReplay ? 0 : k * 2.8;

    const coords = getOrbitRayCoordinates(r, viewportWidth, viewportHeight, scrollY);
    const { x1, y1, x2, y2, length: L, durationSec } = coords;

    const lineMinX = Math.min(x1, x2) - 30;
    const lineMaxX = Math.max(x1, x2) + 30;
    const lineMinY = Math.min(y1, y2) - 30;
    const lineMaxY = Math.max(y1, y2) + 30;

    const groupMarker = doc.createElement('span');
    groupMarker.className = 'app-wiki-article__orbit-group';
    groupMarker.setAttribute('data-ray', String(r));
    trackerContainer.appendChild(groupMarker);

    // Vibration & Sound: starts low at entry, swells to zenith at middle, fades away
    if (!isReplay) {
      if (passDelaySec > 0) {
        setTimeout(() => {
          triggerEarthquake();
        }, Math.round(passDelaySec * 1000));
      } else {
        triggerEarthquake();
      }
    }

    // A. AFFECT TEXT ALONG THIS SATELLITE'S PATH
    const intersectingContainers = containers.filter((c) => {
      const cr = c.getBoundingClientRect();
      const cTop = cr.top + scrollY;
      const cBottom = cr.bottom + scrollY;
      const cLeft = cr.left;
      const cRight = cr.right;
      return !(cRight < lineMinX || cLeft > lineMaxX || cBottom < lineMinY || cTop > lineMaxY);
    });

    const range = doc.createRange();

    for (const container of intersectingContainers) {
      const walker = doc.createTreeWalker(container, NodeFilter.SHOW_TEXT, {
        acceptNode(node: Node) {
          const parent = node.parentElement;
          if (!parent) return NodeFilter.FILTER_REJECT;
          const tag = parent.tagName.toLowerCase();
          if (
            tag === 'script' ||
            tag === 'style' ||
            parent.closest('.app-wiki-article__orbit-char') ||
            parent.closest('.app-wiki-article__text-ray') ||
            parent.closest('.app-wiki-article__censor') ||
            parent.closest('.app-wiki-article__strike')
          ) {
            return NodeFilter.FILTER_REJECT;
          }
          if (node.nodeValue && node.nodeValue.trim().length > 0) {
            return NodeFilter.FILTER_ACCEPT;
          }
          return NodeFilter.FILTER_SKIP;
        }
      });

      const textNodes: Text[] = [];
      while (walker.nextNode()) {
        textNodes.push(walker.currentNode as Text);
      }

      for (const textNode of textNodes) {
        const fullText = textNode.nodeValue || '';
        if (fullText.length === 0) continue;

        const hitChars: Array<{ index: number; char: string; t: number }> = [];

        for (let i = 0; i < fullText.length; i++) {
          const ch = fullText[i];
          if (ch === '\n' || ch === '\r' || ch === '\t') continue;

          try {
            range.setStart(textNode, i);
            range.setEnd(textNode, i + 1);
            const rect = range.getBoundingClientRect();
            if (rect.width === 0 && rect.height === 0) continue;

            const charX = rect.left + rect.width / 2;
            const charY = rect.top + scrollY + rect.height / 2;

            const u = ((charX - x1) * (x2 - x1) + (charY - y1) * (y2 - y1)) / (L * L);
            if (u < 0 || u > 1) continue;

            const projX = x1 + u * (x2 - x1);
            const projY = y1 + u * (y2 - y1);
            const dist = Math.hypot(charX - projX, charY - projY);

            if (dist <= 18) {
              hitChars.push({ index: i, char: ch, t: u });
            }
          } catch {
            // Ignore range boundary issues
          }
        }

        if (hitChars.length > 0) {
          const hitMap = new Map(hitChars.map((h) => [h.index, h.t]));
          const fragment = doc.createDocumentFragment();
          let textBuf = '';

          for (let i = 0; i < fullText.length; i++) {
            if (hitMap.has(i)) {
              if (textBuf) {
                fragment.appendChild(doc.createTextNode(textBuf));
                textBuf = '';
              }
              const t = hitMap.get(i)!;
              const delaySec = isReplay ? 0 : passDelaySec + t * durationSec;

              const span = doc.createElement('span');
              span.className = 'app-wiki-article__orbit-char';
              span.setAttribute('data-ray', String(r));
              span.style.setProperty('--hit-delay', `${delaySec.toFixed(2)}s`);
              span.innerHTML = `<span class="app-wiki-article__char-orig">${fullText[i]}</span><span class="app-wiki-article__char-zero">0</span>`;

              fragment.appendChild(span);
            } else {
              textBuf += fullText[i];
            }
          }
          if (textBuf) {
            fragment.appendChild(doc.createTextNode(textBuf));
          }

          textNode.replaceWith(fragment);
        }
      }
    }

    // B. AFFECT IMAGES ALONG THIS EXACT PATH
    imageWrappers.forEach((wrapper) => {
      const img = wrapper.querySelector('img');
      if (!img) return;

      const rect = wrapper.getBoundingClientRect();
      const rLeft = rect.left;
      const rTop = rect.top + scrollY;
      const rRight = rect.right;
      const rBottom = rect.bottom + scrollY;

      const clipped = clipLineToRect(x1, y1, x2, y2, rLeft, rTop, rRight, rBottom);
      if (!clipped) return;

      wrapper.setAttribute('data-traversed', 'true');
      const currentHits = Number(wrapper.getAttribute('data-hit-count') || 0) + 1;
      wrapper.setAttribute('data-hit-count', String(currentHits));

      const { t0, t1 } = clipped;
      const imgW = Math.max(60, wrapper.clientWidth || img.clientWidth || 300);
      const imgH = Math.max(40, wrapper.clientHeight || img.clientHeight || 200);

      const segX1 = Math.round(x1 + t0 * (x2 - x1) - rLeft);
      const segY1 = Math.round(y1 + t0 * (y2 - y1) - rTop);
      const segX2 = Math.round(x1 + t1 * (x2 - x1) - rLeft);
      const segY2 = Math.round(y1 + t1 * (y2 - y1) - rTop);
      const segLen = Math.max(10, Math.round(Math.hypot(segX2 - segX1, segY2 - segY1)));

      const entryDelaySec = isReplay ? 0 : parseFloat((t0 * durationSec).toFixed(2));
      const crossDurationSec = isReplay ? 0 : Math.max(0.2, parseFloat(((t1 - t0) * durationSec).toFixed(2)));
      const totalEntryDelaySec = isReplay ? 0 : passDelaySec + entryDelaySec;

      let svgOverlay = wrapper.querySelector<SVGSVGElement>('.app-wiki-article__image-orbit-svg');
      if (!svgOverlay) {
        svgOverlay = doc.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svgOverlay.setAttribute('class', 'app-wiki-article__image-orbit-svg');
        svgOverlay.setAttribute('viewBox', `0 0 ${imgW} ${imgH}`);
        svgOverlay.setAttribute('preserveAspectRatio', 'none');
        svgOverlay.style.cssText = `
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          pointer-events: none;
          z-index: 6;
          overflow: hidden;
        `;
        wrapper.appendChild(svgOverlay);
      }

      const g = doc.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.setAttribute('class', 'app-wiki-article__image-orbit-group');
      g.setAttribute('data-ray', String(r));

      const animStyle = isReplay
        ? ''
        : `animation: draw-image-orbit-streak ${crossDurationSec}s linear forwards; animation-delay: ${totalEntryDelaySec.toFixed(2)}s;`;
      const offset = isReplay ? '0' : String(segLen);

      g.innerHTML = `
        <line
          x1="${segX1}" y1="${segY1}" x2="${segX2}" y2="${segY2}"
          stroke="rgba(255, 255, 255, 0.25)"
          stroke-width="16"
          stroke-linecap="round"
          stroke-dasharray="${segLen}"
          stroke-dashoffset="${offset}"
          style="--image-orbit-len: ${segLen}; ${animStyle}"
        />
        <line
          x1="${segX1}" y1="${segY1}" x2="${segX2}" y2="${segY2}"
          stroke="rgba(255, 255, 255, 0.6)"
          stroke-width="6"
          stroke-linecap="round"
          stroke-dasharray="${segLen}"
          stroke-dashoffset="${offset}"
          style="--image-orbit-len: ${segLen}; ${animStyle}"
        />
        <line
          x1="${segX1}" y1="${segY1}" x2="${segX2}" y2="${segY2}"
          stroke="#ffffff"
          stroke-width="2.2"
          stroke-linecap="round"
          stroke-dasharray="${segLen}"
          stroke-dashoffset="${offset}"
          style="--image-orbit-len: ${segLen}; ${animStyle}"
        />
      `;
      svgOverlay.appendChild(g);

      // When too many lines (>= 3) cross this specific image, it collapses to the failed-to-load broken icon
      if (currentHits >= 3) {
        if (isReplay) {
          collapseImageToBrokenIcon(wrapper, doc);
        } else {
          const collapseDelayMs = Math.round((passDelaySec + entryDelaySec + crossDurationSec) * 1000);
          setTimeout(() => {
            collapseImageToBrokenIcon(wrapper, doc);
          }, collapseDelayMs);
        }
      }
    });
  }
};

const applyQualityLossImage = (doc: Document, force: number, isReplay: boolean = false) => {
  applyCombinedSatellitePass(doc, force, isReplay);
};

const applyRaysImage = (doc: Document, force: number, isReplay: boolean = false) => {
  applyCombinedSatellitePass(doc, force, isReplay);
};

const applyRaysText = (doc: Document, force: number, isReplay: boolean = false) => {
  applyCombinedSatellitePass(doc, force, isReplay);
};

// Falling letters attack: rips individual characters from scientific text, dropping them with gravity
const applyFallingLetters = (doc: Document, force: number) => {
  applyTextAttack(doc, fallingLetters, force);
};

// Applies progressive digital signal degradation based on breakdown progress (0.0 to 1.0)
const applyProgressiveBreakdown = (doc: Document, progress: number, isTotallyBroken: boolean) => {
  if (!doc || !doc.head) return;

  if (progress < 0.35 && !isTotallyBroken) {
    doc.getElementById('satellite-breakdown-style')?.remove();
    doc.getElementById('satellite-glitch-overlay')?.remove();
    return;
  }

  // 1. Inject SVG glitch displacement filters into the iframe if not already present
  if (!doc.getElementById('satellite-glitch-svg-defs')) {
    const glitchDefs = doc.createElement('div');
    glitchDefs.id = 'satellite-glitch-svg-defs';
    glitchDefs.style.cssText = 'position: absolute; width: 0; height: 0; pointer-events: none; overflow: hidden;';
    glitchDefs.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg">
        <defs>
          <filter id="satellite-glitch-displace-1" x="0%" y="0%" width="100%" height="100%">
            <feTurbulence type="fractalNoise" baseFrequency="0.04 0.9" numOctaves="1" result="noise" />
            <feDisplacementMap in="SourceGraphic" in2="noise" scale="8" xChannelSelector="R" yChannelSelector="G" />
          </filter>
          <filter id="satellite-glitch-displace-2" x="0%" y="0%" width="100%" height="100%">
            <feTurbulence type="fractalNoise" baseFrequency="0.02 0.75" numOctaves="2" result="noise" />
            <feDisplacementMap in="SourceGraphic" in2="noise" scale="14" xChannelSelector="G" yChannelSelector="R" />
          </filter>
          <filter id="satellite-glitch-displace-3" x="0%" y="0%" width="100%" height="100%">
            <feTurbulence type="fractalNoise" baseFrequency="0.06 0.98" numOctaves="1" result="noise" />
            <feDisplacementMap in="SourceGraphic" in2="noise" scale="22" xChannelSelector="B" yChannelSelector="B" />
          </filter>
        </defs>
      </svg>
    `;
    (doc.body || doc.documentElement).appendChild(glitchDefs);
  }

  // 2. Progressive CRT scanlines & chromatic horizontal tear bars overlay
  let glitchOverlay = doc.getElementById('satellite-glitch-overlay');
  if (!glitchOverlay && doc.body) {
    glitchOverlay = doc.createElement('div');
    glitchOverlay.id = 'satellite-glitch-overlay';
    doc.body.appendChild(glitchOverlay);
  }

  // Determine progressive stage intensity
  const isFull = isTotallyBroken || progress >= 1.0;
  const isSevere = progress >= 0.7;
  const overlayOpacity = isFull ? '0.85' : (isSevere ? '0.45' : '0.2');
  const animSpeed = isFull ? '2.4s' : (isSevere ? '3.6s' : '5.2s');

  let styleEl = doc.getElementById('satellite-breakdown-style') as HTMLStyleElement | null;
  if (!styleEl) {
    styleEl = doc.createElement('style');
    styleEl.id = 'satellite-breakdown-style';
    doc.head.appendChild(styleEl);
  }
  styleEl.textContent = `
    /* Progressive digital signal glitch filter without altering colors or blurring images */
    html, body {
      animation: page-glitch-jitter ${animSpeed} infinite steps(1) !important;
      will-change: transform, filter !important;
    }
    @keyframes page-glitch-jitter {
      0% {
        transform: none;
        filter: none;
      }
      6% {
        transform: translate(-2px, 1px);
        filter: url(#satellite-glitch-displace-1);
      }
      9% {
        transform: translate(2px, -1px);
        filter: url(#satellite-glitch-displace-2);
      }
      12% {
        transform: none;
        filter: none;
      }
      30% {
        transform: translate(1px, 0);
        filter: url(#satellite-glitch-displace-1);
      }
      33% {
        transform: translate(-3px, 1px);
        filter: url(#satellite-glitch-displace-3);
      }
      36% {
        transform: none;
        filter: none;
      }
      57% {
        transform: translate(-1px, -1px);
        filter: url(#satellite-glitch-displace-1);
      }
      60% {
        transform: translate(2px, 1px);
        filter: url(#satellite-glitch-displace-2);
      }
      63% {
        transform: none;
        filter: none;
      }
      80% {
        transform: translate(-2px, 0);
        filter: url(#satellite-glitch-displace-3);
      }
      83% {
        transform: translate(1px, -1px);
        filter: url(#satellite-glitch-displace-1);
      }
      86% {
        transform: none;
        filter: none;
      }
      100% {
        transform: none;
        filter: none;
      }
    }
    #satellite-glitch-overlay {
      position: fixed !important;
      top: 0 !important;
      left: 0 !important;
      width: 100vw !important;
      height: 100vh !important;
      pointer-events: none !important;
      z-index: 999999 !important;
      opacity: ${overlayOpacity} !important;
      transition: opacity 1.2s ease !important;
      background: repeating-linear-gradient(
        0deg,
        rgba(0, 0, 0, 0.05) 0px,
        rgba(0, 0, 0, 0.05) 1px,
        transparent 1px,
        transparent 3px
      ) !important;
      animation: glitch-scanline-flicker 0.12s infinite steps(2) !important;
    }
    #satellite-glitch-overlay::before,
    #satellite-glitch-overlay::after {
      content: '' !important;
      position: absolute !important;
      left: 0 !important;
      width: 100% !important;
      pointer-events: none !important;
    }
    #satellite-glitch-overlay::before {
      top: 25% !important;
      height: 12px !important;
      background: rgba(0, 240, 255, 0.14) !important;
      mix-blend-mode: color-dodge !important;
      animation: glitch-bar-sweep 2.2s infinite steps(1) !important;
    }
    #satellite-glitch-overlay::after {
      top: 65% !important;
      height: 7px !important;
      background: rgba(255, 0, 80, 0.14) !important;
      mix-blend-mode: color-dodge !important;
      animation: glitch-bar-sweep-2 2.8s infinite steps(1) !important;
    }
    @keyframes glitch-scanline-flicker {
      0% {
        opacity: 0.85;
        transform: translateY(0);
      }
      50% {
        opacity: 0.45;
        transform: translateY(1px);
      }
      100% {
        opacity: 0.9;
        transform: translateY(-1px);
      }
    }
    @keyframes glitch-bar-sweep {
      0% { top: 18%; height: 6px; transform: translateX(-8px); opacity: 0; }
      12% { top: 32%; height: 16px; transform: translateX(12px); opacity: 0.85; }
      15% { opacity: 0; }
      35% { top: 72%; height: 10px; transform: translateX(-18px); opacity: 0.9; }
      38% { opacity: 0; }
      72% { top: 48%; height: 22px; transform: translateX(8px); opacity: 0.8; }
      75% { opacity: 0; }
      100% { opacity: 0; }
    }
    @keyframes glitch-bar-sweep-2 {
      0% { top: 60%; height: 12px; transform: translateX(6px); opacity: 0; }
      22% { top: 12%; height: 8px; transform: translateX(-14px); opacity: 0.75; }
      25% { opacity: 0; }
      52% { top: 85%; height: 18px; transform: translateX(20px); opacity: 0.85; }
      55% { opacity: 0; }
      88% { top: 38%; height: 14px; transform: translateX(-10px); opacity: 0.8; }
      91% { opacity: 0; }
      100% { opacity: 0; }
    }
  `;
};

// Breaks all image URLs and collapses all images on the page when signal is totally broken
const breakAllImages = (doc: Document) => {
  if (!doc || !doc.body) return;

  doc.body.classList.add('is-signal-broken');

  const allImages = Array.from(doc.querySelectorAll<HTMLImageElement>('img')).filter((img) => {
    const src = img.getAttribute('src') || '';
    if (src.includes('badge') || src.includes('icon') || src.includes('symbol')) return false;
    return true;
  });

  allImages.forEach((img) => {
    // 1. Preserve original URL if not saved
    if (!img.getAttribute('data-orig-src')) {
      img.setAttribute('data-orig-src', img.getAttribute('src') || '');
    }

    // 2. Corrupt and break the image URL so it cannot load
    img.setAttribute('src', 'broken-signal://packet-loss-corrupted');
    img.removeAttribute('srcset');
    img.style.setProperty('display', 'none', 'important');
    img.style.setProperty('visibility', 'hidden', 'important');

    // 3. Find or create wrapper and collapse into broken image icon
    let wrapper = img.parentElement as HTMLElement | null;
    if (wrapper) {
      if (!wrapper.classList.contains('app-wiki-article__image-wrap') && !wrapper.closest('figure, .thumbinner, .mw-file-description')) {
        const wrap = doc.createElement('div');
        wrap.className = 'app-wiki-article__image-wrap';
        wrap.style.cssText = 'position: relative; display: inline-block; overflow: hidden; vertical-align: top;';
        img.replaceWith(wrap);
        wrap.appendChild(img);
        wrapper = wrap;
      }
      collapseImageToBrokenIcon(wrapper, doc);
    }
  });
};

// Apply total breakdown overlay style on critical limit reached:
const applyTotalBreakdown = (doc: Document) => {
  applyProgressiveBreakdown(doc, 1.0, true);
  breakAllImages(doc);
};

// Heal document in place without reloading
const healDoc = (doc: Document) => {
  if (!doc) return;
  doc.getElementById('satellite-breakdown-style')?.remove();
  doc.getElementById('satellite-glitch-svg-defs')?.remove();
  doc.getElementById('satellite-glitch-overlay')?.remove();
  doc.body?.classList.remove('is-earthquake');
  doc.body?.classList.remove('is-signal-broken');

  // Restore original image URLs
  doc.querySelectorAll<HTMLImageElement>('img').forEach((img) => {
    const orig = img.getAttribute('data-orig-src');
    if (orig) {
      img.setAttribute('src', orig);
      img.removeAttribute('data-orig-src');
      img.style.display = '';
      img.style.visibility = '';
    }
  });

  const imageStyle = doc.getElementById('satellite-attack-image-filter');
  if (imageStyle) {
    imageStyle.textContent = `
      img, figure, picture, .mw-file-element, .thumbimage {
        filter: none !important;
        transition: filter 2s ease-in-out !important;
      }
    `;
  }
  doc.querySelectorAll('.app-wiki-article__image-wrap').forEach((wrap) => {
    wrap.classList.remove('is-collapsed');
    wrap.removeAttribute('data-traversed');
    wrap.removeAttribute('data-hit-count');
    (wrap as HTMLElement).style.width = '';
    (wrap as HTMLElement).style.height = '';
    wrap.querySelector('.app-wiki-article__broken-placeholder')?.remove();
    wrap.querySelector('.app-wiki-article__image-orbit-svg')?.remove();
  });
  doc.querySelectorAll('.app-wiki-article__rays-overlay').forEach((el) => el.remove());
  doc.querySelectorAll('.app-wiki-article__image-orbit-svg').forEach((el) => el.remove());
  doc.getElementById('app-wiki-article-orbit-svg')?.remove();
  doc.getElementById('app-wiki-article-orbit-tracker')?.remove();
  if (cleanBodyHtml.value && doc.body) {
    doc.body.innerHTML = cleanBodyHtml.value;
  }
};

// Synchronize and apply ALL active satellite interference simultaneously across both text and images
const syncActiveAttacks = (isReplay: boolean = false) => {
  const doc = iframeRef.value?.contentDocument;
  if (!doc || !doc.body || !isDocReady.value) return;

  if (props.isTotallyBroken) {
    applyTotalBreakdown(doc);
    return;
  } else if ((props.breakdownProgress || 0) >= 0.35) {
    applyProgressiveBreakdown(doc, props.breakdownProgress || 0, false);
  }

  // Aggregate attacks across all commercial satellites currently active or recorded
  const sources = (props.activeDwellsList && props.activeDwellsList.length > 0)
    ? props.activeDwellsList
    : props.attackLog.map((a) => ({ attackType: a.attackType, force: a.force }));

  let totalCombinedForce = 0;
  let totalFallingLetters = 0;
  let totalConfidential = 0;
  let totalCrossWord = 0;

  for (const item of sources) {
    const f = item.force || 0;
    if (f <= 0) continue;

    if (
      item.attackType === 'satellitePass' ||
      item.attackType === 'raysText' ||
      item.attackType === 'raysImage' ||
      item.attackType === 'qualityLossImage'
    ) {
      totalCombinedForce += f;
    } else if (item.attackType === 'fallingLetters') {
      totalFallingLetters = Math.max(totalFallingLetters, f);
    } else if (item.attackType === 'confidentialRedact') {
      totalConfidential = Math.max(totalConfidential, f);
    } else if (item.attackType === 'crossWord') {
      totalCrossWord = Math.max(totalCrossWord, f);
    }
  }

  // Keep making lines continuously until total breakdown (up to 40 passes across the page)
  totalCombinedForce = Math.min(40, totalCombinedForce);

  if (totalCombinedForce > 0) {
    applyCombinedSatellitePass(doc, totalCombinedForce, isReplay);
  }
  if (totalFallingLetters > 0) {
    applyFallingLetters(doc, totalFallingLetters);
  }
  if (totalConfidential > 0) {
    applyTextAttack(doc, confidentialRedact, totalConfidential);
  }
  if (totalCrossWord > 0) {
    applyTextAttack(doc, crossWord, totalCrossWord);
  }
};

// Watch for cleanHtml changes to reset readiness before the new iframe loads
watch(
  () => props.cleanHtml,
  () => {
    isDocReady.value = false;
  }
);

const handleIframeLoad = () => {
  const doc = iframeRef.value?.contentDocument;
  if (!doc || !doc.body) return;

  isDocReady.value = true;
  cleanBodyHtml.value = doc.body.innerHTML;
  ensureAttackStyles(doc);

  // Replay any attacks that are active on this article
  syncActiveAttacks(true);
};

// Signature to react whenever any commercial satellite enters, escalates force, or logs damage
const attackStateSignature = computed(() => {
  const dwells = props.activeDwellsList || [];
  if (dwells.length > 0) {
    return dwells.map((d) => `${d.name}:${d.attackType}:${d.force}`).join('|');
  }
  return props.attackLog.map((a) => `${a.satelliteName}:${a.attackType}:${a.force}`).join('|');
});

watch(
  attackStateSignature,
  (newSig, oldSig) => {
    if (!isDocReady.value || props.isSecondUsbConnected) return;
    if (newSig && newSig !== oldSig) {
      syncActiveAttacks(false);
    }
  },
  { immediate: true }
);

watch(
  () => props.latestAttack,
  (latest) => {
    if (!latest || !isDocReady.value || props.isSecondUsbConnected) return;
    syncActiveAttacks(false);
  }
);

// Watch for progressive breakdown progression
watch(
  () => props.breakdownProgress,
  (progress) => {
    const doc = iframeRef.value?.contentDocument;
    if (!doc || !isDocReady.value || props.isSecondUsbConnected) return;
    applyProgressiveBreakdown(doc, progress || 0, props.isTotallyBroken);
  },
  { immediate: true }
);

// Watch for total breakdown
watch(
  () => props.isTotallyBroken,
  (broken) => {
    const doc = iframeRef.value?.contentDocument;
    if (!doc || !isDocReady.value || props.isSecondUsbConnected) return;
    if (broken) {
      applyTotalBreakdown(doc);
    }
  }
);

// Watch for healing
watch(
  () => props.isHealed,
  (healed) => {
    const doc = iframeRef.value?.contentDocument;
    if (!doc || !isDocReady.value) return;
    if (healed) {
      healDoc(doc);
    }
  }
);
</script>

<style lang="scss" scoped>
@use "~/assets/variables" as *;

.app-wiki-article {
  position: relative;
  display: flex;
  flex-direction: column;
  flex: 1;
  width: 100%;
  height: 100%;
  overflow: hidden;

  &--vibrating {
    animation: article-flyby-shake 2.4s cubic-bezier(0.4, 0, 0.2, 1) both;
  }

  &__saved-banner {
    position: absolute;
    top: $spacing-md;
    left: 50%;
    transform: translateX(-50%);
    z-index: 90;
    display: inline-flex;
    align-items: center;
    gap: $spacing-sm;
    padding: 6px 14px;
    background: rgba(255, 255, 255, 0.96);
    backdrop-filter: blur(8px);
    border: 1px solid $color-border;
    border-radius: $radius-sm;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
    font-family: $font-mono;
    font-size: $font-size-xs;
    color: $color-text;
    user-select: none;
    white-space: nowrap;
    max-width: calc(100vw - 32px);
    cursor: pointer;
    transition: all $transition-fast;

    &:hover {
      background: #ffffff;
      box-shadow: 0 4px 14px rgba(0, 0, 0, 0.08);
      border-color: #d1d5db;
    }

    @media (max-width: $breakpoint-md) {
      white-space: normal;
      flex-wrap: wrap;
      justify-content: center;
      text-align: center;
    }
  }

  &__saved-dot {
    width: 8px;
    height: 8px;
    border-radius: $radius-full;
    background-color: $color-usb-dot;
    box-shadow: 0 0 6px $color-usb-glow;
    flex-shrink: 0;
    display: inline-block;
    animation: usb-pulse 2s infinite ease-in-out;

    &--second {
      animation-delay: -1s;
    }
  }

  &__saved-title {
    font-weight: 700;
    color: $color-text;
    letter-spacing: -0.01em;
  }

  &__saved-sep {
    color: $color-text-faint;
  }

  &__saved-desc {
    color: $color-text-muted;
  }

  &__saved-status {
    color: $color-usb-dot;
    font-weight: 600;
  }

  &__saved-action {
    color: $color-text;
    font-weight: 600;
    text-decoration: underline;
    text-underline-offset: 2px;
  }

  &__saved-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 1100;
    background: rgba(0, 0, 0, 0.35);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: $spacing-md;
  }

  &__saved-modal {
    position: relative;
    width: 100%;
    max-width: 600px;
    background: #ffffff;
    border: 1px solid $color-border;
    border-radius: $radius-md;
    box-shadow: 0 24px 60px rgba(0, 0, 0, 0.18), 0 4px 12px rgba(0, 0, 0, 0.06);
    display: flex;
    flex-direction: column;
    padding: 24px 28px;
    font-family: $font-mono;
    user-select: none;

    @media (max-width: $breakpoint-sm) {
      padding: 18px 20px;
      max-width: calc(100vw - 32px);
    }
  }

  &__saved-modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-bottom: 12px;
    border-bottom: 1px solid $color-border;
    margin-bottom: 18px;
  }

  &__saved-modal-tag {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.06em;
    color: $color-text-muted;
    text-transform: uppercase;
  }

  &__saved-modal-close {
    background: transparent;
    border: none;
    font: inherit;
    font-size: 16px;
    cursor: pointer;
    color: $color-text-muted;
    padding: 2px 6px;
    line-height: 1;
    border-radius: $radius-sm;
    transition: all $transition-fast;

    &:hover {
      color: $color-primary;
      background: $color-surface-hover;
    }
  }

  &__saved-modal-body {
    display: flex;
    flex-direction: column;
  }

  &__saved-modal-title {
    font-size: 22px;
    font-weight: 700;
    color: $color-text;
    letter-spacing: -0.02em;
    margin: 0 0 10px 0;
    line-height: 1.25;
  }

  &__saved-modal-desc {
    font-size: 13px;
    color: $color-text-muted;
    line-height: 1.6;
    margin: 0 0 18px 0;

    code {
      font-family: $font-mono;
      background: $color-surface-hover;
      padding: 2px 6px;
      border-radius: $radius-sm;
      border: 1px solid $color-border;
      color: $color-text;
      font-weight: 600;
    }
  }

  &__saved-modal-grid {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-bottom: 22px;
  }

  &__saved-modal-card {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    padding: 10px 14px;
    background: #F9FAFB;
    border: 1px solid $color-border;
    border-radius: $radius-sm;
    font-size: 12px;

    @media (max-width: $breakpoint-sm) {
      flex-direction: column;
      align-items: flex-start;
      gap: 4px;
    }
  }

  &__saved-modal-card-label {
    color: $color-text-muted;
    font-weight: 500;
  }

  &__saved-modal-card-val {
    color: $color-text;
    font-weight: 600;
    text-align: right;

    @media (max-width: $breakpoint-sm) {
      text-align: left;
    }

    &--alert {
      color: $color-usb-dot;
      display: inline-flex;
      align-items: center;
      gap: 6px;

      &::before {
        content: "";
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background-color: $color-usb-dot;
        display: inline-block;
      }
    }
  }

  &__saved-modal-footer {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 10px;
    padding-top: 16px;
    border-top: 1px solid $color-border;

    @media (max-width: $breakpoint-sm) {
      flex-direction: column;
      width: 100%;
    }
  }

  &__saved-btn {
    font-family: $font-mono;
    font-size: 12px;
    font-weight: 600;
    padding: 8px 16px;
    border-radius: $radius-sm;
    cursor: pointer;
    transition: all $transition-fast;
    user-select: none;

    @media (max-width: $breakpoint-sm) {
      width: 100%;
      text-align: center;
    }

    &--primary {
      background: $color-text;
      color: #ffffff;
      border: 1px solid $color-text;

      &:hover {
        background: #222222;
        border-color: #222222;
      }
    }

    &--secondary {
      background: transparent;
      color: $color-text;
      border: 1px solid $color-border;

      &:hover {
        background: $color-surface-hover;
      }
    }
  }

  &__overlay-backdrop {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 1000;
    background: rgba(0, 0, 0, 0.24);
    backdrop-filter: blur(2px);
    display: flex;
    justify-content: center;
    align-items: flex-start;
    padding: 16px;
    overflow-y: auto;
  }

  &__overlay {
    position: sticky;
    top: 0;
    width: 100%;
    max-width: 980px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 14px 18px;
    background: rgba(255, 255, 255, 0.98);
    backdrop-filter: blur(14px);
    border: 1px solid $color-border;
    border-radius: $radius-md;
    box-shadow: 0 12px 36px rgba(0, 0, 0, 0.18);
    font-family: $font-mono;
    font-size: $font-size-xs;
  }

  &__overlay-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid $color-border;
    padding-bottom: 8px;
  }

  &__overlay-title {
    font-weight: 700;
    text-transform: uppercase;
    font-size: 11px;
    letter-spacing: 0.05em;
    color: $color-text-muted;
  }

  &__overlay-close {
    background: transparent;
    border: none;
    font: inherit;
    font-size: 15px;
    cursor: pointer;
    color: $color-text-muted;
    padding: 2px 8px;
    line-height: 1;
    border-radius: $radius-sm;
    transition: all $transition-fast;

    &:hover {
      color: $color-primary;
      background: $color-surface-hover;
    }
  }

  &__texte {
    flex: 1;
    min-width: 260px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  &__line {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 6px;
  }

  &__badge {
    padding: 1px 6px;
    border-radius: 2px;
    font-weight: 700;
    font-size: 10px;
    text-transform: uppercase;

    &--healed {
      background: $color-quaternary;
      color: $color-black;
    }

    &--broken {
      background: $color-primary;
      color: $color-white;
    }

    &--attacked {
      background: $color-commercial;
      color: $color-white;
    }

    &--usb {
      background: $color-usb-dot;
      color: $color-white;
    }

    &--usb-dual {
      background: #7c4dff;
      color: $color-white;
      box-shadow: 0 0 8px rgba(124, 77, 255, 0.5);
    }
  }

  &__etat {
    color: $color-text;
  }

  &__raison {
    color: $color-text-muted;
  }

  &__attacks-strip {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 6px;
    font-size: 11px;
  }

  &__attacks-label {
    color: $color-text-muted;
  }

  &__attack-chip {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 2px 6px;
    border: 1px solid $color-border;
    border-radius: 2px;
    background: $color-white;
    font-size: 10px;
    transition: all $transition-fast;

    &--confidentialRedact {
      border-color: #000;
      color: #000;
    }

    &--crossWord {
      border-color: $color-secondary;
      color: $color-secondary;
    }

    &--satellitePass {
      border-color: #111111;
      color: #111111;
      background: rgba(0, 0, 0, 0.05);
    }

    &--qualityLossImage {
      border-color: $color-primary;
      color: $color-primary;
    }

    &--raysImage {
      border-color: #888888;
      color: #333333;
    }

    &--raysText {
      border-color: #111111;
      color: #111111;
      background: rgba(0, 0, 0, 0.04);
    }

    &--fallingLetters {
      border-color: $color-secondary;
      color: $color-secondary;
    }

    &--exited {
      opacity: 0.6;
      border-style: dashed;
      background: $color-surface;
    }
  }

  &__live-dot {
    display: inline-block;
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background-color: $color-commercial;
    animation: live-pulse 1.4s infinite ease-in-out;
  }

  &__dwell {
    color: $color-text-muted;
    font-weight: 500;
  }

  &__dwell-exited {
    color: $color-text-muted;
    font-style: italic;
  }

  &__force {
    display: inline-block;
    padding: 0 4px;
    font-size: 9px;
    font-weight: 700;
    border-radius: 2px;
    background: $color-text;
    color: $color-white;

    &--intro {
      background: $color-border;
      color: $color-text-muted;
    }
  }

  &__actions {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  &__btn {
    font: inherit;
    padding: 4px 10px;
    background: $color-white;
    border: 1px solid $color-border;
    border-radius: $radius-sm;
    color: $color-text;
    cursor: pointer;
    transition: all $transition-fast;

    &:hover {
      border-color: $color-text;
      background: $color-surface-hover;
    }

    &--usb {
      border-color: $color-usb-dot;
      color: $color-usb-dot;
      font-weight: 600;

      &:hover {
        background: rgba(255, 59, 48, 0.08);
        border-color: $color-usb-dot;
      }
    }

    &--usb-dual {
      border-color: #7c4dff;
      color: #7c4dff;
      font-weight: 700;
      box-shadow: 0 0 6px rgba(124, 77, 255, 0.2);

      &:hover {
        background: rgba(124, 77, 255, 0.12);
        border-color: #7c4dff;
      }
    }
  }

  &__link {
    font: inherit;
    padding: 4px 10px;
    color: $color-text;
    text-decoration: underline;
    text-underline-offset: 3px;

    &:hover {
      color: $color-primary;
    }
  }

  &__cadre {
    flex: 1;
    width: 100%;
    height: 100%;
    border: 0;
    background: #ffffff;
    display: block;
  }

  &--vibrating {
    animation: earthquake-rumble 0.68s cubic-bezier(0.36, 0.07, 0.19, 0.97) both;
  }
}

@keyframes earthquake-rumble {
  0% { transform: translate(0, 0) rotate(0deg); }
  10% { transform: translate(-3px, 2px) rotate(-0.3deg); }
  20% { transform: translate(4px, -3px) rotate(0.4deg); }
  30% { transform: translate(-4px, -2px) rotate(-0.3deg); }
  40% { transform: translate(3px, 3px) rotate(0.3deg); }
  50% { transform: translate(-3px, -3px) rotate(-0.2deg); }
  60% { transform: translate(3px, 2px) rotate(0.2deg); }
  70% { transform: translate(-2px, 2px) rotate(-0.1deg); }
  80% { transform: translate(2px, -1px) rotate(0.1deg); }
  90% { transform: translate(-1px, 1px) rotate(0deg); }
  100% { transform: translate(0, 0) rotate(0deg); }
}

@keyframes live-pulse {
  0% {
    transform: scale(0.85);
    opacity: 0.4;
  }
  50% {
    transform: scale(1.3);
    opacity: 1;
  }
  100% {
    transform: scale(0.85);
    opacity: 0.4;
  }
}

.overlay-fade-enter-active,
.overlay-fade-leave-active {
  transition: opacity 0.22s ease;

  .app-wiki-article__overlay {
    transition: transform 0.24s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.22s ease;
  }
}

.overlay-fade-enter-from,
.overlay-fade-leave-to {
  opacity: 0;

  .app-wiki-article__overlay {
    opacity: 0;
    transform: translateY(-12px) scale(0.98);
  }
}

.banner-slide-enter-active,
.banner-slide-leave-active {
  transition: all $transition-base;
}

.banner-slide-enter-from,
.banner-slide-leave-to {
  opacity: 0;
  transform: translate(-50%, -15px);
}

.modal-pop-enter-active,
.modal-pop-leave-active {
  transition: opacity 0.22s ease;

  .app-wiki-article__saved-modal {
    transition: transform 0.24s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.22s ease;
  }
}

.modal-pop-enter-from,
.modal-pop-leave-to {
  opacity: 0;

  .app-wiki-article__saved-modal {
    opacity: 0;
    transform: scale(0.95) translateY(12px);
  }
}

@keyframes article-flyby-shake {
  0% { transform: translate(0, 0); }
  25% { transform: translate(0.15px, -0.15px); }
  50% { transform: translate(-0.35px, 0.3px); }
  75% { transform: translate(0.15px, -0.15px); }
  100% { transform: translate(0, 0); }
}
</style>
