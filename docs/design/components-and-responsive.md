# Component inventory and responsive rules

## Components

| Component | Variants and states | Accessibility behavior |
|---|---|---|
| App shell | Mobile bottom bar; desktop side rail; light/dark | Current page announced; skip-to-content link; five mobile destinations max |
| Synthetic banner | Full width; compact mobile | Persistent text, never dismissible in decision screens |
| Primary/secondary/destructive button | Default, hover, focus, pressed, disabled, loading | 44px minimum; loading keeps label and announces progress |
| Scenario control | Slider plus number field, presets, validation | Shared value, keyboard increments, explicit unit and bounds |
| Budget ceiling | Currency amount, current use, limit exceeded | KES label, grouped numerals, error inline; no silent clipping |
| Risk badge | Critical, Watch, Stable, Unknown | Icon, word, pattern; never color only |
| Map and list | Region map, selected region, unavailable | Equivalent ordered list; keyboard selectable regions; text alternative |
| Stockout timeline | Chronological items, ties, unknown date | Date and commodity read as text; no meaning from x-position alone |
| Action card | Selected, outside ceiling, infeasible, pending | Rank number, cost, in/out reason, details control |
| Trace stage | Approved, Released, Procured, Delivered, missing | Stage label, amount, age, status; list alternative to graph |
| Stock table/card | Desktop rows, mobile stacked cards | Header association and visible labels in cards |
| Capture preview | Camera, upload, queued, extraction, review | Image alt/description field; manual entry always available |
| Offline queue | Empty, pending, syncing, conflict, synced | Count and last sync; no silent overwrite on conflict |
| Dialog/sheet | Confirmation, error, map, explanation | Focus trap, Escape close where safe, focus return, body scroll lock |
| Toast/status | Saved, queued, undone, sync failed | Polite announcement; persistent errors remain visible |

## Responsive behavior

Design at 360, 390, 768, 1024, 1280, and 1536px widths. Test the 390×844, 768×1024, 1280×800, and 1536×900 viewport projects. Layout is mobile first. At 360 and 390, use one column with 16px gutters and bottom navigation above the safe area. At 768, use two columns only for peer cards; navigation may remain compact. At 1024 and above, switch to a side rail and content grid. At 1280 and 1536, constrain reading panels to 760px and use remaining width for contextual map or details. No fixed-width element may force horizontal scroll.

On mobile, the map opens as a full-screen sheet with a bottom drawer for the selected district; the ordered list remains accessible before opening it. Tables become labeled cards. Filters collapse into a sheet with an active-filter count. The action list appears before optional visualizations. On desktop, results list and map may sit side by side; the action list retains priority in reading order.

All controls respect safe-area insets. Sticky footer actions must not cover content or the bottom bar. A modal becomes a bottom sheet on mobile except for confirmation dialogs requiring a clear cancel/confirm choice. Long Swahili labels wrap; button width grows or text wraps without clipping. Locale, theme, and currency presentation are independent of country adapter data.
