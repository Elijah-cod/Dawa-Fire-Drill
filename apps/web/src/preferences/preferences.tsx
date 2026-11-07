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
    openingStock: "Synthetic opening stock",
    noStock: "No synthetic stock entries for this facility.",
    noShockStockouts: "No shock-caused stockouts in this illustrative run.",
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
    openingStock: "Akiba ya mwanzo iliyobuniwa",
    noStock: "Hakuna taarifa za akiba zilizobuniwa kwa kituo hiki.",
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
