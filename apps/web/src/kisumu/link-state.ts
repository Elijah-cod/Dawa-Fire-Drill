import { SHOCKS, type Shock } from "../components/scenario-controls";
import { DEFAULT_BUDGET, snapBudget } from "./use-ranking";

export const VIEWS = ["overview", "order", "funding", "facilities"] as const;
export type View = (typeof VIEWS)[number];
export type LinkState = {
  shock: Shock;
  budget: number;
  tab: View;
  day: number;
};

export const DEFAULT_LINK_STATE: LinkState = {
  shock: 40,
  budget: DEFAULT_BUDGET,
  tab: "overview",
  day: 45,
};

/** The view a link describes; unknown or malformed values fall back to the defaults. */
export function readLinkState(search: string): LinkState {
  const query = new URLSearchParams(search);
  const number = (key: string) =>
    query.has(key) && query.get(key) !== "" ? Number(query.get(key)) : NaN;
  const shock = number("shock");
  const budget = number("budget");
  const day = number("day");
  const tab = query.get("tab");
  return {
    shock: SHOCKS.includes(shock as Shock)
      ? (shock as Shock)
      : DEFAULT_LINK_STATE.shock,
    budget: Number.isFinite(budget)
      ? snapBudget(budget)
      : DEFAULT_LINK_STATE.budget,
    tab: VIEWS.includes(tab as View) ? (tab as View) : DEFAULT_LINK_STATE.tab,
    day:
      Number.isInteger(day) && day >= 0 && day <= 90
        ? day
        : DEFAULT_LINK_STATE.day,
  };
}

/** The same query string with the view's values; other parameters (such as the tour) stay. */
export function writeLinkState(search: string, state: LinkState): string {
  const query = new URLSearchParams(search);
  query.set("shock", String(state.shock));
  query.set("budget", String(state.budget));
  query.set("tab", state.tab);
  query.set("day", String(state.day));
  return `?${query.toString()}`;
}
