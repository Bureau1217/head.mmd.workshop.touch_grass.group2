/**
 * Attack Script: Quality Loss Image
 * Degrades image quality with genuine digital compression artifacts:
 * - Blocky pixelation / low-resolution mosaic (via morphological block quantization)
 * - Color depth reduction / posterization (harsh banding from 24-bit to 8-bit/4-bit)
 * - Contrast compression & JPEG transmission noise
 *
 * NO standard gaussian blur is used — this produces authentic digital signal degradation.
 */

export function qualityLossImage(input: string = '', force: number = 1, threshold: number = 1): string {
  if (force < threshold) {
    return input || 'none';
  }

  const excess = force - threshold + 1;

  // Real digital quality loss:
  // - High contrast to blow out shadows & highlights (loss of dynamic range)
  // - Desaturate / shift colors (chroma subsampling 4:2:0)
  // - SVG filter url(#satellite-pixel-degrade) for blocky pixelation & posterization
  const contrastPct = Math.min(260, Math.round(115 + excess * 14));
  const saturatePct = Math.max(25, Math.round(90 - excess * 6.5));
  const brightnessPct = Math.max(65, Math.round(100 - excess * 2.5));

  // The custom SVG filter produces true pixelation and discrete color posterization
  const filter = `url(#satellite-pixel-degrade-${Math.min(5, Math.max(1, Math.ceil(excess / 2)))}) contrast(${contrastPct}%) saturate(${saturatePct}%) brightness(${brightnessPct}%)`;

  if (!input || input === 'none') {
    return filter;
  }

  if (/filter\s*:/i.test(input)) {
    return input.replace(/filter\s*:\s*[^;]+;?/i, `filter: ${filter} !important;`);
  }

  return `${input.trim().replace(/;?$/, ';')} filter: ${filter} !important;`;
}

/**
 * Returns SVG filter definitions injected into the document to achieve
 * true pixel block quantization and color posterization across 5 force tiers.
 */
export function getPixelDegradeSvgFilters(): string {
  return `
    <svg xmlns="http://www.w3.org/2000/svg" style="display: none;">
      <defs>
        <!-- Tier 1: Light Pixelation (Radius 2px, 8-level color quantization) -->
        <filter id="satellite-pixel-degrade-1" x="0%" y="0%" width="100%" height="100%">
          <feMorphology operator="erode" radius="1.5" result="e1" />
          <feMorphology operator="dilate" radius="1.5" in="e1" result="d1" />
          <feComponentTransfer in="d1">
            <feFuncR type="discrete" tableValues="0 0.14 0.28 0.42 0.57 0.71 0.85 1" />
            <feFuncG type="discrete" tableValues="0 0.14 0.28 0.42 0.57 0.71 0.85 1" />
            <feFuncB type="discrete" tableValues="0 0.14 0.28 0.42 0.57 0.71 0.85 1" />
          </feComponentTransfer>
        </filter>

        <!-- Tier 2: Moderate Pixelation (Radius 3px, 6-level color banding) -->
        <filter id="satellite-pixel-degrade-2" x="0%" y="0%" width="100%" height="100%">
          <feMorphology operator="erode" radius="3" result="e2" />
          <feMorphology operator="dilate" radius="3" in="e2" result="d2" />
          <feComponentTransfer in="d2">
            <feFuncR type="discrete" tableValues="0 0.2 0.4 0.6 0.8 1" />
            <feFuncG type="discrete" tableValues="0 0.2 0.4 0.6 0.8 1" />
            <feFuncB type="discrete" tableValues="0 0.25 0.5 0.75 1" />
          </feComponentTransfer>
        </filter>

        <!-- Tier 3: Chunky Pixelation (Radius 5px, 5-level color banding) -->
        <filter id="satellite-pixel-degrade-3" x="0%" y="0%" width="100%" height="100%">
          <feMorphology operator="erode" radius="5" result="e3" />
          <feMorphology operator="dilate" radius="5" in="e3" result="d3" />
          <feComponentTransfer in="d3">
            <feFuncR type="discrete" tableValues="0 0.25 0.5 0.75 1" />
            <feFuncG type="discrete" tableValues="0 0.25 0.5 0.75 1" />
            <feFuncB type="discrete" tableValues="0 0.33 0.66 1" />
          </feComponentTransfer>
        </filter>

        <!-- Tier 4: Severe Low-Bitrate Pixelation (Radius 8px, 4-level quantization) -->
        <filter id="satellite-pixel-degrade-4" x="0%" y="0%" width="100%" height="100%">
          <feMorphology operator="erode" radius="8" result="e4" />
          <feMorphology operator="dilate" radius="8" in="e4" result="d4" />
          <feComponentTransfer in="d4">
            <feFuncR type="discrete" tableValues="0 0.33 0.66 1" />
            <feFuncG type="discrete" tableValues="0 0.33 0.66 1" />
            <feFuncB type="discrete" tableValues="0 0.5 1" />
          </feComponentTransfer>
        </filter>

        <!-- Tier 5: Extreme 8-Bit Mosaic (Radius 12px, 3-level extreme posterize) -->
        <filter id="satellite-pixel-degrade-5" x="0%" y="0%" width="100%" height="100%">
          <feMorphology operator="erode" radius="12" result="e5" />
          <feMorphology operator="dilate" radius="12" in="e5" result="d5" />
          <feComponentTransfer in="d5">
            <feFuncR type="discrete" tableValues="0 0.5 1" />
            <feFuncG type="discrete" tableValues="0 0.5 1" />
            <feFuncB type="discrete" tableValues="0 1" />
          </feComponentTransfer>
        </filter>
      </defs>
    </svg>
  `.trim();
}

export default qualityLossImage;
