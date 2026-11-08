"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";

export type TabItem<T extends string> = {
  id: T;
  label: string;
  count?: number;
};

/**
 * ARIA tabs with automatic activation: arrows, Home and End move to and select a tab; only
 * the selected tab is in the tab order. Panels use id `p-<id>` and label themselves by `t-<id>`.
 */
export function TabList<T extends string>({
  label,
  items,
  selected,
  onSelect,
}: {
  label: string;
  items: TabItem<T>[];
  selected: T;
  onSelect: (id: T) => void;
}) {
  const list = useRef<HTMLDivElement>(null);
  // On narrow screens the strip scrolls sideways; fades and a chevron show there is more.
  const [more, setMore] = useState({ start: false, end: false });
  useEffect(() => {
    const element = list.current;
    if (!element) return;
    const update = () =>
      setMore({
        start: element.scrollLeft > 1,
        end: element.scrollLeft + element.clientWidth < element.scrollWidth - 1,
      });
    update();
    element.addEventListener("scroll", update, { passive: true });
    const observer =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(update);
    observer?.observe(element);
    return () => {
      element.removeEventListener("scroll", update);
      observer?.disconnect();
    };
  }, []);
  // Keep the selected tab in view when it changes, by keyboard or from elsewhere.
  // Only the strip scrolls sideways; the page itself never moves.
  useEffect(() => {
    const strip = list.current;
    const tab = strip?.querySelector<HTMLElement>(`#t-${selected}`);
    if (!strip || !tab) return;
    const left = tab.offsetLeft - strip.offsetLeft;
    if (left < strip.scrollLeft) strip.scrollLeft = left;
    else if (left + tab.offsetWidth > strip.scrollLeft + strip.clientWidth)
      strip.scrollLeft = left + tab.offsetWidth - strip.clientWidth + 40;
  }, [selected]);
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const index = items.findIndex((item) => item.id === selected);
    const next = {
      ArrowRight: (index + 1) % items.length,
      ArrowLeft: (index - 1 + items.length) % items.length,
      Home: 0,
      End: items.length - 1,
    }[event.key];
    if (next === undefined) return;
    event.preventDefault();
    onSelect(items[next].id);
    list.current
      ?.querySelector<HTMLButtonElement>(`#t-${items[next].id}`)
      ?.focus();
  };
  return (
    <div
      className="tabs-wrap"
      data-more-start={more.start || undefined}
      data-more-end={more.end || undefined}
    >
      <div
        className="tabs"
        role="tablist"
        aria-label={label}
        ref={list}
        onKeyDown={onKeyDown}
      >
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            className="tab"
            id={`t-${item.id}`}
            aria-controls={`p-${item.id}`}
            aria-selected={item.id === selected}
            tabIndex={item.id === selected ? 0 : -1}
            onClick={() => onSelect(item.id)}
          >
            {item.label}
            {item.count !== undefined && (
              <span className="count">{item.count}</span>
            )}
          </button>
        ))}
      </div>
      {more.end && (
        <button
          type="button"
          className="tabs-more"
          aria-hidden="true"
          tabIndex={-1}
          onClick={() =>
            list.current?.scrollBy({ left: list.current.clientWidth * 0.6 })
          }
        >
          <svg className="icon icon--sm" viewBox="0 0 24 24">
            <path d="M9 6l6 6-6 6" />
          </svg>
        </button>
      )}
    </div>
  );
}
