"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef } from "react";
import { usePreferences } from "../preferences/preferences";

/** Primary destinations available today; every target is synthetic demo data. */
export const NAV_ITEMS = [
  { key: "overview", href: "/", icon: "home" },
  { key: "navKisumu", href: "/kisumu", icon: "pin" },
  { key: "navFunding", href: "/kisumu?tab=funding", icon: "flow" },
  {
    key: "navCapture",
    href: "/kisumu?view=capture#capture-title",
    icon: "card",
  },
] as const;
export type NavKey = (typeof NAV_ITEMS)[number]["key"];

/**
 * The one destination the URL shows: the page, then the Kisumu view (capture) or tab
 * (funding). The guided demo's capture step counts as capture.
 */
export function activeNavKey(
  pathname: string,
  search: URLSearchParams,
): NavKey | null {
  if (pathname === "/") return "overview";
  if (pathname !== "/kisumu") return null;
  if (search.get("view") === "capture" || search.get("tour") === "capture")
    return "navCapture";
  if (search.get("tab") === "funding" || search.get("tour") === "funding")
    return "navFunding";
  return "navKisumu";
}

/** Small stroke icons from the approved preview; decorative, the link text names each item. */
const ICONS = {
  home: <path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />,
  pin: (
    <>
      <path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z" />
      <circle cx="12" cy="10" r="2.5" />
    </>
  ),
  flow: (
    <>
      <path d="M4 6h10M4 12h16M4 18h7" />
      <circle cx="18" cy="6" r="2" />
      <circle cx="15" cy="18" r="2" />
    </>
  ),
  card: (
    <>
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <path d="M8 8h8M8 12h8M8 16h5" />
    </>
  ),
};

function Links({ label, active }: { label: string; active: NavKey | null }) {
  const { t } = usePreferences();
  return (
    <nav aria-label={label}>
      {NAV_ITEMS.map((item) => (
        <Link
          key={item.key}
          href={item.href}
          aria-current={item.key === active ? "page" : undefined}
        >
          <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
            {ICONS[item.icon]}
          </svg>
          {t(item.key)}
        </Link>
      ))}
    </nav>
  );
}

function LiveLinks({ label }: { label: string }) {
  const pathname = usePathname();
  const search = useSearchParams();
  return (
    <Links
      label={label}
      active={activeNavKey(pathname, new URLSearchParams(search.toString()))}
    />
  );
}

/** The active link follows the URL, including same-page query changes and back/forward. */
export function PrimaryNav({ label }: { label: string }) {
  const pathname = usePathname();
  return (
    <Suspense
      fallback={
        <Links
          label={label}
          active={activeNavKey(pathname, new URLSearchParams())}
        />
      }
    >
      <LiveLinks label={label} />
    </Suspense>
  );
}

/** Scroll to and focus a late-rendered section named by the URL hash, once. */
export function useHashTarget(id: string, ready: boolean) {
  const done = useRef(false);
  useEffect(() => {
    if (!ready || done.current || window.location.hash !== `#${id}`) return;
    const element = document.getElementById(id);
    if (!element) return;
    done.current = true;
    element.scrollIntoView({ block: "start" });
    if (!element.hasAttribute("tabindex"))
      element.setAttribute("tabindex", "-1");
    element.focus({ preventScroll: true });
  }, [id, ready]);
}
