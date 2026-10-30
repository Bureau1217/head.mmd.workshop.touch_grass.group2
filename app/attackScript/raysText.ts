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

  // Cycle through 4 diverse trajectory patterns across all screen borders:
  // Pattern 0: Left border -> Right border (descending diagonal)
  // Pattern 1: Right border -> Left border (ascending or descending diagonal)
  // Pattern 2: Top border -> Bottom border (steep downward diagonal cut)
  // Pattern 3: Bottom border -> Top border (steep upward diagonal cut)
  const pattern = Math.abs(rayIndex) % 4;

  let x1: number;
  let y1: number;
  let x2: number;
  let y2: number;

  const margin = 40;

  switch (pattern) {
    case 0: {
      // Pattern 0: Left -> Right (descending)
      x1 = -margin;
      const availableH = Math.max(100, h - 200);
      y1 = scrollY + 60 + ((rayIndex * 97 + 30) % availableH);

      const angleDeg = 24 + ((rayIndex * 11) % 22); // 24° to 45°
      const slope = Math.tan((angleDeg * Math.PI) / 180);
      x2 = w + margin;
      y2 = y1 + (x2 - x1) * slope;
      break;
    }

    case 1: {
      // Pattern 1: Right -> Left (descending or ascending)
      x1 = w + margin;
      const availableH = Math.max(100, h - 200);
      const isAscending = rayIndex % 2 === 1;

      if (isAscending) {
        y1 = scrollY + h - 80 - ((rayIndex * 89 + 20) % availableH);
        const angleDeg = -(22 + ((rayIndex * 13) % 20)); // -22° to -41°
        const slope = Math.tan((angleDeg * Math.PI) / 180);
        x2 = -margin;
        y2 = y1 - (x1 - x2) * slope;
      } else {
        y1 = scrollY + 50 + ((rayIndex * 83 + 30) % availableH);
        const angleDeg = 22 + ((rayIndex * 13) % 20); // 22° to 41°
        const slope = Math.tan((angleDeg * Math.PI) / 180);
        x2 = -margin;
        y2 = y1 + (x1 - x2) * slope;
      }
      break;
    }

    case 2: {
      // Pattern 2: Top -> Bottom (steep diagonal cut across viewport)
      y1 = scrollY - margin;
      const availableW = Math.max(120, w - 240);
      x1 = 80 + ((rayIndex * 131 + 40) % availableW);

      const toRight = rayIndex % 2 === 0;
      const angleDeg = toRight ? 55 + ((rayIndex * 7) % 18) : -(55 + ((rayIndex * 7) % 18));
      const rad = (Math.abs(angleDeg) * Math.PI) / 180;

      y2 = scrollY + h + margin;
      const dx = (y2 - y1) / Math.tan(rad);
      x2 = toRight ? x1 + dx : x1 - dx;
      break;
    }

    case 3:
    default: {
      // Pattern 3: Bottom -> Top (steep diagonal cut upwards)
      y1 = scrollY + h + margin;
      const availableW = Math.max(120, w - 240);
      x1 = 100 + ((rayIndex * 149 + 60) % availableW);

      const toRight = rayIndex % 2 === 1;
      const angleDeg = toRight ? -(54 + ((rayIndex * 8) % 16)) : 54 + ((rayIndex * 8) % 16);
      const rad = (Math.abs(angleDeg) * Math.PI) / 180;

      y2 = scrollY - margin;
      const dy = Math.abs(y2 - y1);
      const dx = dy / Math.tan(rad);
      x2 = toRight ? x1 + dx : x1 - dx;
      break;
    }
  }

  const length = Math.hypot(x2 - x1, y2 - y1);
  const durationSec = 2.4;
  const computedAngleDeg = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI;

  return {
    rayIndex,
    x1: Math.round(x1),
    y1: Math.round(y1),
    x2: Math.round(x2),
    y2: Math.round(y2),
    angleDeg: Math.round(computedAngleDeg),
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
