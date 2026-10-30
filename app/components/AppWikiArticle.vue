<template>
  <div class="app-wiki-article">
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
              <span v-if="isHealed" class="app-wiki-article__badge app-wiki-article__badge--healed">Page guérie</span>
              <span v-else-if="isTotallyBroken" class="app-wiki-article__badge app-wiki-article__badge--broken">Signal détruit</span>
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
                <span v-else class="app-wiki-article__force app-wiki-article__force--intro">Approche</span>
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
import { ref, computed, watch } from 'vue';
import type { NearestSatellite } from '~/types/satellite';
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
    isTotallyBroken: boolean;
    criticalSatelliteLimit: number;
    isHealed: boolean;
    healedBySatName: string | null;
    isLoading: boolean;
  }>(),
  {
    showOverlay: false,
    activeDwellsList: () => []
  }
);

const emit = defineEmits<{
  (e: 'testJump'): void;
  (e: 'closeOverlay'): void;
}>();

const iframeRef = ref<HTMLIFrameElement | null>(null);
const cleanBodyHtml = ref<string>('');
const isDocReady = ref<boolean>(false);

const activeCommercialCount = computed(() => {
  return props.activeDwellsList?.filter((d) => d.inZone).length || 0;
});

const maxForce = computed(() => {
  if (!props.activeDwellsList || props.activeDwellsList.length === 0) return 0;
  return Math.max(...props.activeDwellsList.map((d) => d.force), 0);
});

const formatAttackName = (type: AttackType): string => {
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

// Smooth CSS filter attack on all images in the iframe
// Delegated to applyRaysImage so images never suffer whole-image blur, but receive authentic diagonal satellite glare streaks
const applyQualityLossImage = (doc: Document, force: number, isReplay: boolean = false) => {
  if (!doc || !doc.body) return;
  applyRaysImage(doc, force, isReplay);
};

// Satellite ray trails attack: draws non-horizontal optical streak lines across scientific images simulating real satellite constellation glares.
// Ray tracks accumulate across force increases without resetting existing rays.
const applyRaysImage = (doc: Document, force: number, isReplay: boolean = false) => {
  if (!doc || !doc.body) return;
  ensureAttackStyles(doc);

  const images = Array.from(
    doc.querySelectorAll<HTMLImageElement>('img')
  ).filter((img) => {
    const src = img.getAttribute('src') || '';
    if (src.includes('badge') || src.includes('icon') || src.includes('symbol')) return false;
    const w = img.clientWidth || img.naturalWidth || parseInt(img.getAttribute('width') || '100', 10);
    const h = img.clientHeight || img.naturalHeight || parseInt(img.getAttribute('height') || '100', 10);
    return w >= 60 && h >= 40;
  });

  if (images.length === 0) {
    return;
  }

  const targetRayCount = Math.min(10, Math.max(1, force));

  images.forEach((img, index) => {
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

    const imgW = img.clientWidth || img.naturalWidth || parseInt(img.getAttribute('width') || '300', 10);
    const imgH = img.clientHeight || img.naturalHeight || parseInt(img.getAttribute('height') || '200', 10);

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

    const currentRayCount = svgOverlay.querySelectorAll('.app-wiki-article__image-orbit-group').length;
    // Append only NEW rays so existing rays never restart from zero
    for (let r = currentRayCount; r < targetRayCount; r++) {
      const groupMarkup = createImageOrbitRaySvgGroup(r, imgW, imgH, index, isReplay);
      const parser = new DOMParser();
      const parsedDoc = parser.parseFromString(
        `<svg xmlns="http://www.w3.org/2000/svg">${groupMarkup}</svg>`,
        'image/svg+xml'
      );
      const gEl = parsedDoc.querySelector('.app-wiki-article__image-orbit-group');
      if (gEl) {
        svgOverlay.appendChild(doc.importNode(gEl, true));
      }
    }
  });
};

// Satellite orbital track attack: draws a non-horizontal virtual line across the screen that linearly converts touching characters to '0'
// Cumulative across force levels without resetting previously created orbital lines.
const applyRaysText = (doc: Document, force: number, isReplay: boolean = false) => {
  if (!doc || !doc.body) return;
  ensureAttackStyles(doc);

  const targetRayCount = Math.min(10, Math.max(1, force));
  const existingTracks = doc.querySelectorAll('.app-wiki-article__orbit-group');
  const currentRayCount = existingTracks.length;

  if (currentRayCount >= targetRayCount) return;

  const viewportWidth = doc.documentElement.clientWidth || doc.body.clientWidth || 900;
  const viewportHeight = doc.defaultView?.innerHeight || 700;
  const scrollY = doc.defaultView?.scrollY || 0;

  // Track applied virtual rays via an invisible tracker container (no visual line across text!)
  let trackerContainer = doc.getElementById('app-wiki-article-orbit-tracker') as HTMLElement | null;
  if (!trackerContainer) {
    trackerContainer = doc.createElement('div');
    trackerContainer.id = 'app-wiki-article-orbit-tracker';
    trackerContainer.style.display = 'none';
    doc.body.appendChild(trackerContainer);
  }

  // Find candidate content containers
  const containers = Array.from(
    doc.querySelectorAll<HTMLElement>('p, li, dd, dt, blockquote, td, th, h2, h3, figcaption')
  ).filter((el) => {
    if (el.closest('#mw-navigation, #toc, .mw-jump-link, .navbox')) return false;
    return (el.textContent || '').trim().length > 0;
  });

  for (let r = currentRayCount; r < targetRayCount; r++) {
    const coords = getOrbitRayCoordinates(r, viewportWidth, viewportHeight, scrollY);
    const { x1, y1, x2, y2, length: L, durationSec } = coords;

    // Line bounding box
    const lineMinX = Math.min(x1, x2) - 30;
    const lineMaxX = Math.max(x1, x2) + 30;
    const lineMinY = Math.min(y1, y2) - 30;
    const lineMaxY = Math.max(y1, y2) + 30;

    // Invisible marker tracking ray index r (no visual line drawn across the screen!)
    const groupMarker = doc.createElement('span');
    groupMarker.className = 'app-wiki-article__orbit-group';
    groupMarker.setAttribute('data-ray', String(r));
    trackerContainer.appendChild(groupMarker);

    // 2. Find intersecting containers and convert touching characters to '0' along the virtual diagonal trajectory
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

            // Projection onto the line segment
            const u = ((charX - x1) * (x2 - x1) + (charY - y1) * (y2 - y1)) / (L * L);
            if (u < 0 || u > 1) continue;

            const projX = x1 + u * (x2 - x1);
            const projY = y1 + u * (y2 - y1);
            const dist = Math.hypot(charX - projX, charY - projY);

            // Touching tolerance: 16px (width of satellite interference beam)
            if (dist <= 16) {
              hitChars.push({ index: i, char: ch, t: u });
            }
          } catch {
            // Ignore range errors
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
              const delaySec = isReplay ? 0 : t * durationSec;

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
  }
};

// Falling letters attack: rips individual characters from scientific text, dropping them with gravity
const applyFallingLetters = (doc: Document, force: number) => {
  applyTextAttack(doc, fallingLetters, force);
};

// Apply total breakdown overlay style on critical limit reached:
// Applies a dynamic glitch filter on the whole page without altering page colors or blurring images
const applyTotalBreakdown = (doc: Document) => {
  if (!doc || !doc.head) return;

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
            <feDisplacementMap in="SourceGraphic" in2="noise" scale="14" xChannelSelector="R" yChannelSelector="G" />
          </filter>
          <filter id="satellite-glitch-displace-2" x="0%" y="0%" width="100%" height="100%">
            <feTurbulence type="fractalNoise" baseFrequency="0.02 0.75" numOctaves="2" result="noise" />
            <feDisplacementMap in="SourceGraphic" in2="noise" scale="22" xChannelSelector="G" yChannelSelector="R" />
          </filter>
          <filter id="satellite-glitch-displace-3" x="0%" y="0%" width="100%" height="100%">
            <feTurbulence type="fractalNoise" baseFrequency="0.06 0.98" numOctaves="1" result="noise" />
            <feDisplacementMap in="SourceGraphic" in2="noise" scale="32" xChannelSelector="B" yChannelSelector="B" />
          </filter>
        </defs>
      </svg>
    `;
    (doc.body || doc.documentElement).appendChild(glitchDefs);
  }

  // 2. Inject CRT scanlines & chromatic horizontal tear bars overlay
  if (!doc.getElementById('satellite-glitch-overlay') && doc.body) {
    const glitchOverlay = doc.createElement('div');
    glitchOverlay.id = 'satellite-glitch-overlay';
    doc.body.appendChild(glitchOverlay);
  }

  // 3. Inject glitch CSS animation on the whole page without altering base colors or blurring images
  let styleEl = doc.getElementById('satellite-breakdown-style') as HTMLStyleElement | null;
  if (!styleEl) {
    styleEl = doc.createElement('style');
    styleEl.id = 'satellite-breakdown-style';
    doc.head.appendChild(styleEl);
  }
  styleEl.textContent = `
    /* Full-page digital signal glitch filter without altering colors or blurring images */
    html, body {
      animation: page-glitch-jitter 2.6s infinite steps(1) !important;
      will-change: transform, filter !important;
    }
    @keyframes page-glitch-jitter {
      0% {
        transform: none;
        filter: none;
      }
      6% {
        transform: translate(-3px, 1px) skewX(-0.6deg);
        filter: url(#satellite-glitch-displace-1);
      }
      9% {
        transform: translate(4px, -1px) skewX(0.8deg);
        filter: url(#satellite-glitch-displace-2);
      }
      12% {
        transform: none;
        filter: none;
      }
      30% {
        transform: translate(2px, 0) skewX(0.4deg);
        filter: url(#satellite-glitch-displace-1);
      }
      33% {
        transform: translate(-5px, 2px) skewX(-1.2deg);
        filter: url(#satellite-glitch-displace-3);
      }
      36% {
        transform: none;
        filter: none;
      }
      57% {
        transform: translate(-2px, -1px);
        filter: url(#satellite-glitch-displace-1);
      }
      60% {
        transform: translate(3px, 1px) skewX(0.7deg);
        filter: url(#satellite-glitch-displace-2);
      }
      63% {
        transform: none;
        filter: none;
      }
      80% {
        transform: translate(-4px, 0) skewX(-0.9deg);
        filter: url(#satellite-glitch-displace-3);
      }
      83% {
        transform: translate(2px, -1px) skewX(0.4deg);
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
      height: 14px !important;
      background: rgba(0, 240, 255, 0.16) !important;
      mix-blend-mode: color-dodge !important;
      animation: glitch-bar-sweep 1.8s infinite steps(1) !important;
    }
    #satellite-glitch-overlay::after {
      top: 65% !important;
      height: 8px !important;
      background: rgba(255, 0, 80, 0.16) !important;
      mix-blend-mode: color-dodge !important;
      animation: glitch-bar-sweep-2 2.3s infinite steps(1) !important;
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

// Heal document in place without reloading
const healDoc = (doc: Document) => {
  if (!doc) return;
  doc.getElementById('satellite-breakdown-style')?.remove();
  doc.getElementById('satellite-glitch-svg-defs')?.remove();
  doc.getElementById('satellite-glitch-overlay')?.remove();
  const imageStyle = doc.getElementById('satellite-attack-image-filter');
  if (imageStyle) {
    imageStyle.textContent = `
      img, figure, picture, .mw-file-element, .thumbimage {
        filter: none !important;
        transition: filter 2s ease-in-out !important;
      }
    `;
  }
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
  }

  // Aggregate attacks across all commercial satellites currently active or recorded
  const sources = (props.activeDwellsList && props.activeDwellsList.length > 0)
    ? props.activeDwellsList
    : props.attackLog.map((a) => ({ attackType: a.attackType, force: a.force }));

  let totalRaysText = 0;
  let totalRaysImage = 0;
  let totalFallingLetters = 0;
  let totalConfidential = 0;
  let totalCrossWord = 0;

  for (const item of sources) {
    const f = item.force || 0;
    if (f <= 0) continue;

    if (item.attackType === 'raysText') {
      totalRaysText += f;
    } else if (item.attackType === 'raysImage' || item.attackType === 'qualityLossImage') {
      totalRaysImage += f;
    } else if (item.attackType === 'fallingLetters') {
      totalFallingLetters = Math.max(totalFallingLetters, f);
    } else if (item.attackType === 'confidentialRedact') {
      totalConfidential = Math.max(totalConfidential, f);
    } else if (item.attackType === 'crossWord') {
      totalCrossWord = Math.max(totalCrossWord, f);
    }
  }

  // Check if article has images; if none, transfer image rays to text so interference is never invisible
  const suitableImages = Array.from(doc.querySelectorAll<HTMLImageElement>('img')).filter((img) => {
    const src = img.getAttribute('src') || '';
    if (src.includes('badge') || src.includes('icon') || src.includes('symbol')) return false;
    const w = img.clientWidth || img.naturalWidth || parseInt(img.getAttribute('width') || '100', 10);
    const h = img.clientHeight || img.naturalHeight || parseInt(img.getAttribute('height') || '100', 10);
    return w >= 60 && h >= 40;
  });

  if (suitableImages.length === 0 && totalRaysImage > 0) {
    totalRaysText += totalRaysImage;
    totalRaysImage = 0;
  }

  // Cap at 10 rays to maintain visual readability and performance
  totalRaysText = Math.min(10, totalRaysText);
  totalRaysImage = Math.min(10, totalRaysImage);

  // Apply BOTH text and image attacks SIMULTANEOUSLY!
  if (totalRaysText > 0) {
    applyRaysText(doc, totalRaysText, isReplay);
  }
  if (totalRaysImage > 0) {
    applyRaysImage(doc, totalRaysImage, isReplay);
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
    if (!isDocReady.value) return;
    if (newSig && newSig !== oldSig) {
      syncActiveAttacks(false);
    }
  },
  { immediate: true }
);

watch(
  () => props.latestAttack,
  (latest) => {
    if (!latest || !isDocReady.value) return;
    syncActiveAttacks(false);
  }
);

// Watch for total breakdown
watch(
  () => props.isTotallyBroken,
  (broken) => {
    const doc = iframeRef.value?.contentDocument;
    if (!doc || !isDocReady.value) return;
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
</style>
