"use client";

import { usePathname, useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePreferences } from "../preferences/preferences";

/** The guided demo only navigates and scrolls; every result comes from the normal screens. */
export const TOUR_STEPS = [
  { id: "overview", path: "/", target: "main h1" },
  { id: "kisumu", path: "/kisumu", target: "main h1" },
  { id: "shock", path: "/kisumu", target: "#shock-presets" },
  { id: "stockout", path: "/kisumu", target: "#verdict" },
  { id: "funding", path: "/kisumu", target: "#funding-title" },
  { id: "rank", path: "/kisumu", target: "#fixes-title" },
  { id: "capture", path: "/kisumu", target: "#capture-title" },
] as const;
export type TourStep = (typeof TOUR_STEPS)[number]["id"];

/** Steps after which the Kisumu screen should show the 40% shock. */
export const SHOCK_STEPS: readonly TourStep[] = [
  "shock",
  "stockout",
  "funding",
  "rank",
];

type Tour = {
  step: TourStep | null;
  start: () => void;
  go: (index: number) => void;
  exit: () => void;
  /** Where the tour was started, when that was not the overview (path and query). */
  origin: string | null;
  /** Leave the tour and reload the page it was started from, restoring its view. */
  returnToStart: () => void;
};
const TourContext = createContext<Tour>({
  step: null,
  start: () => {},
  go: () => {},
  exit: () => {},
  origin: null,
  returnToStart: () => {},
});
export const useTour = () => useContext(TourContext);

/** Full-page navigation, replaceable in tests. */
export const tourNavigation = {
  assign: (url: string) => window.location.assign(url),
};

/** The page the tour was started from survives the tour's own navigation and reloads. */
const ORIGIN_KEY = "dawa.tour.origin";
function readOrigin(): string | null {
  try {
    return window.sessionStorage.getItem(ORIGIN_KEY);
  } catch {
    return null;
  }
}
function writeOrigin(value: string | null) {
  try {
    if (value) window.sessionStorage.setItem(ORIGIN_KEY, value);
    else window.sessionStorage.removeItem(ORIGIN_KEY);
  } catch {
    // Storage can be unavailable (private mode); the tour still works without a way back.
  }
}

function stepFromLocation(): TourStep | null {
  const id = new URLSearchParams(window.location.search).get("tour");
  return TOUR_STEPS.find((item) => item.id === id)?.id ?? null;
}

export function TourProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [step, setStep] = useState<TourStep | null>(null);
  const [origin, setOrigin] = useState<string | null>(null);
  useEffect(() => {
    const current = stepFromLocation();
    setStep(current);
    setOrigin(current ? readOrigin() : null);
  }, [pathname]);
  const go = useCallback(
    (index: number) => {
      const next = TOUR_STEPS[index];
      if (!next) return;
      setStep(next.id);
      const url = `${next.path}?tour=${next.id}`;
      if (next.path === pathname) window.history.replaceState(null, "", url);
      else router.push(url);
    },
    [pathname, router],
  );
  const exit = useCallback(() => {
    setStep(null);
    writeOrigin(null);
    setOrigin(null);
    // Leave the rest of the URL (such as the Kisumu tab) as it is.
    const query = new URLSearchParams(window.location.search);
    query.delete("tour");
    const search = query.toString();
    window.history.replaceState(
      null,
      "",
      `${pathname}${search ? `?${search}` : ""}`,
    );
  }, [pathname]);
  const start = useCallback(() => {
    // Remember the view the tour starts from (the Kisumu URL holds shock, budget, tab and day).
    const query = new URLSearchParams(window.location.search);
    query.delete("tour");
    const search = query.toString();
    const from = `${window.location.pathname}${search ? `?${search}` : ""}`;
    const kept = from === "/" ? null : from;
    writeOrigin(kept);
    setOrigin(kept);
    go(0);
  }, [go]);
  const returnToStart = useCallback(() => {
    const target = origin;
    writeOrigin(null);
    setOrigin(null);
    setStep(null);
    // A full load so the page reads its whole view (shock, budget, tab and day) from the URL.
    if (target) tourNavigation.assign(target);
  }, [origin]);
  const value = useMemo(
    () => ({ step, start, go, exit, origin, returnToStart }),
    [step, start, go, exit, origin, returnToStart],
  );
  return (
    <TourContext.Provider value={value}>
      {children}
      {step && <TourPanel />}
    </TourContext.Provider>
  );
}

/** How long a step waits for its target to become visible before letting the user go on. */
export const TARGET_WAIT_MS = 15000;

function visible(element: Element) {
  const box = element.getBoundingClientRect();
  return (
    box.width > 0 &&
    box.height > 0 &&
    (typeof (element as HTMLElement).checkVisibility !== "function" ||
      (element as HTMLElement).checkVisibility())
  );
}

function TourPanel() {
  const { step, go, exit, origin, returnToStart } = useTour();
  const [ready, setReady] = useState(false);
  const { t } = usePreferences();
  const title = useRef<HTMLHeadingElement>(null);
  const index = TOUR_STEPS.findIndex((item) => item.id === step);
  const current = TOUR_STEPS[index];
  useEffect(() => {
    title.current?.focus();
    if (!current) return;
    const reduce = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    let marked: Element | null = null;
    let attempts = 0;
    setReady(false);
    // Wait until the step's target is on the page and visible (for example after a tab,
    // a role or the phone scenario panel has switched), then mark and scroll to it.
    const timer = window.setInterval(() => {
      const target = document.querySelector(current.target);
      const shown = !!target && visible(target);
      if (shown || ++attempts > TARGET_WAIT_MS / 250) {
        window.clearInterval(timer);
        setReady(true);
      }
      if (!target || !shown) return;
      marked = target.closest("section") ?? target;
      marked.setAttribute("data-tour-active", "true");
      target.scrollIntoView({
        behavior: reduce ? "auto" : "smooth",
        block: "center",
      });
    }, 250);
    return () => {
      window.clearInterval(timer);
      marked?.removeAttribute("data-tour-active");
    };
  }, [current]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") exit();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [exit]);
  if (!current) return null;
  const last = index === TOUR_STEPS.length - 1;
  return (
    <section className="tour-panel" aria-labelledby="tour-title">
      <p className="eyebrow">
        {t("tourLabel")} · {t("tourStep")} {index + 1} / {TOUR_STEPS.length}
      </p>
      <h2 id="tour-title" ref={title} tabIndex={-1}>
        {t(`tour_${current.id}_title`)}
      </h2>
      <p aria-live="polite">{t(`tour_${current.id}_text`)}</p>
      {!ready && (
        <p className="tour-waiting" role="status">
          {t("tourWaiting")}
        </p>
      )}
      <div className="tour-actions">
        <button
          type="button"
          disabled={index === 0}
          onClick={() => go(index - 1)}
        >
          {t("tourBack")}
        </button>
        <button
          type="button"
          className="tour-primary"
          // aria-disabled keeps Next in the tab order while the target loads.
          aria-disabled={!ready || undefined}
          onClick={() => {
            if (!ready) return;
            if (last) exit();
            else go(index + 1);
          }}
        >
          {last ? t("tourFinish") : t("tourNext")}
        </button>
        <button type="button" onClick={exit}>
          {t("tourExit")}
        </button>
        {origin && (
          <button type="button" onClick={returnToStart}>
            {t("tourReturn")}
          </button>
        )}
      </div>
    </section>
  );
}

export function StartTourButton() {
  const { step, start } = useTour();
  const { t } = usePreferences();
  if (step) return null;
  return (
    <button type="button" className="tour-start button-primary" onClick={start}>
      {t("tourStart")}
    </button>
  );
}
