"use client";

import { useRef, type KeyboardEvent } from "react";

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
    <div className="tabs-wrap">
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
    </div>
  );
}
