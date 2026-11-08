"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { usePreferences } from "../preferences/preferences";

/** Primary destinations available today; every target is synthetic demo data. */
export const NAV_ITEMS = [
  { key: "overview", href: "/", path: "/" },
  { key: "navKisumu", href: "/kisumu", path: "/kisumu" },
  { key: "navFunding", href: "/kisumu#funding-title", path: null },
  { key: "navCapture", href: "/kisumu?view=capture#capture-title", path: null },
] as const;

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
