# Kisumu v2 preview (Stage 1, for approval)

Static, lightly scripted preview of the redesigned Kisumu page. Not production code; the app is unchanged.
Open `index.html` directly. URL parameters pin states: `theme=dark`, `tab=map|order|fixes|funding|facilities`, `day=0..90`, `budget=5|30|100`, `compare=none`.

All numbers come from `data.js`, exported from the backend-generated fixture (`apps/web/src/fixtures`, generator version 5, seed 42): 211 stockouts at 40%, 209 caused by the shock, first SYN-KE-042-F031 · SYN-C04 on day 41, 10 Critical / 18 Watch / 12 Stable, and the recorded OR-Tools rankings at 5, 30 and 100 KES. The scrubber counts stockouts with day ≤ the selected day from the loaded run (day 0: 0, day 45: 11 stockouts and 10 facilities, day 90: 211 and 40), labeled “modeled, no intervention”. No new modelling.

The map is a schematic stand-in placed by synthetic coordinates; the app keeps the OpenStreetMap basemap and its cluster rules.

Screenshots in `screenshots/`: map at 1280 and 390 px, light and dark; scrubber at day 0, 45 and 90; before/after (no shock); fixes with the budget bar and cut line; facilities table with detail panel; funding stage bar.

Known preview gaps to resolve in Stage 2: the facilities table is cramped beside the detail panel at 1280 px (move the panel below the table or into a drawer); “out” clusters need more contrast in dark mode; Swahili strings are not shown in the preview.
