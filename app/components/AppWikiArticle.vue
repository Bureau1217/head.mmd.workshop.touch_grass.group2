<template>
  <div class="app-wiki-article">
    <!-- Top Control & Status Bar (matching WikiArticle.vue layout) -->
    <div class="app-wiki-article__barre">
      <div class="app-wiki-article__texte">
        <!-- Scientific Satellite Status & Reason -->
        <div class="app-wiki-article__line">
          <span v-if="isHealed" class="app-wiki-article__badge app-wiki-article__badge--healed">Page guérie</span>
          <span v-else-if="isTotallyBroken" class="app-wiki-article__badge app-wiki-article__badge--broken">Signal détruit</span>
          <span v-else-if="attackLog.length > 0" class="app-wiki-article__badge app-wiki-article__badge--attacked">{{ attackLog.length }} {{ attackLog.length === 1 ? 'attaque' : 'attaques' }}</span>

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

        <!-- Attacks History / Commercial Satellite Activity -->
        <div v-if="attackLog.length > 0" class="app-wiki-article__attacks-strip">
          <span class="app-wiki-article__attacks-label">Attaques persistantes :</span>
          <span
            v-for="(item, idx) in attackLog"
            :key="`${item.satelliteName}-${idx}`"
            class="app-wiki-article__attack-chip"
            :class="`app-wiki-article__attack-chip--${item.attackType}`"
          >
            {{ item.satelliteName }} → {{ formatAttackName(item.attackType) }}
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
import { ref, watch } from 'vue';
import type { NearestSatellite } from '~/types/satellite';
import {
  crossWord,
  confidentialRedact,
  qualityLossImage,
  type AttackEvent,
  type AttackType
} from '~/attackScript';

const props = defineProps<{
  closestScientific: NearestSatellite | null;
  currentTitle: string;
  urlCadre: string;
  urlOuvrir: string;
  cleanHtml: string;
  attackedHtml: string;
  imageFilter: string;
  attackLog: AttackEvent[];
  latestAttack: AttackEvent | null;
  isTotallyBroken: boolean;
  criticalSatelliteLimit: number;
  isHealed: boolean;
  healedBySatName: string | null;
  isLoading: boolean;
}>();

const emit = defineEmits<{
  testJump: [];
}>();

const iframeRef = ref<HTMLIFrameElement | null>(null);
const cleanBodyHtml = ref<string>('');
const isDocReady = ref<boolean>(false);

const formatAttackName = (type: AttackType): string => {
  if (type === 'confidentialRedact') return 'Fichier Confidentiel (Noir)';
  if (type === 'crossWord') return 'Rayer mots (Barre)';
  if (type === 'qualityLossImage') return 'Dégradation Image';
  return type;
};

// Traverse and modify raw text nodes safely in the iframe DOM without re-rendering or flash
const applyTextAttack = (
  doc: Document,
  attackFn: (text: string, force: number) => string,
  force: number
) => {
  if (!doc || !doc.body) return;

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
          parent.closest('del.app-wiki-article__strike')
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
const applyQualityLossImage = (doc: Document, force: number) => {
  if (!doc || !doc.head) return;
  let styleEl = doc.getElementById('satellite-attack-image-filter') as HTMLStyleElement | null;
  if (!styleEl) {
    styleEl = doc.createElement('style');
    styleEl.id = 'satellite-attack-image-filter';
    doc.head.appendChild(styleEl);
  }
  const filter = qualityLossImage('', force);
  styleEl.textContent = `
    img, figure, picture, .mw-file-element, .thumbimage {
      filter: ${filter} !important;
      transition: filter 0.6s cubic-bezier(0.4, 0, 0.2, 1) !important;
    }
  `;
};

// Apply total breakdown overlay style on critical limit reached
const applyTotalBreakdown = (doc: Document) => {
  if (!doc || !doc.head) return;
  let styleEl = doc.getElementById('satellite-breakdown-style') as HTMLStyleElement | null;
  if (!styleEl) {
    styleEl = doc.createElement('style');
    styleEl.id = 'satellite-breakdown-style';
    doc.head.appendChild(styleEl);
  }
  styleEl.textContent = `
    body {
      background-color: #050505 !important;
      color: #333333 !important;
      filter: invert(100%) !important;
      transition: filter 1s ease !important;
    }
    img, figure, picture, .mw-file-element, .thumbimage {
      filter: blur(28px) brightness(15%) contrast(20%) grayscale(100%) !important;
    }
    .app-wiki-article__censor {
      background-color: #ffffff !important;
      color: #ffffff !important;
    }
  `;
};

// Heal document in place without reloading
const healDoc = (doc: Document) => {
  if (!doc) return;
  doc.getElementById('satellite-breakdown-style')?.remove();
  const imageStyle = doc.getElementById('satellite-attack-image-filter');
  if (imageStyle) {
    imageStyle.textContent = `
      img, figure, picture, .mw-file-element, .thumbimage {
        filter: none !important;
        transition: filter 0.8s ease !important;
      }
    `;
  }
  if (cleanBodyHtml.value && doc.body) {
    doc.body.innerHTML = cleanBodyHtml.value;
  }
};

// Replay existing attacks on fresh document load
const replayAllAttacks = (doc: Document) => {
  if (!doc) return;
  if (props.isTotallyBroken) {
    applyTotalBreakdown(doc);
    return;
  }
  for (const item of props.attackLog) {
    const f = item.force || 1;
    if (item.attackType === 'confidentialRedact') {
      applyTextAttack(doc, confidentialRedact, f);
    } else if (item.attackType === 'crossWord') {
      applyTextAttack(doc, crossWord, f);
    } else if (item.attackType === 'qualityLossImage') {
      applyQualityLossImage(doc, f);
    }
  }
};

const handleIframeLoad = () => {
  const doc = iframeRef.value?.contentDocument;
  if (!doc || !doc.body) return;

  isDocReady.value = true;
  cleanBodyHtml.value = doc.body.innerHTML;

  // Replay any attacks that fired during document loading
  if (props.attackLog.length > 0) {
    replayAllAttacks(doc);
  }
};

// Live attack watcher: applies attack in-place to iframe DOM without white flash or scroll reset
watch(
  () => props.latestAttack,
  (attack) => {
    if (!attack || !isDocReady.value) return;
    const doc = iframeRef.value?.contentDocument;
    if (!doc) return;

    if (props.isTotallyBroken) {
      applyTotalBreakdown(doc);
      return;
    }

    const force = attack.force || 1;
    if (attack.attackType === 'confidentialRedact') {
      applyTextAttack(doc, confidentialRedact, force);
    } else if (attack.attackType === 'crossWord') {
      applyTextAttack(doc, crossWord, force);
    } else if (attack.attackType === 'qualityLossImage') {
      applyQualityLossImage(doc, force);
    }
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
  display: flex;
  flex-direction: column;
  flex: 1;
  width: 100%;
  height: calc(100vh - 54px);
  overflow: hidden;

  &__barre {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px 16px;
    padding: 10px 16px;
    background: $color-surface;
    border-bottom: 1px solid $color-border;
    font-family: $font-mono;
    font-size: $font-size-xs;
    flex-shrink: 0;
  }

  &__texte {
    flex: 1;
    min-width: 260px;
    display: flex;
    flex-direction: column;
    gap: 4px;
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
    gap: 4px;
    font-size: 11px;
  }

  &__attacks-label {
    color: $color-text-muted;
  }

  &__attack-chip {
    padding: 1px 5px;
    border: 1px solid $color-border;
    border-radius: 2px;
    background: $color-white;
    font-size: 10px;

    &--confidentialRedact {
      border-color: #000;
      color: #000;
      font-weight: 700;
    }

    &--crossWord {
      border-color: $color-secondary;
      color: $color-secondary;
    }

    &--qualityLossImage {
      border-color: $color-primary;
      color: $color-primary;
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
</style>
