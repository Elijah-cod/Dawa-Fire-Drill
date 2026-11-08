# Frontend design approval

Status: **Approved** on 2026-11-05.

The user replied exactly `DESIGN APPROVED` in this repository on 2026-11-05. The reviewed artifacts are the [Phase 1 design brief](README.md), [screen specification](screens.md), and [static responsive prototype](prototype/README.md). Native Figma frames and prototype connections remain incomplete as noted in the [Figma checklist](figma-checklist.md).

On 2026-11-07 the user approved `docs/design/` and the [county design addendum](addendum-counties.md), and authorized Phase 3 frontend work.

On 2026-11-08 the user approved the [Kisumu redesign preview](prototype/kisumu-v2/) (critique in [critique-v4.md](critique-v4.md), screenshots in `prototype/kisumu-v2/screenshots/v5/`) with no further preview rounds, and carried six items into the app build:

1. Fix costs, the budget slider and field, the verdict and related UI text use illustrative cost **units**; the funding trace stays in KES.
2. The About text states precisely what is invented and what is anchored, matching `docs/data-assumptions.md`.
3. The optimizer explanation sits behind a "Why these picks?" disclosure with a one-sentence summary derived from the data; the displayed text drops the repeated "Illustrative and unvalidated" lead-in.
4. On phones the lead sentence is large, the coverage and budget sentences smaller, and a "Change scenario" control and the map sit within the first screen or one swipe.
5. Teal phrases in the verdict are real controls, or are restyled so they do not look like links.
6. Check the bottom bar against real content at 390 px and pad by the bar height if it overlaps. Preview check: it does not overlap when the real page is scrolled to the end (content ends at 748 px, bar starts at 787 px); the overlap in `fixes-390.png` is a full-page screenshot artifact.
