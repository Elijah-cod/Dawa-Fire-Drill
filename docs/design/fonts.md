# Fonts

## Display face: Source Serif 4 Semibold

- **Use:** only the page title, section headings and the verdict line. Body text, tables, chips and form controls stay on the system font, which keeps small text and Swahili safe.
- **Licence:** SIL Open Font License 1.1. The licence text ships next to the font: `docs/design/prototype/kisumu-v2/fonts/OFL-source-serif-4.txt`.
- **Source:** Adobe Source Serif 4 (upstream https://github.com/adobe-fonts/source-serif), taken from the Fontsource npm package `@fontsource/source-serif-4` version 5.3.1, file `files/source-serif-4-latin-600-normal.woff2`.
- **File:** `docs/design/prototype/kisumu-v2/fonts/source-serif-4-latin-600-normal.woff2` (preview) and `apps/web/public/fonts/source-serif-4-latin-600-normal.woff2` with `OFL-source-serif-4.txt` (app, preloaded from the root layout, `@font-face` and fallback overrides in `apps/web/src/app/globals.css`), 21,532 bytes, one weight (600), Latin subset. English and Swahili use plain Latin letters, so no extra diacritics are needed.
- **Loading:** self-hosted only, never from a third-party CDN, so it works offline and makes no external requests. Preloaded, `font-display: swap`.
- **Fallback without layout shift:** a `Source Serif 4 Fallback` face maps to local Georgia with `size-adjust: 108.39%`, `ascent-override: 95.58%`, `descent-override: 30.91%`, `line-gap-override: 0%`, computed from both fonts' metric tables (unitsPerEm, hhea ascent/descent/lineGap and the advance widths of a representative heading string).
- **Chosen:** 2026-11-08 by the user from three OFL candidates (Atkinson Hyperlegible, Source Serif 4, Literata); comparison screenshots in `docs/design/prototype/kisumu-v2/screenshots/v3/fonts-candidates-*.png`.

The app (`apps/web`) does not use this face yet; it moves there with the approved redesign.
