"use client";

import { useRef, type KeyboardEvent } from "react";

export type RadioOption<T extends string | number> = {
  value: T;
  label: string;
};

/**
 * A mutually exclusive choice as an ARIA radio group: one tab stop (the checked option),
 * arrow keys move and select (wrapping), Home and End jump to the ends, Space or Enter
 * selects the focused option.
 */
export function RadioGroup<T extends string | number>({
  id,
  labelledBy,
  options,
  value,
  disabled,
  onChange,
}: {
  id?: string;
  labelledBy: string;
  options: RadioOption<T>[];
  value: T;
  disabled?: boolean;
  onChange: (value: T) => void;
}) {
  const group = useRef<HTMLDivElement>(null);
  const select = (index: number) => {
    const option = options[index];
    onChange(option.value);
    group.current
      ?.querySelectorAll<HTMLButtonElement>('[role="radio"]')
      [index]?.focus();
  };
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;
    const index = options.findIndex((option) => option.value === value);
    const last = options.length - 1;
    const next = {
      ArrowRight: index === last ? 0 : index + 1,
      ArrowDown: index === last ? 0 : index + 1,
      ArrowLeft: index === 0 ? last : index - 1,
      ArrowUp: index === 0 ? last : index - 1,
      Home: 0,
      End: last,
    }[event.key];
    if (next === undefined) return;
    event.preventDefault();
    select(next);
  };
  return (
    <div
      className="segmented"
      id={id}
      role="radiogroup"
      aria-labelledby={labelledBy}
      aria-disabled={disabled || undefined}
      ref={group}
      onKeyDown={onKeyDown}
    >
      {options.map((option) => {
        const checked = option.value === value;
        return (
          <button
            key={String(option.value)}
            type="button"
            role="radio"
            aria-checked={checked}
            tabIndex={checked ? 0 : -1}
            disabled={disabled}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
