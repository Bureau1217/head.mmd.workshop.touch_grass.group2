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
export function qualityLossImage(input: string, force: number = 1, threshold: number = 1): string {
  if (!input || force < threshold) {
    return 'none';
  }

  const excess = force - threshold + 1;

  const blurPx = Math.min(24, Math.round(excess * 4));
  const contrastPct = Math.max(25, 100 - excess * 20);
  const saturatePct = Math.max(10, 100 - excess * 25);
  const brightnessPct = Math.max(40, 100 - excess * 12);

  return `blur(${blurPx}px) contrast(${contrastPct}%) saturate(${saturatePct}%) brightness(${brightnessPct}%)`;
}

export default qualityLossImage;
