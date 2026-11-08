"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { usePreferences } from "../preferences/preferences";

/** Primary destinations available today; every target is synthetic demo data. */
export const NAV_ITEMS = [
  { key: "overview", href: "/", path: "/", icon: "home" },
  { key: "navKisumu", href: "/kisumu", path: "/kisumu", icon: "pin" },
  {
    key: "navFunding",
    href: "/kisumu#funding-title",
    path: null,
    icon: "flow",
  },
  {
    key: "navCapture",
    href: "/kisumu?view=capture#capture-title",
    path: null,
    icon: "card",
  },
] as const;

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

export function PrimaryNav({ label }: { label: string }) {
  const { t } = usePreferences();
  const pathname = usePathname();
  return (
    <nav aria-label={label}>
      {NAV_ITEMS.map((item) => (
        <Link
          key={item.key}
          href={item.href}
          aria-current={item.path === pathname ? "page" : undefined}
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
