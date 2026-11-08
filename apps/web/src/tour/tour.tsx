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
  { id: "shock", path: "/kisumu", target: "#shock-slider" },
  { id: "stockout", path: "/kisumu", target: ".shock-panel" },
  { id: "funding", path: "/kisumu", target: "#funding-title" },
  { id: "rank", path: "/kisumu", target: "#ranked-title" },
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
};
const TourContext = createContext<Tour>({
  step: null,
  start: () => {},
  go: () => {},
  exit: () => {},
});
export const useTour = () => useContext(TourContext);

function stepFromLocation(): TourStep | null {
  const id = new URLSearchParams(window.location.search).get("tour");
  return TOUR_STEPS.find((item) => item.id === id)?.id ?? null;
}

export function TourProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [step, setStep] = useState<TourStep | null>(null);
  useEffect(() => {
    setStep(stepFromLocation());
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
    window.history.replaceState(null, "", pathname);
  }, [pathname]);
  const value = useMemo(
    () => ({ step, start: () => go(0), go, exit }),
    [step, go, exit],
  );
  return (
    <TourContext.Provider value={value}>
      {children}
      {step && <TourPanel />}
    </TourContext.Provider>
  );
}

function TourPanel() {
  const { step, go, exit } = useTour();
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
    const timer = window.setInterval(() => {
      const target = document.querySelector(current.target);
      if (target || ++attempts > 40) window.clearInterval(timer);
      if (!target) return;
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
          onClick={() => (last ? exit() : go(index + 1))}
        >
          {last ? t("tourFinish") : t("tourNext")}
        </button>
        <button type="button" onClick={exit}>
          {t("tourExit")}
        </button>
      </div>
    </section>
  );
}

export function StartTourButton() {
  const { step, start } = useTour();
  const { t } = usePreferences();
  if (step) return null;
  return (
    <button type="button" className="tour-start" onClick={start}>
      {t("tourStart")}
    </button>
  );
}
