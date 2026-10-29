/**
 * Attack Script: Cross Word
 * Crosses out words in the input text with strikethrough lines.
 * Preserves existing HTML tags and stacks cleanly on top of previous attacks.
 *
 * @param input - The original or partially attacked text
 * @param force - The force / level of the attack
 * @param threshold - The minimum force required to trigger the attack (default: 1)
 * @returns The interferenced input with words crossed out
 */
export function crossWord(input: string, force: number = 1, threshold: number = 1): string {
  if (!input || force < threshold) {
    return input;
  }

  const excess = force - threshold + 1;
  const strikeProbability = Math.min(0.8, 0.2 + excess * 0.15);

  const tokens = input.split(/(\s+)/);

  const processed = tokens.map((token, index) => {
    // Skip whitespace, tags, already redacted, or already struck tokens
    if (/^\s+$/.test(token) || token.includes('<') || token.includes('>') || token.includes('\u0336')) {
      return token;
    }

    const pseudoRandom = Math.sin(index * 997 + force * 13 + token.length) * 10000;
    const rand = pseudoRandom - Math.floor(pseudoRandom);

    if (rand < strikeProbability && token.length > 1) {
      const crossed = token
        .split('')
        .map((char) => `${char}\u0336`)
        .join('');
      return `<del class="app-wiki-article__strike">${crossed}</del>`;
    }

    return token;
  });

  return processed.join('');
}

export default crossWord;
