/* Preview script: renders states from exported synthetic data. Not production code. */
const D = window.KISUMU_DATA;
// Controls start collapsed on phones.
if (innerWidth < 1024) document.querySelector(".controls details").removeAttribute("open");
const q = new URLSearchParams(location.search);
if (q.get("theme") === "dark") document.documentElement.dataset.theme = "dark";
const day = Number(q.get("day") ?? 45);
const tab = q.get("tab") ?? "map";
const budget = Number(q.get("budget") ?? 30);
const compare = q.get("compare") ?? "shock";
const symbol = { critical: "!", watch: "△", stable: "✓", out: "✕" };
const word = { critical: "Critical", watch: "Watch", stable: "Stable", out: "Out" };
const status = (first) =>
  first === null ? "stable" : first <= 45 ? "critical" : first <= 52 ? "watch" : "stable";
const firstDay = (f) => (compare === "none" ? f.first0 : f.first40);

// Tabs
for (const t of document.querySelectorAll('[role="tab"]')) {
  const on = t.id === `t-${tab}`;
  t.setAttribute("aria-selected", String(on));
  t.tabIndex = on ? 0 : -1;
  document.getElementById(t.getAttribute("aria-controls")).hidden = !on;
}
document.querySelectorAll(".segmented button[aria-pressed]").forEach((b) => {
  if (b.textContent === "No shock") b.setAttribute("aria-pressed", String(compare === "none"));
  if (b.textContent === "40% shock") b.setAttribute("aria-pressed", String(compare !== "none"));
});
if (compare === "none") {
  document.getElementById("scenario-chip").textContent = "No shock · seed 42";
  document.getElementById("m-stockouts").textContent = "2";
  document.getElementById("m-stockouts-label").textContent = "Stockouts with no shock";
  document.getElementById("m-stockouts-note").textContent = "both already short before the shock";
}

// Timeline readout from loaded stockout days (no new modelling).
document.getElementById("day").value = day;
const soFar = D.stockoutDays.filter((d) => d <= day).length;
const outFacilities = D.facilities.filter((f) => f.first40 !== null && f.first40 <= day).length;
document.getElementById("readout").innerHTML =
  `Day <strong>${day}</strong> of 90 · <strong>${soFar}</strong> of 211 stockouts so far · <strong>${outFacilities}</strong> of 40 facilities out of at least one commodity <span class="modeled">· modeled, no intervention</span>`;

// Map: invented areas placed by synthetic coordinates; groups whose labels would overlap merge
// (the same rule as the app). While scrubbing, a cluster shows how many facilities are out.
const map = document.getElementById("map");
const W = map.clientWidth, H = map.clientHeight;
const lon = [34.5, 35.2], lat = [-0.37, -0.02];
const px = (f) => ({ x: 90 + ((f.lon - lon[0]) / (lon[1] - lon[0])) * (W - 180), y: 40 + ((lat[1] - f.lat) / (lat[1] - lat[0])) * (H - 90) });
let groups = Object.values(D.facilities.reduce((g, f) => ((g[f.sub] ??= []).push(f), g), {}));
const centre = (list) => ({ x: list.reduce((s, f) => s + px(f).x, 0) / list.length, y: list.reduce((s, f) => s + px(f).y, 0) / list.length });
for (let merged = true; merged; ) {
  merged = false;
  outer: for (let i = 0; i < groups.length; i++)
    for (let j = i + 1; j < groups.length; j++) {
      const a = centre(groups[i]), b = centre(groups[j]);
      if (Math.abs(a.x - b.x) < 150 && Math.abs(a.y - b.y) < 52) {
        groups[i] = groups[i].concat(groups.splice(j, 1)[0]);
        merged = true;
        break outer;
      }
    }
}
for (const list of groups) {
  const { x, y } = centre(list);
  const out = compare === "none" ? 0 : list.filter((f) => f.first40 !== null && f.first40 <= day).length;
  const mix = { critical: 0, watch: 0, stable: 0 };
  for (const f of list) mix[status(firstDay(f))]++;
  const scrubbing = day > 0 && compare !== "none";
  const worst = scrubbing && out ? "out" : mix.critical ? "critical" : mix.watch ? "watch" : "stable";
  const text = scrubbing
    ? `${out} of ${list.length} out`
    : [`${list.length}`, ...["critical", "watch", "stable"].filter((k) => mix[k]).map((k) => `${mix[k]} ${k === "critical" ? "Crit" : word[k]}`)].join(" · ");
  const b = document.createElement("button");
  b.className = `cluster cluster--${worst}`;
  b.style.left = `${x}px`;
  b.style.top = `${y}px`;
  b.innerHTML = `<span aria-hidden="true">${symbol[worst]}</span><span>${text}</span>`;
  b.setAttribute("aria-label", `${text}${scrubbing ? ` by day ${day}` : ""} · ${list.length} synthetic facilities`);
  map.append(b);
}
map.insertAdjacentHTML("beforeend", '<span class="map-note">Preview: positions from synthetic coordinates; the app keeps the OpenStreetMap basemap.</span>');
const all = { critical: 0, watch: 0, stable: 0 };
for (const f of D.facilities) all[status(firstDay(f))]++;
document.getElementById("counts").textContent =
  `${compare === "none" ? "No" : "40%"} shock · 40 facilities: ${all.critical} Critical · ${all.watch} Watch · ${all.stable} Stable · 2 already short before the shock`;

// Detail panel for the first shock-caused stockout facility.
const pick = D.facilities.find((f) => f.id === "SYN-KE-042-F031");
const route = D.routes.find((r) => r.facility_id === pick.id);
const detail = `
  <h2 class="panel-title">${pick.name}</h2>
  <p><span class="status status--${status(pick.first40)}">${symbol[status(pick.first40)]} ${word[status(pick.first40)]}</span></p>
  <dl>
    <dt>Facility</dt><dd>${pick.id}</dd>
    <dt>Sub-county</dt><dd>${pick.sub}</dd>
    <dt>First stockout</dt><dd>Day ${pick.first40} · ${pick.driver}</dd>
    <dt>Stockouts in run</dt><dd>${pick.events40.length} commodities</dd>
    <dt>Planted transfer</dt><dd>${route ? `${route.donor_facility_id} → ${route.commodity_id}, ${route.distance_km} km, arrives day ${route.arrival_day}` : "None"}</dd>
  </dl>
  <p class="modeled">Commodities by day: ${pick.events40.slice(0, 6).map(([d, c]) => `${c} day ${d}`).join(" · ")}…</p>`;
document.getElementById("detail").innerHTML = detail;
document.getElementById("detail-2").innerHTML = detail;

// Stockout order (first 10 of the loaded list).
const events = D.facilities.flatMap((f) => f.events40.map(([d, c]) => [d, f.id, c])).sort((a, b) => a[0] - b[0] || a[1].localeCompare(b[1]));
document.getElementById("order").innerHTML = events.slice(0, 10).map(([d, f, c]) => `<li>${f} · ${c} · day ${d}</li>`).join("") + '<li class="modeled">… 201 more</li>';

// Fixes: recorded backend rankings at 5, 30 and 100 KES.
const ranked = { 5: D.ranked5, 30: D.ranked30, 100: D.ranked100 }[budget] ?? D.ranked30;
document.getElementById("m-budget").textContent = `${ranked.total_cost} / ${budget}`;
document.getElementById("m-budget-note").textContent = `${ranked.selected_ids.length} fixes funded`;
const effect = Object.fromEntries(ranked.effects.map((e) => [e.id, e.deferred_days]));
const order = [...ranked.selected_ids, ...Object.keys(ranked.excluded_reasons)];
const reasons = {
  alternative_selected: "Another option for this stockout was selected.",
  cost_exceeds_ceiling: "The assumed cost exceeds the ceiling.",
  remaining_budget_exceeded: "Does not fit in the remaining budget.",
};
const routeFor = (id) => D.routes[Number(id.split("-")[1]) - 1];
const bar = document.getElementById("budget-bar");
const max = Math.max(budget, 40);
for (const id of ranked.selected_ids)
  bar.insertAdjacentHTML("beforeend", `<span class="seg" style="width:${(10 / max) * 100}%">${id.replace("transfer-", "T")}</span>`);
bar.insertAdjacentHTML("beforeend", `<span class="cut" style="left:${(budget / max) * 100}%"><span>Budget ${budget} KES</span></span>`);
document.getElementById("fixes").innerHTML = order
  .map((id) => {
    const r = routeFor(id);
    const selected = ranked.selected_ids.includes(id);
    const transfer = id.startsWith("transfer");
    return `<article class="card fix ${selected ? "" : "fix--cut"}">
      <div class="fix-top"><h3>${transfer ? "Transfer" : "Emergency delivery"} → ${r.facility_id.slice(-4)} · ${r.commodity_id}</h3><span class="cost">${transfer ? 10 : 50} KES</span></div>
      <span>${effect[id]} modeled days deferred${transfer ? ` · from ${r.donor_facility_id.slice(-4)}, ${r.distance_km} km` : ""}</span>
      ${selected ? '<span class="badge badge--selected">✓ Selected</span>' : `<span class="badge badge--cut">✕ Not funded</span><span class="reason">${reasons[ranked.excluded_reasons[id]]}</span>`}
    </article>`;
  })
  .join("");

// Funding stage bar.
document.getElementById("funding").innerHTML = `
  <h2 class="panel-title">Where is funding delayed?</h2>
  <p class="modeled">Synthetic funding flow ${D.flow.id} · as of ${D.flow.as_of}</p>
  <ol class="stages">
    <li class="stage stage--done">✓ Approved · 100,000 KES</li>
    <li class="stage stage--stalled" aria-current="step">⏸ Released · 0 KES · Stalled here</li>
    <li class="stage">3 Procured · 0 KES</li>
    <li class="stage">4 Delivered · 0 KES</li>
  </ol>
  <dl style="display:grid;grid-template-columns:max-content 1fr;gap:4px 16px">
    <dt class="modeled">Bottleneck</dt><dd style="margin:0;font-weight:700">Approved, not released · 100,000 KES</dd>
    <dt class="modeled">Approved on</dt><dd style="margin:0;font-weight:700">${D.flow.approved_on}</dd>
    <dt class="modeled">Days waiting</dt><dd style="margin:0;font-weight:700">90</dd>
  </dl>`;

// Facilities table sorted by first stockout.
const rows = [...D.facilities].sort((a, b) => (a.first40 ?? 999) - (b.first40 ?? 999));
document.getElementById("rows").innerHTML = rows
  .slice(0, 12)
  .map((f) => {
    const s = status(f.first40);
    return `<tr ${f.id === pick.id ? 'aria-selected="true"' : ""}><td>${f.name}<br><span class="modeled">${f.id}</span></td><td>${f.sub}</td><td><span class="status status--${s}">${symbol[s]} ${word[s]}</span>${f.short ? '<br><span class="modeled">Already short before the shock</span>' : ""}</td><td>${f.first40 === null ? "—" : `Day ${f.first40}`}</td><td>${f.driver ?? "—"}</td></tr>`;
  })
  .join("");

// Arrow keys move between tabs (preview of the ARIA pattern).
document.querySelector('[role="tablist"]').addEventListener("keydown", (e) => {
  const tabs = [...document.querySelectorAll('[role="tab"]')];
  const i = tabs.indexOf(document.activeElement);
  if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
    const next = tabs[(i + (e.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length];
    next.focus();
  }
});
