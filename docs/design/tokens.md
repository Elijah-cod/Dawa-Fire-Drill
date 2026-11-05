# Design tokens and accessibility

All colors are CSS-variable candidates, not frontend code. Ratios below were calculated using WCAG relative luminance. Recheck in the rendered interface, including disabled and hover states.

| Role | Light | Dark | Use |
|---|---|---|---|
| Canvas | `#F7F8F4` | `#0F1B22` | App background |
| Surface | `#FFFFFF` | `#172A32` | Cards, panels |
| Ink | `#14212B` | `#F6F7F2` | Main text; 15.36:1 on light canvas, 16.25:1 on dark canvas |
| Muted ink | `#344A52` | `#A7C7C4` | Secondary text; dark pair 9.67:1 |
| Primary | `#155E63` | `#8AD5CF` | Primary button; white on light primary 7.46:1, dark canvas ink on dark primary 10.41:1 |
| Border | `#B4C3C4` | `#4C666B` | Separators and control boundaries |
| Critical | `#9B2C2C` | `#FFB4A8` | Critical label with icon and text; white on light critical 7.53:1 |
| Watch | `#7A4A00` on `#FFF1CC` | `#FFD58B` on `#3A2B16` | Watch label with triangle and text; light pair 6.66:1 |
| Stable | `#1F6B4A` | `#91D5B0` | Stable label with check and text; white on light stable 6.44:1 |
| Focus | `#155E63` | `#8AD5CF` | 3px focus ring plus 2px offset |

Risk categories are **Critical / Watch / Stable / Unknown**, each with a text label and distinct icon or pattern. Critical uses an octagon/exclamation and solid bar; Watch uses a triangle and striped bar; Stable uses a check and dotted bar; Unknown uses a question mark and neutral outline. Maps and charts also expose a list/table with the same values. Do not encode urgency by hue alone.

Type: system sans for UI, with Noto Sans fallback for Swahili diacritics. Sizes in rem: display 2.25/2.6, h1 1.875/2.25, h2 1.5/1.875, h3 1.25/1.625, body 1/1.5, detail 0.875/1.25, caption 0.75/1.125. Body never drops below 16px for primary reading. Numbers use tabular figures; measurements always include units.

Spacing uses a 4px base: `1=4`, `2=8`, `3=12`, `4=16`, `6=24`, `8=32`, `12=48`. Radius: control 8px, card 12px, sheet 16px. Elevation: flat by default, one subtle shadow for a raised sheet, stronger shadow only for a modal. Borders carry grouping in dark mode. No glass or blur effect over data.

Motion: 120ms for pressed feedback, 180ms for panels, 240ms for sheet transitions; ease-out on entrance and ease-in on exit. Never animate stockout order or ranking position without an explicit “updated” announcement. Under `prefers-reduced-motion`, remove movement and keep an immediate state change. No auto-playing motion. Loading skeletons preserve final layout geometry.

Accessibility: WCAG AA target; normal text ≥4.5:1, large text and meaningful graphics ≥3:1; visible focus; semantic headings; form labels above fields; inline validation plus summary; keyboard reachable actions; `aria-live` for completed runs and queue sync; 44×44px minimum targets with at least 8px separation; zoom to 200% without loss of content; no horizontal page scroll.
