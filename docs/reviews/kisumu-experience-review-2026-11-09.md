# Kisumu dashboard experience review

Date: 9 November 2026  
Surface: `http://localhost:3300/kisumu` in the in-app browser  
Review perspectives: first-time user, recruiter, senior engineer

## Executive assessment

The dashboard has a credible core: it turns a scenario into a concrete stockout sequence and a budget-constrained set of interventions. It is unusually clear that the facilities, costs and results are synthetic and unvalidated. The baseline-versus-shock distinction, explanation of the limited intervention coverage, accessible text for the map, and facility drill-down all contribute to trust.

The main barrier is comprehension. On arrival, a new user encounters an extensive, prominently styled verdict before they have learned what a shock, stockout, tracer, illustrative unit, or optimizer means. On the observed narrow viewport, the map and controls sit below a long introduction, while a fixed navigation bar occupies the bottom of the screen. The strongest next improvement is to make the first decision and the meaning of the numbers immediately clear, then progressively disclose the supporting details.

This is a qualitative review of one local session, not a usability study, accessibility certification, security audit, performance benchmark, or model validation. Recommendations are hypotheses to test with representative users.

## Scope and method

I inspected the initial Kisumu page at the browser's existing narrow viewport, expanded the scenario selector, opened each of the four Kisumu views, inspected a funding bottleneck and a facility, followed the summary's facility link, and started and exited the guided demo. I inspected the visible page and accessibility tree. I did not test every scenario, budget, locale, theme, viewport, tour step, error state, upload, or keyboard path. I did not inspect source code or run automated checks. Observations below distinguish what was visible from risks requiring verification.

The starting scenario was a 40% logistics cut, a 90-day run, and a 30-unit budget. It reported 209 shock-caused stockouts plus two baseline stockouts; four shock-caused stockouts had intervention options. These are synthetic example outputs, not claims about real facilities or model accuracy.

## What works well

- **Honest boundaries.** A persistent notice states that names, locations and costs are invented and results are illustrative and unvalidated. The fixes section explains that only four of 209 shock-caused stockouts have options, and that costs are not calibrated to real prices.
- **A concrete story.** The summary identifies the first shock-caused stockout, its day, and the funded transfers. Links connect this story to detail; the facility link opened the correct facility and moved focus to its details in this session.
- **Useful distinctions.** The stockout-order view separates pre-existing shortages from those attributed to the shock. The map readout distinguishes stockout events from affected facilities and states that the timeline is modeled without intervention.
- **Explainable choices.** Funded and unfunded options show costs and reasons, and the interface offers a “Why these picks?” disclosure. The funding view provides a stage breakdown and a selectable bottleneck.
- **Accessibility foundations.** A skip link, labeled controls, tab semantics, text descriptions of area counts, and explicit status words were present in the accessibility tree. These are positive signals, not proof of conformance.
- **Recruiter-friendly ambition.** A guided demo, internationalization and theme controls, scenario exploration, optimizer explanation, and funding trace show a broader product vision than a static dashboard.

## First-time user perspective

### 1. The initial explanation is dense and the primary action is unclear — high priority

**Observed:** The first screen displayed the synthetic-data banner, role selector, breadcrumb, scenario control, and several bold paragraphs of results. The map and fixes were below the visible area. The user is told what happened before being told how to explore it.

**Why it matters:** A new visitor must interpret several concepts and numbers simultaneously. They may not know whether to change the scenario, open the tour, follow a link, or scroll. The strongest result competes with supporting caveats and status counts.

**Improve:** Start with one plain-language sentence describing the task, followed by a compact result with a clear next action such as “Explore the timeline.” Retain the synthetic and validation notice, and place secondary counts and baseline detail in a scannable supporting area. Test whether a first-time user can identify the shock, first outcome, and next action within 30 seconds.

### 2. Domain and implementation terms need context — high priority

**Observed:** The page uses “logistics cut,” “stockout,” “tracer,” “illustrative units,” “optimizer,” and “planted transfer.” The last appeared in facility details. The page explains some constraints but does not define these terms where first encountered.

**Why it matters:** A recruiter or new planner may understand the individual words without understanding what is simulated, what a stockout counts, or what a transfer represents. “Planted” reads like an internal fixture term.

**Improve:** Provide short, contextual definitions, for example “one stockout = one facility running out of one commodity.” Replace internal fixture language with “Example transfer” and describe what the budget units represent and do not represent. Keep deeper methodology one click away.

### 3. Status labels can suggest more safety than intended — high priority

**Observed:** The facilities view explains that “Stable” means first stockout after day 52. Several facilities marked Stable still have a modeled first stockout during the 90-day run, including day 53.

**Why it matters:** “Stable” can be read as no stockout or low risk throughout the run. The nearby explanatory text helps, but the label itself can mislead when scanned or repeated elsewhere.

**Improve:** Consider time-based labels such as “After day 52” or “Later stockout,” with a separate explicit “No stockout during run” category where applicable. Explain that thresholds are illustrative and tie them to the current run. Validate the terminology with planners.

### 4. The narrative can blur commodity and facility outcomes — high priority

**Observed:** A funded transfer is described as “keeping its facility stocked through day 90,” while the selected facility's detail lists additional commodities with stockouts during the same run. The fixes list names a specific commodity, but the summary wording is broader.

**Why it matters:** A reader could infer that all commodities at that facility stay stocked, overstating the intervention's modeled coverage.

**Improve:** Say that each funded option keeps **the specified commodity at that facility** stocked through day 90, if that accurately reflects the model. Review all summary and intervention copy for the same distinction. Verify against model semantics before changing the claim.

### 5. Large lists need stronger orientation — medium priority

**Observed:** The stockout view initially shows ten shock-caused events and offers “Show all 209.” The facility view contains 40 rows and has filters and sortable headings, but no visible facility-name search in the inspected state.

**Why it matters:** Finding a named facility or understanding a long sequence can require substantial scanning, particularly on a narrow screen.

**Improve:** Add facility-name search, an explicit active sort indicator, and a concise results count. For stockouts, consider filters by area, commodity, and time, or incremental loading with a clear position in the list. Preserve the chronological narrative and accessible table structure.

### 6. Guided demo is promising but competes with the current context — medium priority

**Observed:** “Try the 3-minute demo” navigated from Kisumu to the national overview and opened step 1 of 7. The step described a schematic national grid; the underlying overview first showed a loading message and then the county list. I did not complete the seven-step tour.

**Why it matters:** A user starting on Kisumu may not expect to leave the current scenario. A time promise also needs validation across devices and reading speeds.

**Improve:** Explain that the tour starts at the national overview and provide a clear return path to the previous scenario. Check that each step points to a visible target after loading, including on mobile. Validate the duration with users or describe it as an approximate tour.

## Recruiter perspective

The product is more memorable than a generic dashboard because it frames a real operational question and provides a coherent demonstration of scenario analysis, explainable optimization, and funding flow. The explicit synthetic-data disclosures are a strong signal of judgment.

The value proposition and the author's contribution are less immediately visible. A recruiter landing directly on this page may not know in seconds what problem the project addresses, who it serves, or which parts are interactive. The first viewport reads more like an expert report than a concise product introduction. The detailed facility names and tracer identifiers also compete with the product story.

Recommended improvements:

1. Add a short, accessible description near the page title: who uses the tool, what decision it rehearses, and that the example is synthetic.
2. Make the demo's first action and expected result obvious. Show the scenario → outcome → budget → recommendation sequence.
3. Provide an unobtrusive project/about link to a concise case study covering architecture, individual contribution, constraints, and demonstrated engineering decisions. Support claims with verifiable repository evidence; avoid invented impact metrics.
4. Preserve the real limitations prominently. The four-option intervention scope is a useful demonstration of honest engineering, but explain why that limit exists and what a future extension would require.

## Senior engineer perspective

### Product and model semantics

- **Observed:** The default result makes a strong causal statement about the shock, while separately identifying baseline shortages. The UI also states that intervention options cover only four of 209 shock-caused stockouts. **Recommendation:** Document the comparison method, baseline assumptions, run identity, data version, optimization objective, tie-breaking, and intervention eligibility in an accessible methodology view. Verify the causal wording reflects the actual calculation rather than correlation.
- **Observed:** The map readout says “Modeled, no intervention,” while the adjacent fixes reflect an optimized budget. **Recommendation:** Keep baseline and intervention states visibly distinct and explain whether changing the budget updates the map. If an intervention-adjusted simulation is unavailable, say so beside the controls.
- **Observed:** The same donor facility appears in two example transfer options. **Verification question:** Are shared donor inventory, concurrent allocations, timing, and downstream donor risk constrained jointly? The screen alone cannot establish this. If not modeled, disclose that limitation; do not imply operational feasibility.
- **Observed:** Facility detail uses “41 days to stockout” while the timeline is at day 45. **Verification question:** Is this intended to mean day 41 from the start of the run, rather than 41 days from the selected day? Prefer “First stockout: day 41 of the run” if that is the intended meaning.

### Interaction and accessibility

- **Observed:** Scenario presets and comparison choices appeared as checkboxes in the accessibility tree, with one selected in each group. **Verification question:** Are they mutually exclusive? If so, use radio-group semantics and appropriate keyboard behavior; if multiple selection is intended, explain it. Verify actual behavior before treating this as a defect.
- **Observed:** The funding bottleneck is exposed as a checkbox and reveals details. **Recommendation:** Review whether a disclosure button with expanded state or a radio selection better expresses the interaction. Confirm focus, announcement, and keyboard behavior with assistive technology.
- **Observed:** The facility link correctly selected the corresponding detail and moved focus in this session. **Recommendation:** Add regression coverage for cross-tab links, focus placement, URL state, reload, browser history, and links from all tabs. Verify that targets are visible and not obscured by fixed navigation.
- **Observed:** A text alternative lists area counts, and controls have accessible names. **Recommendation:** Run full keyboard and screen-reader testing, automated accessibility checks, contrast checks in both themes, and reduced-motion checks. The accessibility tree alone cannot prove operability or compliance.
- **Observed:** The narrow viewport uses a fixed bottom navigation and a long, bold introduction. **Recommendation:** Test at the repository's specified mobile, tablet, and desktop sizes, including zoom and large text. Check that content and focused elements are not covered and that table interactions remain usable.

### Reliability and operational readiness

The session briefly showed loading states during navigation, then loaded the requested views. I did not test API failures, slow networks, stale data, or invalid URL parameters. Before presenting this as production-ready, verify informative loading, empty, timeout, and retry states; preserve scenario state across navigation; and make dataset/run provenance and freshness visible. Test response to unavailable maps or tiles without losing the text alternative.

Do not infer backend correctness, security, performance, test coverage, or optimizer implementation from the visible interface. Review the code, API contracts, tests, and observability separately.

## Suggested prioritization

| Priority | Change | Reason | Validation |
| --- | --- | --- | --- |
| P1 | Clarify commodity-specific intervention wording and time labels | Avoid overstating the modeled result | Compare UI statements with model outputs and add focused regression tests |
| P1 | Restructure the first screen around task, outcome, and next action | Reduce first-use cognitive load | Observe new users completing a scenario exploration |
| P1 | Replace or clarify “Stable” and define key terms | Prevent misinterpretation of risk | Test comprehension with planners and non-experts |
| P2 | Explain scenario, baseline, limitations, and optimization method in context | Make results auditable without overwhelming the overview | Review against model documentation and representative questions |
| P2 | Improve long-list search, sort feedback, and mobile navigation | Make facility and event detail easier to find | Test named-facility and stockout lookup on narrow and wide screens |
| P2 | Review control semantics and cross-tab focus | Improve keyboard and assistive-technology use | Keyboard and screen-reader testing plus automated checks |
| P3 | Add a concise project case study and guided-demo context | Help recruiters understand the work and its contribution | Ask reviewers to explain the project after a short visit |

## Follow-up questions for validation

1. What is the intended primary user and decision: a county planner rehearsing a shock, a recruiter exploring a portfolio, or both? Their starting paths may differ.
2. Does “stockout” always mean one facility–commodity event, and are the headline counts based on a paired no-shock comparison?
3. Does a funded intervention protect only the named commodity, and are donor stock, timing, and competing transfers jointly constrained?
4. Are the critical/watch/stable thresholds intended to be fixed for the whole run, or relative to the timeline day?
5. Can users return to their prior scenario after the tour, and are scenario, budget, filters, and selected facility shareable or recoverable through navigation?

## Review limitations

No changes to application code or data were made. No automated tests, accessibility scanner, performance profiling, source review, model verification, or production-environment checks were performed. The observations describe the local build and session on the date above; behavior may differ in other configurations.
