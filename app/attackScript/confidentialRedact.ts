/**
 * Attack Script: Confidential Redact
 * Redacts words with solid black highlight bars like classified confidential files.
 * Preserves existing HTML tags and stacks cleanly on top of previous attacks.
 *
 * @param input - The original or partially attacked text
 * @param force - The force / level of the attack
 * @param threshold - The minimum force required to trigger the attack (default: 1)
 * @returns The text with words blacked out like top-secret confidential documents
 */
export function confidentialRedact(input: string, force: number = 1, threshold: number = 1): string {
  if (!input || force < threshold) {
    return input;
  }

  // Ratio of available plain words to redact on this pass
  const excess = force - threshold + 1;
  const redactProbability = Math.min(0.8, 0.2 + excess * 0.15);

  // Split keeping whitespace and HTML tags intact
  const tokens = input.split(/(\s+)/);

  const processed = tokens.map((token, index) => {
    // Skip whitespace, tags, or already redacted tokens
    if (/^\s+$/.test(token) || token.includes('<') || token.includes('>') || token.includes('█')) {
      return token;
    }

    const pseudoRandom = Math.sin(index * 733 + force * 29 + token.length) * 10000;
    const rand = pseudoRandom - Math.floor(pseudoRandom);

    if (rand < redactProbability && token.length > 0) {
      const blackBar = '█'.repeat(token.length);
      return `<mark class="app-wiki-article__censor" title="REDACTED">${blackBar}</mark>`;
    }

    return token;
  });

  return processed.join('');
}

export default confidentialRedact;
