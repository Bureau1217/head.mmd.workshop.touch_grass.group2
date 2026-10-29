/**
 * Attack Script: Quality Loss Image
 * Degrades image quality (blur, contrast drop, pixelation, lossy compression)
 * scaling higher for each commercial satellite attack targeting the image.
 *
 * @param input - The original image URL or style string
 * @param force - The number of attacks launched against the image
 * @param threshold - The minimum force required to trigger the attack (default: 1)
 * @returns The CSS filter string
 */
export function qualityLossImage(input: string = '', force: number = 1, threshold: number = 1): string {
  if (force < threshold) {
    return input || 'none';
  }

  const excess = force - threshold + 1;

  const blurPx = Math.min(24, Math.round(excess * 4));
  const contrastPct = Math.max(25, 100 - excess * 20);
  const saturatePct = Math.max(10, 100 - excess * 25);
  const brightnessPct = Math.max(40, 100 - excess * 12);

  const filter = `blur(${blurPx}px) contrast(${contrastPct}%) saturate(${saturatePct}%) brightness(${brightnessPct}%)`;

  if (!input || input === 'none') {
    return filter;
  }

  // If input is an existing style string, replace or append filter
  if (/filter\s*:/i.test(input)) {
    return input.replace(/filter\s*:\s*[^;]+;?/i, `filter: ${filter} !important;`);
  }

  return `${input.trim().replace(/;?$/, ';')} filter: ${filter} !important;`;
}

export default qualityLossImage;
