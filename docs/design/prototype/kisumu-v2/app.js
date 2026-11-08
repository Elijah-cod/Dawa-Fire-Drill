/* Kisumu v3 preview script. Renders from data.js (backend exports); never invents numbers. */
const D = window.KISUMU_DATA;
const H = D.horizon;
const SHOCKS = [0, 20, 40, 100];
const q = new URLSearchParams(location.search);
const state = {
  shock: q.has("shock") && SHOCKS.includes(Number(q.get("shock"))) ? Number(q.get("shock")) : 40,
  compare: q.get("compare") === "none" ? "none" : "shock",
  budget: Math.min(100, Math.max(0, Math.round(Number(q.get("budget") ?? 30) / 5) * 5)),
  tab: ["overview", "order", "funding", "facilities"].includes(q.get("tab")) ? q.get("tab") : "overview",
  day: Math.min(H, Math.max(0, Number(q.get("day") ?? 45))),
  facility: q.get("facility") ?? null,
};
// The budget whose ranking is on screen; it trails state.budget while a ranking is in flight.
let rankedBudget = state.budget;
if (q.get("theme") === "dark") document.documentElement.dataset.theme = "dark";

const byId = Object.fromEntries(D.facilities.map((f) => [f.id, f]));
const STATUS = {
  critical: { word: "Critical", icon: "i-critical" },
  watch: { word: "Watch", icon: "i-watch" },
  stable: { word: "Stable", icon: "i-stable" },
  unknown: { word: "Unknown", icon: "i-unknown" },
};
const CATEGORY = {
  antimalarial: "Antimalarial",
  malaria_diagnostic: "Malaria test",
  family_planning: "Family planning",
  antiretroviral: "Antiretroviral",
};
const commodity = Object.fromEntries(
  D.commodities.map((c) => [c.id, `${CATEGORY[c.category] ?? c.category} tracer ${c.id.slice(-2)}`]),
);
const med = (id) => commodity[id] ?? id;
const lower = (text) => text.charAt(0).toLowerCase() + text.slice(1);
const icon = (id, cls = "icon icon--sm") => `<svg class="${cls}" aria-hidden="true"><use href="#${id}" /></svg>`;
const chip = (s) => `<span class="status status--${s}">${icon(STATUS[s].icon)}${STATUS[s].word}</span>`;
const place = (f) => `${f.name} (${f.sub})`;
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** The run in view: the selected shock, or the no-shock run when comparing. */
const shownShock = () => (state.compare === "none" ? 0 : state.shock);
const run = () => D.runs[shownShock()];
const asEvents = (rows) =>
  rows
    .map(([f, c, d]) => ({ facility: byId[f], commodity: c, day: d }))
    .sort((a, b) => a.day - b.day || a.facility.id.localeCompare(b.facility.id));
/** Shock-caused events exactly as the backend lists them. */
const shockEvents = (r) => asEvents(r.shockEvents);
/** Events that happen without the shock: opening gaps and no-shock stockouts. */
const alreadyShort = (r) => asEvents([...r.preEvents, ...r.noShockEvents]);

/** Earliest stockout per facility in the shown run; cutoffs match the app (≤45, 46–52, >52). */
function facilityView(r) {
  const first = {};
  for (const [f, c, d] of r.stockouts) if (!first[f] || d < first[f].day) first[f] = { day: d, commodity: c };
  const short = new Set([...r.preEvents, ...r.noShockEvents].map(([f]) => f));
  return D.facilities.map((f) => {
    const e = first[f.id] ?? null;
    const status = !e ? "stable" : e.day <= 45 ? "critical" : e.day <= 52 ? "watch" : "stable";
    return { ...f, first: e, status, alreadyShort: short.has(f.id) };
  });
}

const ranking = (budget = rankedBudget) => run().rankings[budget] ?? null;
const effectText = (e) => (e.counterfactual === null ? `stocked through day ${H}` : `stockout moves to day ${e.counterfactual}`);

/** Why there is nothing to rank at this shock, from backend arrival days and stockout days. */
function noFixReason(r) {
  const targets = D.routes.map((route) => {
    const e = r.shockEvents.find(([f, c]) => f === route.facility_id && c === route.commodity_id);
    return { arrival: route.arrival_day, day: e ? e[2] : null };
  });
  const arrivals = targets.map((t) => t.arrival);
  const days = targets.filter((t) => t.day !== null).map((t) => t.day);
  return `None of the ${D.routes.length} listed transfers can arrive in time: they arrive from day ${Math.min(...arrivals)}, but their stockouts happen by day ${Math.max(...days)}.`;
}

/** One sentence that answers: what breaks first, and what is the cheapest fix under the budget? */
function verdict() {
  const r = run();
  const shock = shownShock();
  const first =
    shock === 0
      ? `With no shock, nothing new runs out within ${H} days.`
      : (() => {
          const e = shockEvents(r)[0];
          return `A ${shock}% cut in donor logistics support causes <strong>${plural(r.shockEvents.length, "stockout")}</strong> within ${H} days; <strong>${place(e.facility)}</strong> runs out of ${lower(med(e.commodity))} first, on day ${e.day}.`;
        })();
  let fix;
  if (shock === 0) fix = "There is nothing to fix.";
  else if (!r.candidates.length) fix = noFixReason(r);
  else {
    const k = ranking();
    const funded = k.selected.filter((id) => id.startsWith("transfer"));
    const cut = Object.entries(k.excluded).filter(([id, why]) => id.startsWith("transfer") && why === "remaining_budget_exceeded");
    const cheapest = Math.min(...r.candidates.map((c) => c.cost));
    if (!k.selected.length) fix = `At ${rankedBudget} KES, nothing fits the budget; the cheapest fix costs ${cheapest} KES.`;
    else {
      const allHold = funded.every((id) => k.effects[id].counterfactual === null);
      fix = `At ${rankedBudget} KES the optimizer funds <strong>${plural(funded.length, "transfer")}</strong> (${k.total_cost} KES)${
        allHold ? `, each keeping its facility stocked through day ${H}` : ""
      }.`;
      if (cut.length) {
        const names = cut.map(([id]) => {
          const c = r.candidates.find((x) => x.id === id);
          const e = r.shockEvents.find(([f, cc]) => f === c.facility_id && cc === c.commodity_id);
          return `${byId[c.facility_id].name} (day ${e[2]})`;
        });
        fix += ` ${names.join(", ")} ${cut.length === 1 ? "does" : "do"} not fit what is left.`;
      }
    }
  }
  document.getElementById("verdict").innerHTML = first;
  // The budget sentence has its own reserved line so a ranking that arrives later never moves the page.
  document.getElementById("verdict-fix").innerHTML = fix;
  const view = facilityView(r);
  const count = (s) => view.filter((f) => f.status === s).length;
  const short = alreadyShort(r);
  document.getElementById("facts").innerHTML = [
    `<li><strong>${r.stockouts.length}</strong> stockouts in total: ${r.shockEvents.length} caused by the shock, ${short.length} already short before it (${short
      .map((s) => `${s.facility.name} from day ${s.day}`)
      .join(", ")})</li>`,
    `<li>${count("critical")} Critical · ${count("watch")} Watch · ${count("stable")} Stable</li>`,
  ].join("");
  document.getElementById("scenario").textContent = shock === 0 ? "No shock" : `${shock}% logistics cut`;
  document.getElementById("order-count").textContent = r.shockEvents.length;
}

function controls() {
  document.getElementById("shock-presets").innerHTML = SHOCKS.map(
    (s) => `<button type="button" data-shock="${s}" aria-pressed="${s === state.shock}">${s}%</button>`,
  ).join("");
  const shockLabel = state.shock === 0 ? "0% (no shock)" : `${state.shock}% cut`;
  document.getElementById("compare").innerHTML = [
    ["none", "No shock"],
    ["shock", shockLabel],
  ]
    .map(([v, label]) => `<button type="button" data-compare="${v}" aria-pressed="${state.compare === v}">${label}</button>`)
    .join("");
}

function tabs() {
  for (const t of document.querySelectorAll('[role="tab"]')) {
    const on = t.id === `t-${state.tab}`;
    t.setAttribute("aria-selected", String(on));
    t.tabIndex = on ? 0 : -1;
    document.getElementById(t.getAttribute("aria-controls")).hidden = !on;
  }
}

/* Timeline */
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
let playing = null;

function timeline() {
  const r = run();
  const soFar = r.stockouts.filter(([, , d]) => d <= state.day).length;
  const out = new Set(r.stockouts.filter(([, , d]) => d <= state.day).map(([f]) => f)).size;
  const el = document.getElementById("timeline");
  if (!el.firstChild) {
    el.innerHTML = `
      <div class="btn-row" role="group" aria-label="Timeline">
        <button class="btn" type="button" id="prev-week" aria-label="Back one week">${icon("i-prev", "icon")}</button>
        ${reducedMotion ? "" : `<button class="btn" type="button" id="play" aria-label="Play the run">${icon("i-play", "icon")}</button>`}
        <button class="btn" type="button" id="next-week" aria-label="Forward one week">${icon("i-next", "icon")}</button>
      </div>
      <div><label class="visually-hidden" for="day">Day of the ${H}-day run</label><input id="day" type="range" min="0" max="${H}" /></div>
      <p class="readout" id="readout" aria-live="polite"></p>`;
  }
  document.getElementById("day").value = state.day;
  document.getElementById("readout").innerHTML = `Day <strong>${state.day}</strong> of ${H}: <strong>${soFar}</strong> of ${r.stockouts.length} stockouts so far, <strong>${out}</strong> of 40 facilities out of at least one commodity. <span class="modeled">Modeled, no intervention.</span>`;
}

function setDay(day) {
  state.day = Math.min(H, Math.max(0, day));
  timeline();
  map();
}

function togglePlay() {
  const b = document.getElementById("play");
  if (playing) {
    clearInterval(playing);
    playing = null;
  } else {
    if (state.day >= H) setDay(0);
    playing = setInterval(() => {
      setDay(state.day + 1);
      if (state.day >= H) togglePlay();
    }, 120);
  }
  b.setAttribute("aria-label", playing ? "Pause the run" : "Play the run");
  b.innerHTML = icon(playing ? "i-pause" : "i-play", "icon");
}

/* Map */
function map() {
  const r = run();
  const el = document.getElementById("map");
  const areas = {};
  for (const f of D.facilities) (areas[f.sub] ??= []).push(f);
  const lon = [34.48, 35.22], lat = [-0.38, 0.0];
  const outBy = new Set(r.stockouts.filter(([, , d]) => d <= state.day).map(([f]) => f));
  const legendText = `<div class="map-legend"><strong>Out by day ${state.day} / facilities in the area.</strong>
      <span class="key"><span class="area-key" data-out="none"></span>None out</span>
      <span class="key"><span class="area-key" data-out="some"></span>Some out</span>
      <span class="key"><span class="area-key" data-out="all"></span>All out</span>
      <span class="key">Positions are invented.</span></div>`;
  el.innerHTML = legendText;
  const W = el.clientWidth,
    Hh = el.clientHeight - el.querySelector(".map-legend").offsetHeight - 16;
  const MW = 60,
    MH = 48;
  // Place by synthetic coordinates, then nudge overlapping markers apart.
  const pts = Object.entries(areas).map(([sub, list]) => {
    const x = list.reduce((s, f) => s + f.lon, 0) / list.length;
    const y = list.reduce((s, f) => s + f.lat, 0) / list.length;
    const out = list.filter((f) => outBy.has(f.id)).length;
    return {
      sub,
      list,
      out,
      x: MW / 2 + 8 + ((x - lon[0]) / (lon[1] - lon[0])) * (W - MW - 16),
      y: MH / 2 + 8 + ((lat[1] - y) / (lat[1] - lat[0])) * (Hh - MH - 8),
    };
  });
  for (let pass = 0; pass < 40; pass++) {
    let moved = false;
    for (let i = 0; i < pts.length; i++)
      for (let j = i + 1; j < pts.length; j++) {
        const a = pts[i],
          b = pts[j];
        if (Math.abs(a.x - b.x) < MW + 4 && Math.abs(a.y - b.y) < MH + 4) {
          const push = (MH + 4 - Math.abs(a.y - b.y)) / 2 + 1;
          const [top, bottom] = a.y <= b.y ? [a, b] : [b, a];
          top.y -= push;
          bottom.y += push;
          const side = (MW + 4 - Math.abs(a.x - b.x)) / 4;
          const [left, right] = a.x <= b.x ? [a, b] : [b, a];
          left.x -= side;
          right.x += side;
          moved = true;
        }
      }
    for (const p of pts) {
      p.y = Math.min(Hh - MH / 2, Math.max(MH / 2 + 4, p.y));
      p.x = Math.min(W - MW / 2 - 4, Math.max(MW / 2 + 4, p.x));
    }
    if (!moved) break;
  }
  const markers = pts.map(({ sub, list, out, x, y }) => {
    const level = out === 0 ? "none" : out === list.length ? "all" : "some";
    return `<span class="area" role="img" data-out="${level}" style="left:${x}px;top:${y}px" aria-label="${sub}: ${out} of ${list.length} facilities out by day ${state.day}">${out}/${list.length}</span>`;
  });
  el.innerHTML = markers.join("") + legendText;
}

function areaList() {
  const areas = {};
  for (const f of facilityView(run())) (areas[f.sub] ??= []).push(f);
  document.getElementById("areas").innerHTML = Object.entries(areas)
    .map(([sub, list]) => {
      const n = (s) => list.filter((f) => f.status === s).length;
      return `<li><span>${sub} · ${plural(list.length, "facility", "facilities")}</span><span class="mix">
        <span class="c">${icon("i-critical")}${n("critical")}<span class="visually-hidden"> Critical</span></span>
        <span class="w">${icon("i-watch")}${n("watch")}<span class="visually-hidden"> Watch</span></span>
        <span class="s">${icon("i-stable")}${n("stable")}<span class="visually-hidden"> Stable</span></span></span></li>`;
    })
    .join("");
}

/* Fixes: the slider is built once per run; changes update only the bar, status and pairs. */
const REASONS = {
  alternative_selected: "A cheaper option already covers this stockout",
  cost_exceeds_ceiling: "Costs more than the whole budget",
  remaining_budget_exceeded: "Does not fit in what is left of the budget",
  not_selected_by_optimal_set: "Not in the optimizer's best set",
};
// Preview-only switches for states the live app reaches through the backend.
const pinned = q.get("state");
let inFlight = pinned === "inflight";
let failed = pinned === "failed";
let loading = pinned === "loading";
let timer = null;
let fixesRun = null;

function optionName(c) {
  return c.kind === "redistribution"
    ? `Transfer<span class="via">from ${byId[c.donor].name}, ${c.km} km away</span>`
    : "Emergency delivery";
}

/** Show option IDs from the optimizer's explanation as facility names; the text is otherwise unchanged. */
function readableExplanation(text, r) {
  return text.replace(/\b(transfer|emergency)-(\d+)\b/g, (id) => {
    const c = r.candidates.find((x) => x.id === id);
    if (!c) return id;
    const to = `${byId[c.facility_id].name} (${lower(med(c.commodity_id))})`;
    return c.kind === "redistribution" ? `the transfer to ${to}` : `emergency delivery to ${to}`;
  });
}

function fixesShell() {
  const r = run();
  const el = document.getElementById("fixes");
  const head = `<h2 id="fixes-title">Cheapest fixes</h2><p class="sub">OR-Tools picks what fits the budget. Costs are illustrative assumptions.</p>`;
  fixesRun = shownShock();
  if (loading) {
    el.setAttribute("aria-busy", "true");
    el.innerHTML = `${head}<p class="state" role="status">Loading the ranked fixes…</p><div class="skeleton" style="width:80%"></div><div class="skeleton" style="width:60%"></div><div class="skeleton" style="width:70%"></div>`;
    return;
  }
  el.removeAttribute("aria-busy");
  if (!r.candidates.length) {
    el.innerHTML = `${head}<div class="finding" role="status">${
      shownShock() === 0
        ? "<strong>With no shock, nothing to fix.</strong> No stockouts are caused by the shock."
        : `<strong>No transfer can arrive in time at this shock.</strong> ${noFixReason(r)}`
    }</div>`;
    return;
  }
  el.innerHTML = `${head}
    <label class="field-label" for="budget">Budget (KES)</label>
    <div class="budget-control">
      <input id="budget" type="range" min="0" max="100" step="5" value="${state.budget}" aria-describedby="budget-status" />
      <input id="budget-number" type="number" min="0" max="100" step="5" value="${state.budget}" aria-label="Budget in KES" />
    </div>
    <div id="budget-bar"></div>
    <div id="budget-status-slot"></div>
    <ol class="pairs" id="pairs"></ol>
    <section class="explain"><h3>Optimizer explanation</h3><p id="explanation"></p></section>`;
  fixesUpdate();
}

function fixesUpdate() {
  const r = run();
  if (!r.candidates.length || loading) return;
  const k = ranking();
  // Bar: funded segments from the ranking on screen; the cut line follows the slider at once.
  let x = 0;
  const segs = k.selected.map((id) => {
    const c = r.candidates.find((c) => c.id === id);
    const seg = `<span class="seg" style="left:${x}%;width:${c.cost}%"></span>`;
    x += c.cost;
    return seg;
  });
  document.getElementById("budget-bar").innerHTML = `<div class="budget-bar" aria-hidden="true">${segs.join("")}<span class="cut" style="left:${state.budget}%"><span>${state.budget} KES</span></span></div>`;
  const cheapest = Math.min(...r.candidates.map((c) => c.cost));
  let status;
  if (failed)
    status = `<div class="state state--error" role="alert">${icon("i-critical")}<span>The ranking for ${state.budget} KES could not be updated. The fixes below are for ${rankedBudget} KES, the last budget that ranked.<br><button class="btn" type="button" id="retry">Try again</button></span></div>`;
  else if (inFlight)
    status = `<p class="state" role="status" id="budget-status">Updating the ranking for ${state.budget} KES… Showing ${rankedBudget} KES until it arrives.</p>`;
  else if (!k.selected.length)
    status = `<p class="state" role="status" id="budget-status">Nothing fits ${rankedBudget} KES. The cheapest fix costs ${cheapest} KES.</p>`;
  else status = `<p class="state" role="status" id="budget-status">${k.total_cost} of ${rankedBudget} KES used.</p>`;
  document.getElementById("budget-status-slot").innerHTML = status;
  const events = r.shockEvents;
  const pairs = [];
  for (let i = 0; i < r.candidates.length; i += 2) {
    const [t, e] = [r.candidates[i], r.candidates[i + 1]];
    const ev = events.find(([f, c]) => f === t.facility_id && c === t.commodity_id);
    const same = effectText(k.effects[t.id]) === effectText(k.effects[e.id]);
    const option = (c) => {
      const funded = k.selected.includes(c.id);
      return `<li class="option ${funded ? "option--funded" : "option--cut"}"><span class="name">${optionName(c)}</span><span class="cost">${c.cost} KES</span><span class="why">${
        funded ? `${icon("i-stable")}Funded` : `Not funded: ${REASONS[k.excluded[c.id]] ?? "reason unavailable"}`
      }${same ? "" : ` · if funded, ${effectText(k.effects[c.id])}`}</span></li>`;
    };
    const f = byId[t.facility_id];
    pairs.push(`<li class="pair">
      <h3>${f.name}: ${lower(med(t.commodity_id))}</h3>
      <p class="meta">${f.sub} · runs out on day ${ev[2]}${same ? ` · if funded, either option keeps it ${effectText(k.effects[t.id])}` : ""}</p>
      <ul class="pairs">${option(t)}${option(e)}</ul>
    </li>`);
  }
  const list = document.getElementById("pairs");
  list.innerHTML = pairs.join("");
  list.toggleAttribute("aria-busy", inFlight);
  document.getElementById("explanation").textContent = readableExplanation(k.explanation, r);
}

function setBudget(value, { fromNumber = false } = {}) {
  state.budget = Math.min(100, Math.max(0, Math.round(value / 5) * 5));
  failed = false;
  inFlight = true;
  const range = document.getElementById("budget");
  const number = document.getElementById("budget-number");
  if (fromNumber) range.value = state.budget;
  else number.value = state.budget;
  fixesUpdate();
  clearTimeout(timer);
  // The app debounces the backend ranking call; the preview shows the same in-flight state.
  timer = setTimeout(() => {
    inFlight = false;
    rankedBudget = state.budget;
    if (fromNumber) number.value = state.budget;
    fixesUpdate();
    verdict();
  }, 350);
}

function order() {
  const r = run();
  const events = shockEvents(r);
  const short = alreadyShort(r);
  const item = (e) => `<li>${place(e.facility)} · ${lower(med(e.commodity))} · day ${e.day}</li>`;
  document.getElementById("order").innerHTML = `
    <h2>Stockout order</h2>
    <p class="sub">${shownShock() === 0 ? "No shock" : `${shownShock()}% logistics cut`}: ${r.stockouts.length} stockouts in total.</p>
    <h3 class="group-title">Already short before the shock (${short.length})</h3>
    <ol class="order">${short.map((s) => `<li>${place(s.facility)} · ${lower(med(s.commodity))} · from day ${s.day}</li>`).join("")}</ol>
    <h3 class="group-title">Caused by the shock (${events.length})</h3>
    ${
      events.length
        ? `<ol class="order">${events.slice(0, 10).map(item).join("")}</ol>${
            events.length > 10
              ? `<details><summary class="btn" style="margin-top:8px">Show all ${events.length}</summary><ol class="order" start="11">${events.slice(10).map(item).join("")}</ol></details>`
              : ""
          }`
        : `<p class="state">Nothing runs out because of the shock in this run.</p>`
    }`;
}

function funding() {
  const f = D.flow;
  const b = D.funding.bottlenecks[0];
  const stalledAt = { approved_not_released: 1, released_not_procured: 2, procured_not_delivered: 3 }[b?.stage];
  document.getElementById("funding").innerHTML = `
    <h2>Where is funding delayed?</h2>
    <p class="sub">Flow ${f.id} · as of ${f.as_of}</p>
    <ol class="stages">${D.fundingStages
      .map(([name, amount], i) => {
        const cls = i < stalledAt ? "stage stage--done" : i === stalledAt ? "stage stage--stalled" : "stage";
        return `<li class="${cls}" ${i === stalledAt ? 'aria-current="step"' : ""}><span class="step" aria-hidden="true">${i + 1}</span><span>${name}${
          i === stalledAt ? ` <span class="flag">${icon("i-pause-stage")}Stalled here</span>` : ""
        }<span class="amount">${amount.toLocaleString("en-KE")} KES</span></span></li>`;
      })
      .join("")}</ol>
    <dl class="detail-list">
      <dt>Bottleneck</dt><dd>Approved, not released · ${b.amount.toLocaleString("en-KE")} KES</dd>
      <dt>Approved on</dt><dd>${f.approved_on}</dd>
      <dt>Waiting</dt><dd>${b.age_days} days</dd>
    </dl>`;
}

function facilities() {
  const r = run();
  const view = facilityView(r).sort((a, b) => (a.first?.day ?? 999) - (b.first?.day ?? 999));
  const sel = byId[state.facility] ? state.facility : view.find((f) => !f.alreadyShort && f.first)?.id ?? view[0].id;
  const f = view.find((v) => v.id === sel);
  const events = r.stockouts.filter(([id]) => id === sel).sort((a, b) => a[2] - b[2]);
  document.getElementById("facilities").innerHTML = `
    <h2>Facilities</h2>
    <div class="table-wrap"><table>
      <caption>${shownShock() === 0 ? "No shock" : `${shownShock()}% logistics cut`} · sorted by first stockout</caption>
      <thead><tr><th scope="col">Facility</th><th scope="col">Status</th><th scope="col" aria-sort="ascending">First stockout</th><th scope="col">Runs out of</th></tr></thead>
      <tbody>${view
        .map(
          (v) =>
            `<tr ${v.id === sel ? 'aria-selected="true"' : ""}><td>${v.name}<br><span class="modeled">${v.sub}</span></td><td>${chip(v.status)}${
              v.alreadyShort ? `<br><span class="short-tag">${icon("i-short")}Already short before the shock</span>` : ""
            }</td><td>${v.first ? `Day ${v.first.day}` : `None within ${H} days`}</td><td>${v.first ? med(v.first.commodity) : "—"}</td></tr>`,
        )
        .join("")}</tbody>
    </table></div>
    <section class="detail" aria-label="Selected facility">
      <h3>${f.name}</h3>
      <dl>
        <dt>ID</dt><dd>${f.short}</dd>
        <dt>Area</dt><dd>${f.sub}</dd>
        <dt>Status</dt><dd>${chip(f.status)}</dd>
        <dt>Runs out of</dt><dd>${
          events.length ? events.map(([, c, d]) => `${med(c)} (${c.slice(-3)}) on day ${d}`).join(", ") : `Nothing within ${H} days`
        }</dd>
      </dl>
    </section>`;
}

function render() {
  controls();
  verdict();
  tabs();
  timeline();
  map();
  areaList();
  fixesShell();
  order();
  funding();
  facilities();
}
render();

document.getElementById("about-link").addEventListener("click", (e) => {
  e.preventDefault();
  const about = document.getElementById("about");
  about.hidden = !about.hidden;
  e.currentTarget.setAttribute("aria-expanded", String(!about.hidden));
});
document.getElementById("shock-presets").addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  state.shock = Number(b.dataset.shock);
  state.compare = "shock";
  render();
});
document.getElementById("compare").addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  state.compare = b.dataset.compare;
  render();
});
const tablist = document.querySelector('[role="tablist"]');
tablist.addEventListener("click", (e) => {
  const t = e.target.closest('[role="tab"]');
  if (!t) return;
  state.tab = t.id.slice(2);
  tabs();
});
// Automatic activation: arrows, Home and End move to and select a tab.
tablist.addEventListener("keydown", (e) => {
  const all = [...tablist.querySelectorAll('[role="tab"]')];
  const i = all.findIndex((t) => t.id === `t-${state.tab}`);
  const next = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: all.length - 1 }[e.key];
  if (next === undefined) return;
  e.preventDefault();
  const t = all[(next + all.length) % all.length];
  state.tab = t.id.slice(2);
  tabs();
  t.focus();
});
document.addEventListener("click", (e) => {
  if (e.target.closest("#prev-week")) setDay(state.day - 7);
  if (e.target.closest("#next-week")) setDay(state.day + 7);
  if (e.target.closest("#play")) togglePlay();
  if (e.target.id === "retry") {
    failed = false;
    setBudget(state.budget);
  }
});
document.addEventListener("input", (e) => {
  if (e.target.id === "budget") setBudget(Number(e.target.value));
  if (e.target.id === "day") setDay(Number(e.target.value));
});
// The number field snaps only when the user commits (blur or Enter), never per keystroke.
document.addEventListener("change", (e) => {
  if (e.target.id === "budget-number") setBudget(Number(e.target.value), { fromNumber: true });
});
