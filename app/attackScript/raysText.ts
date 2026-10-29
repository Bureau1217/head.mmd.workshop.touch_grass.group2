/**
 * Attack Script: Rays Text (raysText) - Satellite Orbital Ground Track Interference
 * Simulates a commercial satellite's inclined orbital trajectory traversing the screen.
 * A non-horizontal virtual line crosses the screen, linearly converting every character
 * that intersects or touches this orbital line into "0" in real time as the satellite glides across.
 *
 * - Non-horizontal: Orbital tracks cross at steep diagonal angles (28° to 52° inclination).
 * - Linear transformation: Characters flip to '0' along the path in temporal sequence.
 * - Cumulative: Completed orbital tracks and zeroed characters remain etched across the article.
 */

export interface OrbitRayLine {
  rayIndex: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  angleDeg: number;
  length: number;
  durationSec: number;
}

/**
 * Computes deterministic non-horizontal diagonal coordinates for an orbital line across the screen.
 */
export function getOrbitRayCoordinates(
  rayIndex: number,
  width: number,
  height: number,
  scrollY: number = 0
): OrbitRayLine {
  const w = Math.max(400, width);
  const h = Math.max(300, height);

  // Alternates ascending and descending diagonal tracks (real satellite constellation orbits)
  const isAscending = rayIndex % 2 === 1;

  // Inclination angle: 28° to 52° (strictly non-horizontal!)
  const angleDeg = (isAscending ? -1 : 1) * (28 + ((rayIndex * 17) % 24));
  const slope = Math.tan((angleDeg * Math.PI) / 180);

  // Position the line across the visible viewport so it is immediately visible
  const availableH = Math.max(100, h - 160);
  const yOffset = 70 + ((rayIndex * 110 + 40) % availableH);

  let x1: number;
  let y1: number;
  let x2: number;
  let y2: number;

  if (isAscending) {
    // Starts bottom-left, ascends towards top-right
    x1 = -30;
    y1 = scrollY + yOffset + Math.min(220, availableH);
    x2 = w + 30;
    y2 = y1 + (x2 - x1) * slope; // slope is negative, so y2 < y1
  } else {
    // Starts top-left, descends towards bottom-right
    x1 = -30;
    y1 = scrollY + yOffset;
    x2 = w + 30;
    y2 = y1 + (x2 - x1) * slope; // slope is positive, so y2 > y1
  }

  const length = Math.hypot(x2 - x1, y2 - y1);
  const durationSec = 2.4;

  return {
    rayIndex,
    x1: Math.round(x1),
    y1: Math.round(y1),
    x2: Math.round(x2),
    y2: Math.round(y2),
    angleDeg: Math.round(angleDeg),
    length: Math.round(length),
    durationSec
  };
}

/**
 * Creates HTML for a character touching the orbital line, smoothly flipping from original to '0'.
 */
export function createOrbitZeroCharHtml(char: string, delaySec: number, rayIndex: number): string {
  if (char === ' ' || char === '\n' || char === '\r' || char === '\t') {
    return char;
  }
  return `<span class="app-wiki-article__orbit-char" data-ray="${rayIndex}" style="--hit-delay: ${delaySec.toFixed(2)}s;"><span class="app-wiki-article__char-orig">${char}</span><span class="app-wiki-article__char-zero">0</span></span>`;
}

/**
 * Standard attack function interface matching the project conventions.
 */
export function raysText(input: string, force: number = 1, threshold: number = 1): string {
  if (!input || force < threshold) {
    return input;
  }
  const count = Math.min(input.length, Math.max(10, force * 6));
  const zeros = '0'.repeat(count);
  return input.slice(0, 10) + `<span class="app-wiki-article__orbit-char"><span class="app-wiki-article__char-zero" style="opacity: 1;">${zeros}</span></span>` + input.slice(10 + zeros.length);
}

export default raysText;
