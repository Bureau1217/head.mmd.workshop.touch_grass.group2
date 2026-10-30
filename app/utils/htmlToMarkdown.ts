/**
 * Utility to convert Wikipedia article HTML to clean Markdown and trigger .md file download
 */

export interface ArticleMarkdownMeta {
  title: string;
  html: string;
  satName?: string | null;
  satPurpose?: string | null;
  userLat?: number;
  userLon?: number;
  sourceUrl?: string;
}

/**
 * Converts standard HTML DOM elements to formatted Markdown text
 */
function nodeToMarkdown(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent || '';
  }

  if (node.nodeType !== Node.ELEMENT_NODE) {
    return '';
  }

  const el = node as HTMLElement;
  const tag = el.tagName.toLowerCase();

  // Skip scripts, styles, SVGs, hidden navigation and administrative Wikipedia boxes
  if (
    [
      'script',
      'style',
      'svg',
      'noscript',
      'nav',
      'footer',
      'iframe'
    ].includes(tag) ||
    el.classList.contains('mw-editsection') ||
    el.classList.contains('reference') ||
    el.classList.contains('noprint') ||
    el.classList.contains('metadata')
  ) {
    return '';
  }

  const childText = Array.from(el.childNodes)
    .map(nodeToMarkdown)
    .join('');

  switch (tag) {
    case 'h1':
      return `\n\n# ${childText.trim()}\n\n`;
    case 'h2':
      return `\n\n## ${childText.trim()}\n\n`;
    case 'h3':
      return `\n\n### ${childText.trim()}\n\n`;
    case 'h4':
      return `\n\n#### ${childText.trim()}\n\n`;
    case 'h5':
    case 'h6':
      return `\n\n##### ${childText.trim()}\n\n`;
    case 'p': {
      const clean = childText.trim();
      return clean ? `\n\n${clean}\n\n` : '';
    }
    case 'strong':
    case 'b':
      return childText.trim() ? `**${childText.trim()}**` : '';
    case 'em':
    case 'i':
      return childText.trim() ? `*${childText.trim()}*` : '';
    case 'code':
      return `\`${childText}\``;
    case 'pre':
      return `\n\n\`\`\`\n${childText}\n\`\`\`\n\n`;
    case 'blockquote':
      return `\n\n> ${childText.trim().replace(/\n/g, '\n> ')}\n\n`;
    case 'ul':
      return `\n\n${childText}\n\n`;
    case 'ol':
      return `\n\n${childText}\n\n`;
    case 'li': {
      const trimmed = childText.trim();
      return trimmed ? `- ${trimmed}\n` : '';
    }
    case 'a': {
      const href = el.getAttribute('href');
      const text = childText.trim();
      if (!text) return '';
      if (href && !href.startsWith('#') && !href.startsWith('javascript:')) {
        const fullHref = href.startsWith('http') ? href : `https://fr.wikipedia.org${href}`;
        return `[${text}](${fullHref})`;
      }
      return text;
    }
    case 'br':
      return '\n';
    case 'hr':
      return '\n\n---\n\n';
    case 'table':
      return `\n\n${childText.trim()}\n\n`;
    case 'tr':
      return `${childText}\n`;
    case 'td':
    case 'th':
      return `${childText.trim()} | `;
    default:
      return childText;
  }
}

/**
 * Converts HTML string to clean Markdown
 */
export function htmlToMarkdown(html: string): string {
  if (!html) return '';

  if (typeof DOMParser !== 'undefined') {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    // Remove noise elements
    const unwanted = doc.querySelectorAll(
      'script, style, noscript, svg, nav, footer, .mw-empty-elt, .mw-editsection, .reference, .noprint'
    );
    unwanted.forEach((el) => el.remove());

    const md = nodeToMarkdown(doc.body);
    // Normalize excessive consecutive blank lines
    return md.replace(/\n{3,}/g, '\n\n').trim();
  }

  // Fallback: strip tags with regex
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<h1[^>]*>(.*?)<\/h1>/gi, '\n# $1\n')
    .replace(/<h2[^>]*>(.*?)<\/h2>/gi, '\n## $1\n')
    .replace(/<h3[^>]*>(.*?)<\/h3>/gi, '\n### $1\n')
    .replace(/<p[^>]*>(.*?)<\/p>/gi, '\n$1\n')
    .replace(/<li[^>]*>(.*?)<\/li>/gi, '- $1\n')
    .replace(/<[^>]+>/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Generates a complete Markdown document including telemetry metadata
 */
export function generateArticleMarkdown(meta: ArticleMarkdownMeta): string {
  const now = new Date();
  const dateFormatted = now.toLocaleString('en-US', {
    dateStyle: 'full',
    timeStyle: 'medium'
  });

  const displayTitle = meta.title.replace(/_/g, ' ');
  const wikiUrl = meta.sourceUrl || `https://en.wikipedia.org/wiki/${encodeURIComponent(meta.title.replace(/ /g, '_'))}`;

  const header = [
    `# ${displayTitle}`,
    '',
    `> **Touch Grass Archive — Scientific Data Backup**`,
    `> This document was automatically archived upon detecting the **second USB drive**, suspending satellite orbital interference.`,
    '',
    '## 📡 Telemetry at Capture Time',
    `- **Date & Time:** ${dateFormatted}`,
    `- **Source URL:** ${wikiUrl}`,
    meta.satName ? `- **Zenith Scientific Satellite:** ${meta.satName}` : null,
    meta.satPurpose ? `- **Scientific Mission:** ${meta.satPurpose}` : null,
    meta.userLat !== undefined && meta.userLon !== undefined
      ? `- **Observer Location:** ${meta.userLat.toFixed(4)}°N, ${meta.userLon.toFixed(4)}°E (Geneva, HEAD)`
      : null,
    `- **Hardware State:** 2 USB drives connected (Attacks suspended)`,
    '',
    '---',
    '',
    '## 📄 Article Content',
    ''
  ]
    .filter((line) => line !== null)
    .join('\n');

  const content = htmlToMarkdown(meta.html);

  const footer = [
    '',
    '---',
    '',
    `*Touch Grass (Master Media Design Workshop, HEAD – Geneva) — Satellite archive exported on ${now.toISOString()}*`
  ].join('\n');

  return `${header}\n${content}\n${footer}`;
}

/**
 * Triggers an instant download of the Markdown file in the browser
 */
export function downloadMarkdownFile(filename: string, content: string): void {
  if (typeof document === 'undefined' || typeof URL === 'undefined') {
    return;
  }

  const cleanFilename = filename.endsWith('.md') ? filename : `${filename}.md`;
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = cleanFilename;
  link.style.display = 'none';

  document.body.appendChild(link);
  link.click();

  // Cleanup
  setTimeout(() => {
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, 300);
}
