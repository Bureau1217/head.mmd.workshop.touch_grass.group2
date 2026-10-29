export default defineEventHandler(async (event): Promise<string> => {
  const query = getQuery(event);
  const title = (query.title as string) || 'Satellite_artificiel';
  const lang = (query.lang as string) || 'fr';

  try {
    const cleanTitle = title.replace(/ /g, '_');
    const upstreamUrl = `https://${lang}.wikipedia.org/api/rest_v1/page/html/${encodeURIComponent(cleanTitle)}`;
    const res = await fetch(upstreamUrl, {
      headers: {
        'User-Agent': 'TouchGrassApp/1.0 (HEAD Geneva Workshop; contact@head.ch)'
      }
    });

    if (!res.ok) {
      throw new Error(`Wikipedia returned ${res.status}: ${res.statusText}`);
    }

    let html = await res.text();

    // Strip any existing upstream base tags to ensure our base href is the only one
    html = html.replace(/<base\b[^>]*\/?>/gi, '');

    const displayTitle = decodeURIComponent(cleanTitle).replace(/_/g, ' ');

    const headInjection = `
      <base href="https://${lang}.wikipedia.org/">
      <style id="satellite-attack-base-styles">
        /* Disable navigation on links so iframe never leaves the article or turns into cross-origin */
        a {
          pointer-events: none !important;
          cursor: default !important;
          text-decoration: underline dotted #a2a9b1 !important;
          color: inherit !important;
        }
        /* Smooth filter degradation for images */
        img, figure, picture, .mw-file-element, .thumbimage {
          transition: filter 0.6s cubic-bezier(0.4, 0, 0.2, 1) !important;
        }
        /* Confidential marker redaction */
        .app-wiki-article__censor {
          background-color: #111111 !important;
          color: #111111 !important;
          border-radius: 2px;
          padding: 0 2px;
          user-select: none;
        }
        /* Cross word strike */
        .app-wiki-article__strike {
          text-decoration: line-through 2px #111111 !important;
          color: #555555 !important;
        }
      </style>
      <script>
        document.addEventListener('click', function(e) {
          var a = e.target.closest('a');
          if (a) {
            e.preventDefault();
            e.stopPropagation();
          }
        }, true);
      </script>
    `;

    const titleHeader = `
      <h1 id="firstHeading" class="firstHeading mw-first-heading" style="font-family: 'Linux Libertine', Georgia, Times, serif; font-size: 1.85em; font-weight: normal; margin-top: 0.6em; margin-bottom: 0.3em; padding-bottom: 0.2em; border-bottom: 1px solid #a2a9b1; color: #202122; line-height: 1.25;">
        ${displayTitle}
      </h1>
    `;

    if (html.includes('<head>')) {
      html = html.replace('<head>', `<head>${headInjection}`);
    } else {
      html = `${headInjection}${html}`;
    }

    if (/<body[^>]*>/i.test(html)) {
      html = html.replace(/(<body[^>]*>)/i, `$1${titleHeader}`);
    } else {
      html = `${titleHeader}${html}`;
    }

    // Set HTML header
    setHeader(event, 'Content-Type', 'text/html; charset=utf-8');
    return html;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[wiki-html] Failed to fetch article "${title}":`, msg);
    return `<!DOCTYPE html><html><head><base href="https://${lang}.wikipedia.org/"></head><body><h1>${title}</h1><p>Impossible de charger l'article complet.</p></body></html>`;
  }
});
