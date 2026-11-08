"use client";

import {
  createContext,
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
    kenya: "Kenya · County planning workspace",
    banner:
      "Synthetic demo data · Calibrated to public aggregates · Results are illustrative, not validated.",
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
    kisumuTitle: "Kisumu synthetic pilot",
    shockLabel: "Donor logistics support reduction",
    baseline: "No-shock baseline",
    scenarioRunning: "Running illustrative scenario…",
    scenarioError: "Scenario unavailable. Try again.",
    previousRun: "Previous run; updated results are pending.",
    facilities: "Synthetic facilities",
    subcounty: "Sub-county",
    allSubcounties: "All sub-counties",
    selectFacility: "Select a synthetic facility to see its risk.",
    shockFirst: "Shock-caused stockout order",
    summaryShock: "shock",
    summaryStockouts: "stockouts",
    summaryVs: "vs",
    summaryNoShock: "with no shock",
    summaryCaused: "caused by the shock",
    summaryFirst: "First",
    summaryOnDay: "on day",
    summaryMost: "Most",
    summaryDays: "days",
    showAllPrefix: "Show all",
    showAllSuffix: "shock-caused stockouts in order",
    fundingTitle: "Where is funding delayed?",
    fundingNote:
      "Synthetic funding flow: amounts and dates are invented and illustrative.",
    fundingStages: "Funding stages",
    stageApproved: "Approved",
    stageReleased: "Released",
    stageProcured: "Procured",
    stageDelivered: "Delivered",
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
      "Automatic reading is unavailable. Enter each field from the photo.",
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
    noShockStockouts: "No shock-caused stockouts in this illustrative run.",
    doThisFirst: "Do this first",
    rankAssumptions:
      "Costs and benefits are illustrative assumptions, not validated impacts.",
    rankCandidateAssumptions:
      "For each of the earliest shock-caused stockouts, a synthetic transfer and an emergency delivery use the same assumed quantity and arrival day, with illustrative costs of 10 KES and 50 KES. The optimizer maximizes modeled days deferred within the budget.",
    rankTransfer: "Redistribution transfer",
    rankEmergency: "Emergency delivery",
    rankTransferUnavailable:
      "No planted transfer matches these shock-caused stockouts; comparison is unavailable for this snapshot.",
    rankEnglishOnly: "Explanation available in English only.",
    rankTargets: "Earliest shock-caused stockouts with a planted transfer",
    rankRemainingBudget: "Not funded: it does not fit in the remaining budget.",
    rankBudget: "Budget ceiling (KES)",
    rankAction: "Rank feasible actions",
    rankLoading: "Ranking feasible actions…",
    rankOffline: "Offline. Go online to recalculate a ranking.",
    rankError:
      "Could not rank actions. Review the target and budget, then try again.",
    rankUsed: "Budget used",
    rankRemaining: "Remaining budget",
    rankCutLine: "Budget cut line",
    rankExplanation: "Plain-language explanation",
    rankNoExplanation: "Explanation unavailable.",
    rankAlternative: "Another option for this stockout was selected.",
    rankOverBudget: "The assumed cost exceeds the ceiling.",
    rankDonorConflict: "The donor and recipient choices conflict.",
    rankInventory:
      "The shared synthetic inventory constraint would be exceeded.",
    rankNotSelected: "Not selected in the optimizer's best feasible set.",
    rankReasonUnavailable: "The exclusion reason is unavailable.",
    rankSelected: "Selected by the optimizer",
    rankDeferred: "modeled days deferred",
    rankDeferralUnavailable: "modeled deferral unavailable",
    rankCostNote: "Costs in KES are an illustrative assumption.",
    rankCutLineDetail: "actions above are selected; actions below are not.",
    rankAboveCut: "Selected within the budget",
    rankBelowCut: "Not selected",
    rankUnreachable:
      "No supplied option meets this synthetic target within the budget.",
    shockDetailsUnavailable:
      "Shock-caused stockout details are unavailable for this run.",
    overviewLoading: "Loading your overview…",
    overviewError: "Overview unavailable. Try again.",
    skip: "Skip to content",
  },
  sw: {
    overviewTitle: "Ungechukua hatua wapi kwanza?",
    overviewLead:
      "Fanya mazoezi ya mshtuko wa usambazaji kwa mifano iliyobuniwa.",
    overview: "Muhtasari",
    kenya: "Kenya · Eneo la kupanga la kaunti",
    banner:
      "Data za majaribio zilizobuniwa · Zimepimwa kwa takwimu za jumla za umma · Matokeo ni ya mfano na hayajathibitishwa.",
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
    kisumuTitle: "Majaribio yaliyobuniwa ya Kisumu",
    shockLabel: "Kupungua kwa msaada wa usafirishaji wa wafadhili",
    baseline: "Msingi bila mshtuko",
    scenarioRunning: "Inaendesha uigaji wa mfano…",
    scenarioError: "Uigaji haupatikani. Jaribu tena.",
    previousRun: "Uigaji uliopita; matokeo mapya yanasubiriwa.",
    facilities: "Vituo vilivyobuniwa",
    subcounty: "Kaunti ndogo",
    allSubcounties: "Kaunti ndogo zote",
    selectFacility: "Chagua kituo kilichobuniwa kuona hatari yake.",
    shockFirst: "Mfuatano wa kuisha kwa bidhaa kutokana na mshtuko",
    summaryShock: "mshtuko",
    summaryStockouts: "matukio ya kuisha kwa bidhaa",
    summaryVs: "ikilinganishwa na",
    summaryNoShock: "bila mshtuko",
    summaryCaused: "yamesababishwa na mshtuko",
    summaryFirst: "Ya kwanza",
    summaryOnDay: "siku ya",
    summaryMost: "Mengi zaidi",
    summaryDays: "siku",
    showAllPrefix: "Onyesha yote",
    showAllSuffix: "ya kuisha kwa bidhaa kutokana na mshtuko kwa mpangilio",
    fundingTitle: "Ufadhili umechelewa wapi?",
    fundingNote:
      "Mtiririko wa ufadhili wa mfano: kiasi na tarehe ni za kubuni na za mfano.",
    fundingStages: "Hatua za ufadhili",
    stageApproved: "Imeidhinishwa",
    stageReleased: "Imetolewa",
    stageProcured: "Imenunuliwa",
    stageDelivered: "Imewasilishwa",
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
      "Usomaji wa kiotomatiki haupatikani. Jaza kila sehemu kutoka kwenye picha.",
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
    doThisFirst: "Fanya hili kwanza",
    rankAssumptions:
      "Gharama na manufaa ni makadirio ya mfano, si athari zilizothibitishwa.",
    rankCandidateAssumptions:
      "Kwa kila tukio la mapema la kuisha kwa bidhaa kutokana na mshtuko, uhamisho na uwasilishaji wa dharura wa mfano hutumia kiasi na siku ileile ya kuwasili, kwa gharama za mfano za KES 10 na KES 50. Mfumo huongeza siku za kuchelewa katika mfano ndani ya bajeti.",
    rankTransfer: "Uhamisho wa bidhaa",
    rankEmergency: "Uwasilishaji wa dharura",
    rankTransferUnavailable:
      "Uhamisho wa mfano haulengani na tatizo hili la kwanza; ulinganisho haupatikani kwa picha hii ya data.",
    rankEnglishOnly:
      "Maelezo yanapatikana kwa Kiingereza pekee. Explanation available in English only.",
    rankTargets:
      "Matukio ya mapema ya kuisha kwa bidhaa yenye uhamisho wa mfano",
    rankRemainingBudget: "Haikufadhiliwa: haitoshi ndani ya bajeti iliyobaki.",
    rankBudget: "Kikomo cha bajeti (KES)",
    rankAction: "Panga hatua zinazowezekana",
    rankLoading: "Inapanga hatua zinazowezekana…",
    rankOffline: "Hakuna mtandao. Unganisha tena ili kupanga hatua upya.",
    rankError:
      "Haikuwezekana kupanga hatua. Kagua lengo na bajeti, kisha ujaribu tena.",
    rankUsed: "Bajeti iliyotumika",
    rankRemaining: "Bajeti iliyobaki",
    rankCutLine: "Mstari wa kikomo cha bajeti",
    rankExplanation: "Maelezo kwa lugha rahisi",
    rankNoExplanation: "Maelezo hayapatikani.",
    rankAlternative: "Chaguo jingine la tatizo hili limechaguliwa.",
    rankOverBudget: "Gharama inayokadiriwa inazidi kikomo.",
    rankDonorConflict:
      "Chaguo za kituo kinachotoa na kinachopokea zinakinzana.",
    rankInventory: "Kikomo cha akiba ya pamoja ya mfano kingezidiwa.",
    rankNotSelected: "Haikuchaguliwa katika seti bora inayowezekana.",
    rankReasonUnavailable: "Sababu ya kutokuchaguliwa haipatikani.",
    rankSelected: "Imechaguliwa na mfumo wa upangaji",
    rankDeferred: "siku za kuchelewa katika mfano",
    rankDeferralUnavailable: "kuchelewa katika mfano hakupatikani",
    rankCostNote: "Gharama kwa KES ni makadirio ya mfano.",
    rankCutLineDetail:
      "hatua zilizo juu zimechaguliwa; zilizo chini hazijachaguliwa.",
    rankAboveCut: "Zilizochaguliwa ndani ya bajeti",
    rankBelowCut: "Hazijachaguliwa",
    rankUnreachable:
      "Hakuna chaguo lililotolewa linalofikia lengo hili la mfano ndani ya bajeti.",
    shockDetailsUnavailable:
      "Maelezo ya kuisha kwa akiba kutokana na mshtuko hayapatikani kwa jaribio hili.",
    noShockStockouts:
      "Hakuna bidhaa zilizoisha kutokana na mshtuko katika uigaji huu wa mfano.",
    overviewLoading: "Inapakia muhtasari wako…",
    overviewError: "Muhtasari haupatikani. Jaribu tena.",
    skip: "Nenda kwenye maudhui",
  },
} as const;

type Key = keyof typeof strings.en;
type Locale = "en" | "sw";
type Theme = "system" | "light" | "dark";
type Preferences = {
  locale: Locale;
  theme: Theme;
  setLocale: (value: Locale) => void;
  setTheme: (value: Theme) => void;
  t: (key: Key) => string;
};
const defaults: Preferences = {
  locale: "en",
  theme: "system",
  setLocale: () => {},
  setTheme: () => {},
  t: (key) => strings.en[key],
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
        Language / Lugha
        <select
          value={locale}
          onChange={(event) => setLocale(event.target.value as Locale)}
        >
          <option value="en">English</option>
          <option value="sw">Kiswahili</option>
        </select>
      </label>
      <label>
        Theme / Mandhari
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
