import { getPixelDegradeSvgFilters } from '~/attackScript';

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
      ${getPixelDegradeSvgFilters()}
      <style id="satellite-attack-base-styles">
        /* Disable navigation on links so iframe never leaves the article or turns into cross-origin */
        a {
          pointer-events: none !important;
          cursor: default !important;
          text-decoration: underline dotted #a2a9b1 !important;
          color: inherit !important;
        }
        /* Image rendering: real digital pixelation (no blur) */
        img, figure, picture, .mw-file-element, .thumbimage {
          image-rendering: pixelated !important;
          image-rendering: crisp-edges !important;
          transition: filter 2s cubic-bezier(0.4, 0, 0.2, 1) !important;
        }
        /* Ensure image containers support absolute ray overlays */
        .app-wiki-article__image-wrap,
        figure,
        .thumbinner,
        .mw-file-description {
          position: relative !important;
        }
        /* Satellite Ray Trails (raysImage): draws non-horizontal optical satellite streaks across images */
        .app-wiki-article__image-orbit-svg {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          pointer-events: none;
          z-index: 6;
          overflow: hidden;
        }
        .app-wiki-article__rays-overlay {
          position: absolute;
          inset: 0;
          pointer-events: none;
          overflow: hidden;
          z-index: 5;
          border-radius: inherit;
        }
        .app-wiki-article__ray-track {
          position: absolute;
          left: -50%;
          width: 200%;
          transform-origin: 50% 50%;
          pointer-events: none;
          /* Blinding pure white satellite optical streak */
          background: linear-gradient(
            180deg,
            transparent 0%,
            rgba(255, 255, 255, 0.35) 15%,
            rgba(255, 255, 255, 0.95) 45%,
            #ffffff 50%,
            rgba(255, 255, 255, 0.95) 55%,
            rgba(255, 255, 255, 0.35) 85%,
            transparent 100%
          );
          box-shadow: 0 0 6px rgba(255, 255, 255, 0.95), 0 0 12px rgba(255, 255, 255, 0.6);
          clip-path: polygon(0 0, 0 0, 0 100%, 0 100%);
          animation: ray-draw-across var(--ray-duration, 4.5s) cubic-bezier(0.2, 0.8, 0.25, 1) forwards;
        }
        @keyframes ray-draw-across {
          0% {
            clip-path: polygon(0 0, 0 0, 0 100%, 0 100%);
            opacity: 0.15;
          }
          10% {
            opacity: 1;
          }
          100% {
            clip-path: polygon(0 0, 100% 0, 100% 100%, 0 100%);
            opacity: 0.95;
          }
        }
        /* Satellite Orbital Interference Line Attack (raysText) */
        .app-wiki-article__orbit-char {
          position: relative;
          display: inline-block;
          vertical-align: baseline;
          font: inherit;
          line-height: inherit;
          margin: 0;
          padding: 0;
        }
        .app-wiki-article__char-orig {
          display: inline-block;
          vertical-align: baseline;
          font: inherit;
          line-height: inherit;
          animation: char-satellite-burn 0.28s ease-out forwards;
          animation-delay: var(--hit-delay, 0s);
        }
        .app-wiki-article__char-zero {
          position: absolute;
          left: 0;
          top: 0;
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: 'Courier New', Courier, monospace !important;
          font-weight: 700 !important;
          color: #111111 !important;
          opacity: 0;
          pointer-events: none;
          animation: zero-satellite-etch 0.38s cubic-bezier(0.2, 0.9, 0.3, 1) forwards;
          animation-delay: var(--hit-delay, 0s);
        }
        @keyframes char-satellite-burn {
          0% {
            opacity: 1;
            transform: scale(1);
            color: inherit;
          }
          40% {
            opacity: 1;
            transform: scale(1.15);
            color: #ffffff;
            text-shadow: 0 0 6px #ffffff;
          }
          100% {
            opacity: 0;
            transform: scale(0.5);
            visibility: hidden;
          }
        }
        @keyframes zero-satellite-etch {
          0% {
            opacity: 0;
            transform: scale(1.8);
            color: #ffffff;
            text-shadow: 0 0 10px #ffffff, 0 0 16px rgba(255, 255, 255, 0.9);
          }
          45% {
            opacity: 1;
            transform: scale(1.25);
            color: #ffffff;
            text-shadow: 0 0 8px #ffffff;
          }
          100% {
            opacity: 1;
            transform: scale(1);
            color: #111111;
            text-shadow: none;
          }
        }
        @keyframes draw-orbit-streak {
          0% {
            stroke-dashoffset: var(--orbit-len, 1200);
            opacity: 1;
          }
          100% {
            stroke-dashoffset: 0;
            opacity: 0.75;
          }
        }
        @keyframes draw-image-orbit-streak {
          0% {
            stroke-dashoffset: var(--image-orbit-len, 1000);
            opacity: 1;
          }
          100% {
            stroke-dashoffset: 0;
            opacity: 0.88;
          }
        }
        /* Falling Letters Attack: letters rip free and drop down with gravity */
        .app-wiki-article__falling-letter {
          display: inline-block;
          position: relative;
          vertical-align: baseline;
          font: inherit;
          line-height: inherit;
          color: inherit;
          transform-origin: 50% 50%;
          will-change: transform, opacity;
          animation: letter-rip-and-drop 2.5s cubic-bezier(0.5, 0, 0.75, 0) forwards;
        }
        @keyframes letter-rip-and-drop {
          0% {
            transform: translate(0, 0) rotate(0deg);
            opacity: 1;
          }
          12% {
            transform: translate(-1px, -3px) rotate(-8deg);
            opacity: 1;
          }
          20% {
            transform: translate(2px, -1px) rotate(12deg);
            opacity: 1;
          }
          65% {
            transform: translate(var(--fall-drift, 20px), calc(var(--fall-drop, 250px) * 0.45)) rotate(calc(var(--fall-rot, 90deg) * 0.6));
            opacity: 0.85;
          }
          100% {
            transform: translate(var(--fall-drift, 40px), var(--fall-drop, 350px)) rotate(var(--fall-rot, 160deg));
            opacity: 0;
          }
        }
        /* Smooth document level transitions */
        body {
          transition: filter 2.5s ease-in-out, background-color 2.5s ease-in-out, color 2.5s ease-in-out !important;
        }
        /* Confidential marker redaction: zero layout shift, black marker sweeps across smoothly */
        .app-wiki-article__censor {
          position: relative;
          display: inline-block;
          vertical-align: baseline;
          background: transparent !important;
          background-color: transparent !important;
          padding: 0 !important;
          margin: 0 !important;
          border: 0 !important;
          font: inherit;
          line-height: inherit;
          user-select: none;
          animation: censor-text-blackout 1.6s cubic-bezier(0.22, 1, 0.36, 1) forwards;
        }
        .app-wiki-article__censor::after {
          content: '';
          position: absolute;
          top: -2px;
          bottom: -2px;
          left: -2px;
          width: 0%;
          background-color: #111111;
          border-radius: 2px;
          box-shadow: 0 0 1px #111111;
          pointer-events: none;
          animation: censor-bar-sweep 1.6s cubic-bezier(0.22, 1, 0.36, 1) forwards;
        }
        @keyframes censor-bar-sweep {
          0% {
            width: 0%;
          }
          100% {
            width: calc(100% + 4px);
          }
        }
        @keyframes censor-text-blackout {
          0% {
            color: inherit;
          }
          45% {
            color: inherit;
          }
          100% {
            color: #111111;
          }
        }
        /* Cross word strike: zero layout shift, pen line smoothly draws across word */
        .app-wiki-article__strike {
          position: relative;
          display: inline-block;
          vertical-align: baseline;
          text-decoration: none !important;
          background: transparent !important;
          background-color: transparent !important;
          padding: 0 !important;
          margin: 0 !important;
          border: 0 !important;
          font: inherit;
          line-height: inherit;
          animation: strike-text-soften 1.4s cubic-bezier(0.22, 1, 0.36, 1) forwards;
        }
        .app-wiki-article__strike::after {
          content: '';
          position: absolute;
          top: 50%;
          left: -1px;
          width: 0%;
          height: 2px;
          background-color: #111111;
          transform: translateY(-50%);
          border-radius: 1px;
          pointer-events: none;
          animation: strike-line-sweep 1.4s cubic-bezier(0.22, 1, 0.36, 1) forwards;
        }
        @keyframes strike-line-sweep {
          0% {
            width: 0%;
          }
          100% {
            width: calc(100% + 2px);
          }
        }
        @keyframes strike-text-soften {
          0% {
            color: inherit;
          }
          100% {
            color: #666666;
          }
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
