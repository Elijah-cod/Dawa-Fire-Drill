# English and Swahili-ready string plan

Use stable message IDs and ICU-style placeholders. English copy in `screens.md` is the source for review; Swahili translations require a fluent reviewer before release. Do not machine-translate clinical or procurement terms into operational instructions. Keep units, dates, and currency locale-aware.

| ID | English source | Notes |
|---|---|---|
| `banner.synthetic` | Synthetic demo data · Calibrated to public aggregates · Results are illustrative, not validated. | Persistent, not dismissible |
| `overview.title` | Where would you act first? | Home heading |
| `overview.run` | Run a scenario | Primary action |
| `overview.demo` | Try the 3-minute demo | Demo entry |
| `scenario.title` | Set up a shock | Form heading |
| `scenario.run` | Run stress test | Submit |
| `results.title` | What stocks out first? | Results heading |
| `actions.title` | Do this first | Ranked action heading |
| `actions.ceiling` | Budget ceiling: {amount} {currency} | Amount formatting in locale layer |
| `actions.reasonIn` | Included because {reason} | Reason from optimizer record |
| `actions.reasonOut` | Outside the budget because {reason} | No LLM ranking change |
| `capture.confirm` | Confirm and save | Human confirmation |
| `queue.pending` | {count, plural, one {# capture pending} other {# captures pending}} | Offline queue |
| `status.offline` | You’re offline. Saved results are available. | Offline state |

Keep string IDs separate from display strings in the eventual frontend. Do not concatenate translated fragments. Define plural and grammatical variants per locale. Use `Intl.NumberFormat` and `Intl.DateTimeFormat`; do not hardcode comma grouping or month names. Test text expansion to 150%, long facility names, and screen-reader pronunciation of abbreviations. The initial language control is “English / Kiswahili”; remember the selection per device without changing underlying synthetic data.
