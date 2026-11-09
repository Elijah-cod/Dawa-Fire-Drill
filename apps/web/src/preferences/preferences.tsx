"use client";

import {
  createContext,
  Fragment,
  isValidElement,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

const strings = {
  en: {
    overviewTitle: "Where would you act first?",
    overviewLead: "Rehearse a supply shock using synthetic examples.",
    overview: "Overview",
    navKisumu: "Kisumu",
    navFunding: "Funding trace",
    navCapture: "Bin-card capture",
    navPrimary: "Primary",
    navMobile: "Primary (mobile)",
    kenya: "Kenya · County planning workspace",
    banner:
      "Facilities, names, locations and costs are invented. Results are illustrative, not validated.",
    aboutLink: "About this demo",
    aboutSandbox:
      "This is a stress-test sandbox, not a live monitoring system or a government system.",
    aboutInvented:
      "Facilities, names, coordinates, stock levels and costs are invented. Only some scale parameters (facility mix, lead times, demand and funding totals) are anchored to public aggregates, as documented in the project's data assumptions. Nothing is validated.",
    aboutMethod:
      "Runs come from a reproducible generator (version 5, seed 42). OR-Tools ranks the fixes; the plain-language explanation only restates its result.",
    aboutTerms:
      "A stockout is one facility running out of one commodity within the 90-day run. Costs are illustrative units, not calibrated to real prices.",
    syntheticNote: "Synthetic examples only. Illustrative and unvalidated.",
    gridTitle: "Kenya counties",
    gridDescription:
      "Schematic, not to scale. Select a county for planning information.",
    gridLabel: "Schematic county grid",
    planningOverview: "County planning overview",
    county: "county",
    openMap: "Open schematic map",
    mapTitle: "Schematic county map",
    closeMap: "Close map",
    countyList: "County list",
    search: "Search counties",
    empty: "No counties match these filters.",
    selectCounty:
      "Select a county to inspect its synthetic planning information.",
    pilot: "Kisumu is the synthetic facility pilot.",
    exploreKisumu: "Explore Kisumu pilot",
    planningOnly:
      "Planning overview only; facility simulation is not available.",
    unavailable: "County planning data is unavailable.",
    partial: "Some county planning inputs are unavailable.",
    loading: "Loading synthetic county planning data…",
    offline:
      "Offline. County names remain available; planning data may be unavailable.",
    retry: "Retry",
    approved: "Synthetic approved all-sector budget",
    released: "Synthetic release proxy",
    demoRole: "Demo role",
    nationalPlanner: "National planner",
    kisumuPlanner: "Kisumu planner",
    pharmacist: "Pharmacist",
    facility: "Facility",
    accessDenied: "You do not have access to this county overview.",
    sessionMissing: "Session unavailable.",
    sessionExpired: "Session expired.",
    facilityLocationsSynthetic: "Facility locations are synthetic.",
    openFacilityMap: "Open facility map",
    facilityMapTitle: "Synthetic facility map",
    facilityMapUnavailable: "Facility map unavailable; use the facility list.",
    facilityMapPartial: "Some synthetic facility coordinates are unavailable.",
    mapTilesUnavailable:
      "Map tiles are unavailable; facility markers and the list remain available.",
    riskLegend: "Illustrative stockout risk",
    critical: "Critical",
    watch: "Watch",
    stable: "Stable",
    unknown: "Unknown",
    days: "days to stockout",
    noStockout: "No stockout within the run horizon",
    noRiskData: "No forecast or run is available",
    drivers: "Driving commodities",
    kisumuTitle: "Kisumu",
    scenarioNone: "No shock",
    scenarioCut: "{n}% logistics cut",
    verdictLabel: "What breaks first",
    verdictLoading: "Running the {n}% scenario…",
    verdictFraming:
      "Stress-testing Kisumu: what breaks first if donor logistics support is cut, and what is the cheapest fix?",
    verdictNoShock: "With no shock, nothing new runs out within {h} days.",
    verdictLead:
      "A {n}% cut in donor logistics support causes {count} within {h} days; {place} runs out of {medicine} first, on day {day}.",
    verdictNone:
      "A {n}% cut in donor logistics support causes no new stockouts within {h} days.",
    verdictStockouts: "{n} stockouts",
    verdictStockout: "{n} stockout",
    verdictPlace: "{name} ({area})",
    verdictScopeEarliest:
      "The fixes address only the {n} earliest of {total} shock-caused stockouts.",
    verdictScopeSome:
      "The fixes address only {n} of {total} shock-caused stockouts (days {first} to {last}).",
    verdictNothingToFix: "There is nothing to fix.",
    verdictLate:
      "None of the {n} listed transfers can arrive in time: they arrive from day {arrival}, but their stockouts happen by day {day}.",
    verdictUnavailable: "Stockout details are unavailable for this run.",
    factsTotal:
      "{total} stockouts in total: {caused} caused by the shock, {short} already short before it",
    factsShortItem: "{name} from day {day}",
    factsStatus: "{critical} Critical · {watch} Watch · {stable} Stable",
    and: "and",
    controlsLabel: "Scenario",
    shockPresets: "Donor logistics support cut",
    shockHint: "Four scenarios are prepared for this demo.",
    compare: "Compare",
    compareNone: "No shock",
    compareShock: "{n}% cut",
    changeScenario: "Change scenario",
    hideScenario: "Hide scenario",
    tabsLabel: "Kisumu views",
    tabOverview: "Map and fixes",
    tabOrder: "Stockout order",
    tabFunding: "Funding trace",
    tabFacilities: "Facilities",
    orderTitle: "Stockout order",
    orderSummary: "{scenario}: {total} stockouts in total.",
    orderAlreadyShort: "Already short before the shock ({n})",
    orderCaused: "Caused by the shock ({n})",
    orderDay: "day {day}",
    orderFromDay: "from day {day}",
    orderShowAll: "Show all {n}",
    orderNoneShort: "No facility was short before the shock.",
    orderNoneCaused: "Nothing runs out because of the shock in this run.",
    whereTitle: "Where it breaks",
    whereSub:
      "Each circle is one area: facilities out of at least one commodity by the selected day, out of all facilities there.",
    timelineLabel: "Timeline",
    timelineBack: "Back one week",
    timelineForward: "Forward one week",
    timelinePlay: "Play the run",
    timelinePause: "Pause the run",
    timelineDay: "Day of the {h}-day run",
    timelineReadout:
      "Day {day} of {h}: {soFar} of {total} stockouts so far, {out} of {facilities} facilities out of at least one commodity.",
    timelineModeled: "Modeled, no intervention.",
    areaMapLabel: "Kisumu areas with facilities out of stock by day {day}",
    areaLabel: "{area}: {out} of {n} facilities out by day {day}",
    legendTitle: "Out by day {day}, of all facilities in the area",
    legendNone: "None out",
    legendSome: "Some out",
    legendAll: "All out",
    legendInvented: "Positions are invented.",
    areasLabel: "Areas",
    areaRow: "{area}: {out} of {n} out by day {day}",
    areaMixLabel: "Status over the whole run",
    areaMix:
      "Over the run: {critical} Critical · {watch} Watch · {stable} Stable",
    filterLegend: "Filter facilities",
    filterStatus: "Status",
    filterCommodity: "Commodity",
    allCommodities: "All commodities",
    filterCount: "Showing {n} of {total} facilities.",
    filterEmpty: "No facilities match these filters.",
    tableLabel: "Facilities table",
    tableCaption:
      "Status from the shown run: Critical up to day 45, Watch days 46–52, Stable after day 52. Illustrative cutoffs, not a standard.",
    colFacility: "Facility",
    colArea: "Area",
    colStatus: "Status",
    colFirst: "First stockout",
    detailLevel: "Level",
    detailLevelValue: "Level {n}",
    detailStockouts: "Stockouts in this run ({n})",
    detailStockout: "{medicine}: day {day}",
    detailIncoming:
      "Planted transfer: {medicine} from {donor}, {km} km away, arriving on day {day}.",
    detailOutgoing: "Planted donor: {medicine} for {recipient}.",
    fixesTitle: "Cheapest fixes",
    fixesCoverEarliest: "the {n} earliest of {total} shock-caused stockouts",
    fixesCoverSome:
      "{n} of {total} shock-caused stockouts (days {first} to {last})",
    fixesScope:
      "These options address {coverage}; the others have no option in this demo.",
    fixesHow:
      "OR-Tools picks what fits the budget. Costs are illustrative units, not calibrated to real prices.",
    fixesBudget: "Budget (illustrative units)",
    fixesBudgetNumber: "Budget in illustrative units",
    units: "{n} units",
    fixesLoading: "Loading the ranked fixes…",
    fixesFirstRank: "Ranking fixes for {b} units…",
    fixesInFlight:
      "Updating the ranking for {b} units… Showing {r} units until it arrives.",
    fixesUsed: "{used} of {b} units used.",
    fixesNothingFits:
      "Nothing fits {b} units. The cheapest fix costs {c} units.",
    fixesFailed:
      "The ranking for {b} units could not be updated. The fixes below are for {r} units, the last budget that ranked.",
    fixesFailedFirst: "The ranking for {b} units could not be loaded.",
    fixesRefreshFailed:
      "The ranking for {b} units could not be refreshed. The fixes below are from the last ranking that arrived.",
    fixesRetry: "Try again",
    pairTitle: "{name}: {medicine}",
    pairMeta: "{area} · runs out on day {day}",
    pairSame: "if funded, either option keeps it {effect}",
    effectHolds: "stocked through day {h}",
    effectMoves: "stockout moves to day {day}",
    effectUnknown: "modeled effect unavailable",
    optionTransfer: "Transfer",
    optionVia: "from {name}, {km} km away",
    optionEmergency: "Emergency delivery",
    funded: "Funded",
    notFunded: "Not funded: {reason}",
    ifFunded: "if funded, {effect}",
    reasonAlternative: "A cheaper option already covers this stockout",
    reasonOverBudget: "Costs more than the whole budget",
    reasonRemaining: "Does not fit in what is left of the budget",
    reasonNotSelected: "Not in the optimizer's best set",
    reasonDonor: "The donor and recipient choices conflict",
    reasonInventory: "The shared synthetic inventory would be exceeded",
    reasonUnknown: "reason unavailable",
    whyTitle: "Why these picks?",
    whySame:
      "Transfers and emergency deliveries give the same delay here, so the cheaper transfers are funded first.",
    whyNone:
      "Nothing is funded: the cheapest option costs {c} units, more than the {b}-unit budget.",
    whyGeneral:
      "The optimizer funds the set of options that delays stockouts the most within the budget.",
    fixesNoShockTitle: "With no shock, nothing to fix.",
    fixesNoShock: "No stockouts are caused by the shock.",
    fixesLateTitle: "No transfer can arrive in time at this shock.",
    budgetUnusedNone:
      "The budget is not used: no stockouts are caused by the shock.",
    budgetUnusedLate:
      "The budget is not used at this shock: no transfer can arrive in time.",
    verdictBudget:
      "At {b} units (illustrative) the optimizer funds {funded} ({cost} units){hold}.",
    verdictTransfers: "{n} transfers",
    verdictTransfer: "{n} transfer",
    verdictFixesN: "{n} fixes",
    verdictFixN: "{n} fix",
    verdictHoldEach: ", each keeping its facility stocked through day {h}",
    verdictHoldOne: ", keeping its facility stocked through day {h}",
    verdictCutOne: "{name} (day {day}) does not fit what is left.",
    verdictCutMany: "{n} other transfers do not fit what is left.",
    verdictNothingFits:
      "At {b} units (illustrative), nothing fits the budget; the cheapest fix costs {c} units.",
    scenarioError: "Scenario unavailable. Try again.",
    facilities: "Synthetic facilities",
    subcounty: "Sub-county",
    allSubcounties: "All sub-counties",
    selectFacility: "Select a synthetic facility to see its risk.",
    alreadyShort: "Already short before the shock",
    alreadyShortCount: "already short before the shock",
    summaryFacilities: "facilities",
    clusterFacilities: "synthetic facilities",
    clusterWorst: "worst status",
    shortCritical: "Crit",
    shortWatch: "Watch",
    shortStable: "Stable",
    shortUnknown: "Unk",
    clusterZoom: "Press Enter to zoom in.",
    summaryShock: "shock",
    fundingTitle: "Where is funding delayed?",
    fundingNote:
      "Synthetic funding flow: amounts and dates are invented and illustrative.",
    fundingStages: "Funding stages",
    stageApproved: "Approved",
    stageReleased: "Released",
    stageProcured: "Procured",
    stageDelivered: "Delivered",
    fundingStalledHere: "Stalled here",
    fundingAgeing: "Delayed amounts, oldest first",
    fundingAsOf: "As of",
    fundingApprovedOn: "Approved on",
    approved_not_released: "Approved, not released",
    released_not_procured: "Released, not procured",
    procured_not_delivered: "Procured, not delivered",
    fundingStageUnknown: "Unrecognized stage",
    fundingInspect: "Inspect bottleneck",
    fundingAge: "days waiting",
    fundingDetail: "Selected bottleneck",
    fundingLoading: "Tracing funding stages…",
    fundingError: "Funding trace unavailable. Try again.",
    fundingRetry: "Try again",
    fundingEmpty: "No delayed flows in this synthetic view.",
    fundingOffline: "Showing saved funding summary.",
    captureTitle: "Capture a bin card",
    captureNote:
      "Synthetic bin cards only. Upload needs a connection, and nothing is saved until you confirm every field.",
    captureOffline: "Go online to upload a bin card.",
    captureAttest:
      "This is a synthetic bin card with no real patient or facility data.",
    capturePhoto: "Bin-card photo (PNG, JPEG or WebP, up to 5 MB)",
    captureType: "Use a PNG, JPEG or WebP image.",
    captureSize: "The image is larger than 5 MB.",
    captureEmpty: "Add a clear photo of one bin card.",
    captureRead: "Read the card",
    captureReading: "Reading the card…",
    captureError:
      "We could not read this image. Retake the photo and try again.",
    captureManual:
      "Automatic reading is unavailable. Type each of the four fields from the photo.",
    capturePartial: "Some fields were unclear. Check the highlighted values.",
    captureCheck: "Check every value against the photo.",
    capturePreviewAlt: "Your bin-card photo",
    captureCommodity: "Commodity name",
    captureOpening: "Opening balance (units)",
    captureClosing: "Closing balance (units)",
    captureDate: "Record date",
    captureReview: "Review and save",
    captureIncomplete: "Fill in all four fields to continue.",
    captureConfirmPrompt:
      "Review every field against the photo. Save these values to this synthetic facility?",
    captureGoBack: "Go back",
    captureConfirm: "Confirm and save",
    captureSaving: "Saving…",
    captureSaveError: "Could not save these values. Check them and try again.",
    captureSaved: "Saved to this synthetic facility:",
    tourStart: "Try the 3-minute demo",
    tourLabel: "Guided demo",
    tourStep: "Step",
    tourBack: "Back",
    tourNext: "Next step",
    tourFinish: "Finish demo",
    tourExit: "Exit demo",
    tour_overview_title: "National overview",
    tour_overview_text:
      "All 47 counties on a schematic grid with illustrative risk. Every number is synthetic.",
    tour_kisumu_title: "Kisumu pilot",
    tour_kisumu_text:
      "Forty invented facilities on synthetic map locations, each with a non-color risk symbol.",
    tour_shock_title: "Apply a 40% shock",
    tour_shock_text:
      "Donor logistics support drops by 40%. The illustrative model reruns the county.",
    tour_stockout_title: "First stockout",
    tour_stockout_text:
      "The order in which items run out because of the shock. The first one is where to act.",
    tour_funding_title: "Funding trace",
    tour_funding_text:
      "Money approved but not yet released, aged in days for one synthetic flow.",
    tour_rank_title: "Ranked fix",
    tour_rank_text:
      "OR-Tools picks the cheapest action within the budget. The explanation only restates its result.",
    tour_capture_title: "Bin-card capture",
    tour_capture_text:
      "A facility in-charge uploads a bin-card photo and confirms every field before anything is saved.",
    openingStock: "Synthetic opening stock",
    noStock: "No synthetic stock entries for this facility.",
    rankEnglishOnly: "Explanation available in English only.",
    rankOffline: "Offline. Go online to recalculate a ranking.",
    rankNoExplanation: "Explanation unavailable.",
    rankUnreachable:
      "No supplied option meets this synthetic target within the budget.",
    overviewLoading: "Loading your overview…",
    overviewError: "Overview unavailable. Try again.",
    skip: "Skip to content",
  },
  sw: {
    overviewTitle: "Ungechukua hatua wapi kwanza?",
    overviewLead:
      "Fanya mazoezi ya mshtuko wa usambazaji kwa mifano iliyobuniwa.",
    overview: "Muhtasari",
    navKisumu: "Kisumu",
    navFunding: "Ufuatiliaji wa ufadhili",
    navCapture: "Kunasa kadi ya akiba",
    navPrimary: "Urambazaji mkuu",
    navMobile: "Urambazaji mkuu (simu)",
    kenya: "Kenya · Eneo la kupanga la kaunti",
    banner:
      "Vituo, majina, maeneo na gharama ni vya kubuni. Matokeo ni ya mfano na hayajathibitishwa.",
    aboutLink: "Kuhusu onyesho hili",
    aboutSandbox:
      "Hiki ni chombo cha majaribio ya mshtuko, si mfumo wa ufuatiliaji wa moja kwa moja wala mfumo wa serikali.",
    aboutInvented:
      "Vituo, majina, viwianishi, viwango vya akiba na gharama ni vya kubuni. Ni baadhi tu ya vigezo vya ukubwa (mchanganyiko wa vituo, muda wa kusubiri bidhaa, jumla za mahitaji na ufadhili) vinavyotegemea takwimu za jumla za umma, kama ilivyoandikwa katika dhana za data za mradi. Hakuna kilichothibitishwa.",
    aboutMethod:
      "Majaribio yanatoka kwa jenereta inayorudiwa (toleo 5, mbegu 42). OR-Tools hupanga suluhisho; maelezo kwa lugha rahisi hurudia tu matokeo yake.",
    aboutTerms:
      "Kuisha kwa bidhaa ni kituo kimoja kukosa bidhaa moja ndani ya siku 90 za jaribio. Gharama ni vipimo vya mfano, havijapimwa kwa bei halisi.",
    syntheticNote:
      "Mifano iliyobuniwa pekee. Matokeo ni ya mfano na hayajathibitishwa.",
    gridTitle: "Kaunti za Kenya",
    gridDescription:
      "Mchoro wa mfano, si kwa kipimo halisi. Chagua kaunti kuona taarifa za mipango.",
    gridLabel: "Mchoro wa kaunti",
    planningOverview: "Muhtasari wa mipango ya kaunti",
    county: "kaunti",
    openMap: "Fungua mchoro wa kaunti",
    mapTitle: "Mchoro wa kaunti",
    closeMap: "Funga mchoro",
    countyList: "Orodha ya kaunti",
    search: "Tafuta kaunti",
    empty: "Hakuna kaunti zinazolingana na vichujio hivi.",
    selectCounty: "Chagua kaunti kuona taarifa zake za mipango zilizobuniwa.",
    pilot: "Kisumu ni eneo la majaribio ya vituo vilivyobuniwa.",
    exploreKisumu: "Chunguza majaribio ya Kisumu",
    planningOnly: "Muhtasari wa mipango pekee; uigaji wa vituo haupatikani.",
    unavailable: "Data za mipango ya kaunti hazipatikani.",
    partial: "Baadhi ya data za mipango ya kaunti hazipatikani.",
    loading: "Inapakia data za mipango ya kaunti zilizobuniwa…",
    offline:
      "Hakuna mtandao. Majina ya kaunti yanapatikana; data za mipango huenda zisipatikane.",
    retry: "Jaribu tena",
    approved: "Bajeti iliyoidhinishwa iliyobuniwa kwa sekta zote",
    released: "Makadirio yaliyobuniwa ya fedha zilizotolewa",
    demoRole: "Jukumu la majaribio",
    nationalPlanner: "Mpangaji wa kitaifa",
    kisumuPlanner: "Mpangaji wa Kisumu",
    pharmacist: "Mfamasia",
    facility: "Kituo",
    accessDenied: "Huna ruhusa ya kuona muhtasari huu wa kaunti.",
    sessionMissing: "Kipindi hakipatikani.",
    sessionExpired: "Kipindi kimeisha.",
    facilityLocationsSynthetic: "Maeneo ya vituo yamebuniwa.",
    openFacilityMap: "Fungua ramani ya vituo",
    facilityMapTitle: "Ramani ya vituo vya mfano",
    facilityMapUnavailable:
      "Ramani ya vituo haipatikani; tumia orodha ya vituo.",
    facilityMapPartial:
      "Baadhi ya kuratibu za vituo vilivyobuniwa hazipatikani.",
    mapTilesUnavailable:
      "Mandhari ya ramani hayapatikani; alama na orodha ya vituo zinapatikana.",
    riskLegend: "Hatari ya kuisha kwa bidhaa ya mfano",
    critical: "Hatari kubwa",
    watch: "Angalizo",
    stable: "Tulivu",
    unknown: "Haijulikani",
    days: "siku hadi bidhaa iishe",
    noStockout: "Hakuna bidhaa inayoisha ndani ya kipindi cha uigaji",
    noRiskData: "Hakuna utabiri au uigaji unaopatikana",
    drivers: "Bidhaa zinazoamua hali",
    kisumuTitle: "Kisumu",
    scenarioNone: "Bila mshtuko",
    scenarioCut: "Upunguzaji wa usafirishaji wa {n}%",
    verdictLabel: "Kinachoharibika kwanza",
    verdictLoading: "Inaendesha hali ya {n}%…",
    verdictFraming:
      "Kupima Kisumu kwa mshtuko: nini kinaharibika kwanza msaada wa usafirishaji wa wafadhili ukipunguzwa, na suluhisho la bei nafuu zaidi ni lipi?",
    verdictNoShock:
      "Bila mshtuko, hakuna bidhaa mpya inayoisha ndani ya siku {h}.",
    verdictLead:
      "Kupunguzwa kwa {n}% kwa msaada wa usafirishaji wa wafadhili kunasababisha {count} ndani ya siku {h}; {place} kinakosa {medicine} kwanza, siku ya {day}.",
    verdictNone:
      "Kupunguzwa kwa {n}% kwa msaada wa usafirishaji wa wafadhili hakusababishi bidhaa mpya kuisha ndani ya siku {h}.",
    verdictStockouts: "matukio {n} ya kuisha kwa bidhaa",
    verdictStockout: "tukio {n} la kuisha kwa bidhaa",
    verdictPlace: "{name} ({area})",
    verdictScopeEarliest:
      "Suluhisho zinashughulikia matukio {n} ya mapema zaidi tu kati ya {total} yaliyosababishwa na mshtuko.",
    verdictScopeSome:
      "Suluhisho zinashughulikia matukio {n} tu kati ya {total} yaliyosababishwa na mshtuko (siku {first} hadi {last}).",
    verdictNothingToFix: "Hakuna cha kurekebisha.",
    verdictLate:
      "Hakuna kati ya uhamisho {n} ulioorodheshwa unaoweza kufika kwa wakati: unafika kuanzia siku {arrival}, lakini bidhaa zinaisha kufikia siku {day}.",
    verdictUnavailable:
      "Maelezo ya kuisha kwa bidhaa hayapatikani kwa jaribio hili.",
    factsTotal:
      "Jumla ya matukio {total} ya kuisha kwa bidhaa: {caused} yamesababishwa na mshtuko, {short} yalikuwepo kabla yake",
    factsShortItem: "{name} kuanzia siku {day}",
    factsStatus: "{critical} Hatari kubwa · {watch} Angalizo · {stable} Tulivu",
    and: "na",
    controlsLabel: "Hali",
    shockPresets: "Kupunguzwa kwa msaada wa usafirishaji wa wafadhili",
    shockHint: "Hali nne zimeandaliwa kwa onyesho hili.",
    compare: "Linganisha",
    compareNone: "Bila mshtuko",
    compareShock: "Upunguzaji wa {n}%",
    changeScenario: "Badilisha hali",
    hideScenario: "Ficha hali",
    tabsLabel: "Mionekano ya Kisumu",
    tabOverview: "Ramani na suluhisho",
    tabOrder: "Mfuatano wa kuisha kwa bidhaa",
    tabFunding: "Ufuatiliaji wa ufadhili",
    tabFacilities: "Vituo",
    orderTitle: "Mfuatano wa kuisha kwa bidhaa",
    orderSummary: "{scenario}: jumla ya matukio {total} ya kuisha kwa bidhaa.",
    orderAlreadyShort: "Ilikuwa na upungufu kabla ya mshtuko ({n})",
    orderCaused: "Yamesababishwa na mshtuko ({n})",
    orderDay: "siku ya {day}",
    orderFromDay: "kuanzia siku ya {day}",
    orderShowAll: "Onyesha yote {n}",
    orderNoneShort: "Hakuna kituo kilichokuwa na upungufu kabla ya mshtuko.",
    orderNoneCaused:
      "Hakuna bidhaa inayoisha kutokana na mshtuko katika jaribio hili.",
    whereTitle: "Kinapoharibika wapi",
    whereSub:
      "Kila duara ni eneo moja: vituo vilivyokosa angalau bidhaa moja kufikia siku iliyochaguliwa, kati ya vituo vyote vya eneo hilo.",
    timelineLabel: "Mstari wa wakati",
    timelineBack: "Rudi wiki moja",
    timelineForward: "Songa mbele wiki moja",
    timelinePlay: "Cheza jaribio",
    timelinePause: "Simamisha jaribio",
    timelineDay: "Siku ya jaribio la siku {h}",
    timelineReadout:
      "Siku {day} kati ya {h}: matukio {soFar} kati ya {total} ya kuisha hadi sasa, vituo {out} kati ya {facilities} vimekosa angalau bidhaa moja.",
    timelineModeled: "Imeigwa, bila hatua yoyote.",
    areaMapLabel:
      "Maeneo ya Kisumu yenye vituo vilivyokosa bidhaa kufikia siku {day}",
    areaLabel:
      "{area}: vituo {out} kati ya {n} vimekosa bidhaa kufikia siku {day}",
    legendTitle:
      "Vimekosa bidhaa kufikia siku {day}, kati ya vituo vyote vya eneo",
    legendNone: "Hakuna kilichokosa",
    legendSome: "Baadhi vimekosa",
    legendAll: "Vyote vimekosa",
    legendInvented: "Maeneo ni ya kubuni.",
    areasLabel: "Maeneo",
    areaRow: "{area}: {out} kati ya {n} vimekosa kufikia siku {day}",
    areaMixLabel: "Hali katika jaribio zima",
    areaMix:
      "Katika jaribio: {critical} Hatari kubwa · {watch} Angalizo · {stable} Tulivu",
    filterLegend: "Chuja vituo",
    filterStatus: "Hali",
    filterCommodity: "Bidhaa",
    allCommodities: "Bidhaa zote",
    filterCount: "Inaonyesha vituo {n} kati ya {total}.",
    filterEmpty: "Hakuna vituo vinavyolingana na vichujio hivi.",
    tableLabel: "Jedwali la vituo",
    tableCaption:
      "Hali kutoka kwa jaribio linaloonyeshwa: Hatari kubwa hadi siku ya 45, Angalizo siku 46–52, Tulivu baada ya siku ya 52. Viwango vya mfano, si kiwango rasmi.",
    colFacility: "Kituo",
    colArea: "Eneo",
    colStatus: "Hali",
    colFirst: "Kuisha kwa kwanza",
    detailLevel: "Ngazi",
    detailLevelValue: "Ngazi {n}",
    detailStockouts: "Matukio ya kuisha katika jaribio hili ({n})",
    detailStockout: "{medicine}: siku ya {day}",
    detailIncoming:
      "Uhamisho uliopangwa: {medicine} kutoka {donor}, umbali wa km {km}, unafika siku ya {day}.",
    detailOutgoing: "Mtoaji aliyepangwa: {medicine} kwa {recipient}.",
    fixesTitle: "Suluhisho za gharama nafuu zaidi",
    fixesCoverEarliest:
      "matukio {n} ya mapema zaidi kati ya {total} yaliyosababishwa na mshtuko",
    fixesCoverSome:
      "matukio {n} kati ya {total} yaliyosababishwa na mshtuko (siku {first} hadi {last})",
    fixesScope:
      "Chaguo hizi zinashughulikia {coverage}; mengine hayana chaguo katika onyesho hili.",
    fixesHow:
      "OR-Tools huchagua kinachotosha ndani ya bajeti. Gharama ni vipimo vya mfano, havijapimwa kwa bei halisi.",
    fixesBudget: "Bajeti (vipimo vya mfano)",
    fixesBudgetNumber: "Bajeti kwa vipimo vya mfano",
    units: "vipimo {n}",
    fixesLoading: "Inapakia suluhisho zilizopangwa…",
    fixesFirstRank: "Inapanga suluhisho kwa vipimo {b}…",
    fixesInFlight:
      "Inasasisha mpangilio kwa vipimo {b}… Inaonyesha vipimo {r} hadi ufike.",
    fixesUsed: "Vipimo {used} kati ya {b} vimetumika.",
    fixesNothingFits:
      "Hakuna kinachotosha vipimo {b}. Suluhisho la bei nafuu zaidi linagharimu vipimo {c}.",
    fixesFailed:
      "Mpangilio wa vipimo {b} haukuweza kusasishwa. Suluhisho zilizo hapa chini ni za vipimo {r}, bajeti ya mwisho iliyopangwa.",
    fixesFailedFirst: "Mpangilio wa vipimo {b} haukuweza kupakiwa.",
    fixesRefreshFailed:
      "Mpangilio wa vipimo {b} haukuweza kuonyeshwa upya. Suluhisho zilizo hapa chini ni za mpangilio wa mwisho uliofika.",
    fixesRetry: "Jaribu tena",
    pairTitle: "{name}: {medicine}",
    pairMeta: "{area} · inaisha siku ya {day}",
    pairSame: "ikifadhiliwa, chaguo lolote linaiweka {effect}",
    effectHolds: "na akiba hadi siku ya {h}",
    effectMoves: "kuisha kunasogea hadi siku ya {day}",
    effectUnknown: "athari iliyoigwa haipatikani",
    optionTransfer: "Uhamisho",
    optionVia: "kutoka {name}, umbali wa km {km}",
    optionEmergency: "Uwasilishaji wa dharura",
    funded: "Imefadhiliwa",
    notFunded: "Haikufadhiliwa: {reason}",
    ifFunded: "ikifadhiliwa, {effect}",
    reasonAlternative: "Chaguo la bei nafuu tayari linashughulikia tukio hili",
    reasonOverBudget: "Inagharimu zaidi ya bajeti yote",
    reasonRemaining: "Haitoshi ndani ya bajeti iliyobaki",
    reasonNotSelected: "Haimo katika seti bora ya kiboreshaji",
    reasonDonor: "Chaguo za mtoaji na mpokeaji zinakinzana",
    reasonInventory: "Akiba ya pamoja ya mfano ingezidiwa",
    reasonUnknown: "sababu haipatikani",
    whyTitle: "Kwa nini chaguo hizi?",
    whySame:
      "Uhamisho na uwasilishaji wa dharura vinatoa ucheleweshaji uleule hapa, kwa hivyo uhamisho wa bei nafuu unafadhiliwa kwanza.",
    whyNone:
      "Hakuna kilichofadhiliwa: chaguo la bei nafuu zaidi linagharimu vipimo {c}, zaidi ya bajeti ya vipimo {b}.",
    whyGeneral:
      "Kiboreshaji kinafadhili seti ya chaguo inayochelewesha kuisha kwa bidhaa zaidi ndani ya bajeti.",
    fixesNoShockTitle: "Bila mshtuko, hakuna cha kurekebisha.",
    fixesNoShock: "Hakuna bidhaa zinazoisha kutokana na mshtuko.",
    fixesLateTitle:
      "Hakuna uhamisho unaoweza kufika kwa wakati katika mshtuko huu.",
    budgetUnusedNone:
      "Bajeti haitumiki: hakuna bidhaa zinazoisha kutokana na mshtuko.",
    budgetUnusedLate:
      "Bajeti haitumiki katika mshtuko huu: hakuna uhamisho unaoweza kufika kwa wakati.",
    verdictBudget:
      "Kwa vipimo {b} (vya mfano) kiboreshaji kinafadhili {funded} (vipimo {cost}){hold}.",
    verdictTransfers: "uhamisho {n}",
    verdictTransfer: "uhamisho {n}",
    verdictFixesN: "suluhisho {n}",
    verdictFixN: "suluhisho {n}",
    verdictHoldEach:
      ", kila mmoja ukiweka kituo chake na akiba hadi siku ya {h}",
    verdictHoldOne: ", ukiweka kituo chake na akiba hadi siku ya {h}",
    verdictCutOne: "{name} (siku ya {day}) haitoshi katika kilichobaki.",
    verdictCutMany: "Uhamisho mwingine {n} hautoshi katika kilichobaki.",
    verdictNothingFits:
      "Kwa vipimo {b} (vya mfano), hakuna kinachotosha bajeti; suluhisho la bei nafuu zaidi linagharimu vipimo {c}.",
    scenarioError: "Uigaji haupatikani. Jaribu tena.",
    facilities: "Vituo vilivyobuniwa",
    subcounty: "Kaunti ndogo",
    allSubcounties: "Kaunti ndogo zote",
    selectFacility: "Chagua kituo kilichobuniwa kuona hatari yake.",
    alreadyShort: "Tayari ilikuwa na upungufu kabla ya mshtuko",
    alreadyShortCount: "tayari vilikuwa na upungufu kabla ya mshtuko",
    summaryFacilities: "vituo",
    clusterFacilities: "vituo vya mfano",
    clusterWorst: "hali mbaya zaidi",
    shortCritical: "Hatari",
    shortWatch: "Angalizo",
    shortStable: "Tulivu",
    shortUnknown: "Haij.",
    clusterZoom: "Bonyeza Enter ili kukuza.",
    summaryShock: "mshtuko",
    fundingTitle: "Ufadhili umechelewa wapi?",
    fundingNote:
      "Mtiririko wa ufadhili wa mfano: kiasi na tarehe ni za kubuni na za mfano.",
    fundingStages: "Hatua za ufadhili",
    stageApproved: "Imeidhinishwa",
    stageReleased: "Imetolewa",
    stageProcured: "Imenunuliwa",
    stageDelivered: "Imewasilishwa",
    fundingStalledHere: "Imekwama hapa",
    fundingAgeing: "Kiasi kilichochelewa, cha zamani kwanza",
    fundingAsOf: "Hadi tarehe",
    fundingApprovedOn: "Iliidhinishwa tarehe",
    approved_not_released: "Imeidhinishwa, haijatolewa",
    released_not_procured: "Imetolewa, haijanunuliwa",
    procured_not_delivered: "Imenunuliwa, haijawasilishwa",
    fundingStageUnknown: "Hatua isiyotambulika",
    fundingInspect: "Kagua kizuizi",
    fundingAge: "siku za kusubiri",
    fundingDetail: "Kizuizi kilichochaguliwa",
    fundingLoading: "Inafuatilia hatua za ufadhili…",
    fundingError: "Ufuatiliaji wa ufadhili haupatikani. Jaribu tena.",
    fundingRetry: "Jaribu tena",
    fundingEmpty: "Hakuna mtiririko uliochelewa katika mwonekano huu wa mfano.",
    fundingOffline: "Inaonyesha muhtasari wa ufadhili uliohifadhiwa.",
    captureTitle: "Nasa kadi ya akiba",
    captureNote:
      "Kadi za akiba za mfano pekee. Kupakia kunahitaji mtandao, na hakuna kinachohifadhiwa hadi uthibitishe kila sehemu.",
    captureOffline: "Unganisha mtandao ili kupakia kadi ya akiba.",
    captureAttest:
      "Hii ni kadi ya akiba ya mfano isiyo na taarifa halisi za mgonjwa au kituo.",
    capturePhoto: "Picha ya kadi ya akiba (PNG, JPEG au WebP, hadi MB 5)",
    captureType: "Tumia picha ya PNG, JPEG au WebP.",
    captureSize: "Picha ni kubwa kuliko MB 5.",
    captureEmpty: "Ongeza picha wazi ya kadi moja ya akiba.",
    captureRead: "Soma kadi",
    captureReading: "Inasoma kadi…",
    captureError: "Hatukuweza kusoma picha hii. Piga picha tena ujaribu.",
    captureManual:
      "Usomaji wa kiotomatiki haupatikani. Andika kila moja ya sehemu nne kutoka kwenye picha.",
    capturePartial:
      "Baadhi ya sehemu hazikuwa wazi. Kagua thamani zilizoangaziwa.",
    captureCheck: "Linganisha kila thamani na picha.",
    capturePreviewAlt: "Picha yako ya kadi ya akiba",
    captureCommodity: "Jina la bidhaa",
    captureOpening: "Salio la mwanzo (vipimo)",
    captureClosing: "Salio la mwisho (vipimo)",
    captureDate: "Tarehe ya rekodi",
    captureReview: "Kagua na uhifadhi",
    captureIncomplete: "Jaza sehemu zote nne ili kuendelea.",
    captureConfirmPrompt:
      "Linganisha kila sehemu na picha. Hifadhi thamani hizi kwa kituo hiki cha mfano?",
    captureGoBack: "Rudi",
    captureConfirm: "Thibitisha na uhifadhi",
    captureSaving: "Inahifadhi…",
    captureSaveError:
      "Haikuwezekana kuhifadhi thamani hizi. Zikague ujaribu tena.",
    captureSaved: "Imehifadhiwa kwa kituo hiki cha mfano:",
    tourStart: "Jaribu onyesho la dakika 3",
    tourLabel: "Onyesho la kuongozwa",
    tourStep: "Hatua",
    tourBack: "Rudi",
    tourNext: "Hatua inayofuata",
    tourFinish: "Maliza onyesho",
    tourExit: "Toka kwenye onyesho",
    tour_overview_title: "Muhtasari wa kitaifa",
    tour_overview_text:
      "Kaunti zote 47 kwenye gridi ya mchoro yenye hatari ya mfano. Kila nambari ni ya kubuni.",
    tour_kisumu_title: "Majaribio ya Kisumu",
    tour_kisumu_text:
      "Vituo arobaini vya kubuni kwenye maeneo ya ramani ya mfano, kila kimoja na alama ya hatari isiyotegemea rangi.",
    tour_shock_title: "Weka mshtuko wa 40%",
    tour_shock_text:
      "Msaada wa usafirishaji wa wafadhili unapungua kwa 40%. Mfano unaendeshwa upya kwa kaunti.",
    tour_stockout_title: "Bidhaa ya kwanza kuisha",
    tour_stockout_text:
      "Mfuatano wa bidhaa kuisha kutokana na mshtuko. Ya kwanza ndipo pa kuchukua hatua.",
    tour_funding_title: "Ufuatiliaji wa ufadhili",
    tour_funding_text:
      "Pesa zilizoidhinishwa lakini bado hazijatolewa, kwa siku, kwa mtiririko mmoja wa mfano.",
    tour_rank_title: "Hatua iliyopangwa",
    tour_rank_text:
      "OR-Tools huchagua hatua ya bei nafuu ndani ya bajeti. Maelezo yanarudia tu matokeo yake.",
    tour_capture_title: "Kunasa kadi ya akiba",
    tour_capture_text:
      "Msimamizi wa kituo anapakia picha ya kadi ya akiba na kuthibitisha kila sehemu kabla ya kuhifadhi.",
    openingStock: "Akiba ya mwanzo iliyobuniwa",
    noStock: "Hakuna taarifa za akiba zilizobuniwa kwa kituo hiki.",
    rankEnglishOnly:
      "Maelezo yanapatikana kwa Kiingereza pekee. Explanation available in English only.",
    rankOffline: "Hakuna mtandao. Unganisha tena ili kupanga hatua upya.",
    rankNoExplanation: "Maelezo hayapatikani.",
    rankUnreachable:
      "Hakuna chaguo lililotolewa linalofikia lengo hili la mfano ndani ya bajeti.",
    overviewLoading: "Inapakia muhtasari wako…",
    overviewError: "Muhtasari haupatikani. Jaribu tena.",
    skip: "Nenda kwenye maudhui",
  },
} as const;

type Key = keyof typeof strings.en;
type Vars = Record<string, ReactNode>;

/** Fill {name} placeholders; values may be elements, such as a button inside a sentence. */
export function fill(template: string, vars: Vars): ReactNode[] {
  return template
    .split(/(\{\w+\})/)
    .filter(Boolean)
    .map((part, index) => {
      const name = /^\{(\w+)\}$/.exec(part)?.[1];
      const value = name !== undefined && name in vars ? vars[name] : part;
      return isValidElement(value) ? (
        <Fragment key={index}>{value}</Fragment>
      ) : (
        String(value)
      );
    });
}
type Locale = "en" | "sw";
type Theme = "system" | "light" | "dark";
type Preferences = {
  locale: Locale;
  theme: Theme;
  setLocale: (value: Locale) => void;
  setTheme: (value: Theme) => void;
  t: (key: Key) => string;
  /** A string with {name} placeholders filled; plain text only. */
  tf: (key: Key, vars: Record<string, string | number>) => string;
  /** A string with {name} placeholders filled; values may be elements. */
  tn: (key: Key, vars: Vars) => ReactNode[];
};
const defaults: Preferences = {
  locale: "en",
  theme: "system",
  setLocale: () => {},
  setTheme: () => {},
  t: (key) => strings.en[key],
  tf: (key, vars) => fill(strings.en[key], vars).join(""),
  tn: (key, vars) => fill(strings.en[key], vars),
};
const Context = createContext<Preferences>(defaults);

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<Locale>("en");
  const [theme, setTheme] = useState<Theme>("system");
  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dataset.theme = theme;
  }, [locale, theme]);
  return (
    <Context.Provider
      value={{
        locale,
        theme,
        setLocale,
        setTheme,
        t: (key) => strings[locale][key],
        tf: (key, vars) => fill(strings[locale][key], vars).join(""),
        tn: (key, vars) => fill(strings[locale][key], vars),
      }}
    >
      {children}
    </Context.Provider>
  );
}

export function usePreferences() {
  return useContext(Context);
}

export function PreferenceControls() {
  const { locale, theme, setLocale, setTheme } = usePreferences();
  return (
    <div className="preferences">
      <label>
        <span>Language / Lugha</span>
        <select
          value={locale}
          onChange={(event) => setLocale(event.target.value as Locale)}
        >
          <option value="en">English</option>
          <option value="sw">Kiswahili</option>
        </select>
      </label>
      <label>
        <span>Theme / Mandhari</span>
        <select
          value={theme}
          onChange={(event) => setTheme(event.target.value as Theme)}
        >
          <option value="system">System / Mfumo</option>
          <option value="light">Light / Mwangaza</option>
          <option value="dark">Dark / Giza</option>
        </select>
      </label>
    </div>
  );
}
