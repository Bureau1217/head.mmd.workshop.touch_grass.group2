/**
 * Attack Script: Falling Letters
 * Simulates atmospheric interference / physical disruption ripping individual
 * characters off words and making them tumble and drop to the bottom of the page
 * under gravity, leaving empty missing letter gaps in the scientific text.
 */

export function fallingLetters(input: string, force: number = 1, threshold: number = 1): string {
  if (!input || force < threshold) {
    return input;
  }

  // Gradual percentage of letters that fall:
  // Force 1: ~4%
  // Force 2: ~8%
  // Force 3: ~12%
  // Force 5: ~20%
  // Force 10: ~35%
  const excess = force - threshold + 1;
  const fallProbability = Math.min(0.40, 0.02 + excess * 0.035);

  // If input already has tags or spans, process only the pure text sections
  let charGlobalIndex = 0;

  return input.replace(/(<[^>]+>)|([a-zA-Z0-9\u00C0-\u017F]+)|([^a-zA-Z0-9\u00C0-\u017F<]+)/g, (match, tag, word, other) => {
    if (tag) return tag;
    if (other) return other;
    if (!word) return match;

    // Process characters inside words
    let result = '';
    for (let i = 0; i < word.length; i++) {
      charGlobalIndex++;
      const char = word[i];

      // Deterministic pseudo-randomness based on character position and force
      const seed = Math.sin(charGlobalIndex * 929 + force * 41 + char.charCodeAt(0)) * 10000;
      const rand = seed - Math.floor(seed);

      if (rand < fallProbability) {
        // Compute randomized drop physics
        const dropPx = Math.round(180 + Math.abs(Math.sin(charGlobalIndex * 13)) * 320); // 180px to 500px drop
        const rotDeg = Math.round((Math.sin(charGlobalIndex * 29) > 0 ? 1 : -1) * (45 + Math.abs(Math.sin(charGlobalIndex * 7)) * 180)); // rotation angle
        const driftX = Math.round(Math.sin(charGlobalIndex * 31) * 60); // horizontal drift
        const delayMs = Math.round((charGlobalIndex % 8) * 120); // staggered drop delay

        result += `<span class="app-wiki-article__falling-letter" style="--fall-drop: ${dropPx}px; --fall-rot: ${rotDeg}deg; --fall-drift: ${driftX}px; animation-delay: ${delayMs}ms;">${char}</span>`;
      } else {
        result += char;
      }
    }
    return result;
  });
}

export default fallingLetters;
