/**
 * Attack Script: Rays Image (raysImage) - Satellite Optical Trail Interference
 * Simulates commercial satellites crossing the optical field of astronomical and
 * Earth-observation cameras, producing blinding bright white glare streaks along
 * a non-horizontal diagonal flight path across the image (illuminating and saturating
 * the CCD sensor pixels along the trajectory).
 *
 * - Non-horizontal: Orbital tracks cross at steep diagonal angles (26° to 50° inclination).
 * - Linear transformation: The glare line linearly draws across the photograph in real time (2.4s).
 * - Cumulative: Completed satellite tracks remain etched across the image as force escalates.
 * - No blurring: The image is NOT blurred; satellite streaks physically saturate pixels along the path.
 */

export interface ImageOrbitRayLine {
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
 * Computes deterministic non-horizontal diagonal coordinates for a satellite pass across an image.
 */
export function getImageOrbitRayCoordinates(
  rayIndex: number,
  width: number,
  height: number,
  imageSeed: number = 0
): ImageOrbitRayLine {
  const w = Math.max(120, width);
  const h = Math.max(80, height);

  // Alternates ascending and descending diagonal tracks (real satellite constellation orbits)
  const isAscending = rayIndex % 2 === 1;

  // Inclination angle: 26° to 50° (strictly non-horizontal!)
  const angleDeg = (isAscending ? -1 : 1) * (26 + ((rayIndex * 19 + imageSeed * 13) % 24));
  const slope = Math.tan((angleDeg * Math.PI) / 180);

  // Position distributed across the vertical height of the image (20% to 80%)
  const availableH = Math.max(40, h * 0.6);
  const yOffset = Math.round(h * 0.2 + ((rayIndex * 37 + imageSeed * 29) % availableH));

  let x1: number;
  let y1: number;
  let x2: number;
  let y2: number;

  if (isAscending) {
    // Starts bottom-left, ascends towards top-right
    x1 = -10;
    y1 = yOffset + Math.min(Math.round(h * 0.35), availableH);
    x2 = w + 10;
    y2 = y1 + (x2 - x1) * slope;
  } else {
    // Starts top-left, descends towards bottom-right
    x1 = -10;
    y1 = yOffset;
    x2 = w + 10;
    y2 = y1 + (x2 - x1) * slope;
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
 * Creates SVG group markup for a single satellite glare streak across an image.
 */
export function createImageOrbitRaySvgGroup(
  rayIndex: number,
  width: number,
  height: number,
  imageSeed: number = 0,
  isReplay: boolean = false
): string {
  const coords = getImageOrbitRayCoordinates(rayIndex, width, height, imageSeed);
  const { x1, y1, x2, y2, length: L, durationSec } = coords;

  const animStyle = isReplay ? '' : `animation: draw-image-orbit-streak ${durationSec}s linear forwards;`;
  const offset = isReplay ? '0' : String(L);

  return `
    <g class="app-wiki-article__image-orbit-group" data-ray="${rayIndex}">
      <!-- Outer scatter -->
      <line
        x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"
        stroke="rgba(255, 255, 255, 0.22)"
        stroke-width="16"
        stroke-linecap="round"
        stroke-dasharray="${L}"
        stroke-dashoffset="${offset}"
        style="--image-orbit-len: ${L}; ${animStyle}"
      />
      <!-- Mid bloom -->
      <line
        x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"
        stroke="rgba(255, 255, 255, 0.55)"
        stroke-width="6"
        stroke-linecap="round"
        stroke-dasharray="${L}"
        stroke-dashoffset="${offset}"
        style="--image-orbit-len: ${L}; ${animStyle}"
      />
      <!-- Saturated core beam -->
      <line
        x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"
        stroke="#ffffff"
        stroke-width="2.2"
        stroke-linecap="round"
        stroke-dasharray="${L}"
        stroke-dashoffset="${offset}"
        style="--image-orbit-len: ${L}; ${animStyle}"
      />
    </g>
  `.trim();
}

/**
 * Standard attack function interface matching the project conventions.
 */
export function raysImage(input: string = '', force: number = 1, threshold: number = 1): string {
  if (force < threshold) {
    return input;
  }
  return createImageOrbitRaySvgGroup(0, 300, 200, 0, false);
}

export default raysImage;
