import { expect, it } from "vitest";
import {
  DEFAULT_LINK_STATE,
  readLinkState,
  writeLinkState,
} from "./link-state";

it("round-trips shock, budget, tab and day through the query string", () => {
  const state = {
    shock: 20 as const,
    budget: 65,
    tab: "facilities" as const,
    day: 41,
  };
  const search = writeLinkState("?tour=rank", state);
  expect(search).toBe("?tour=rank&shock=20&budget=65&tab=facilities&day=41");
  expect(readLinkState(search)).toEqual(state);
});

it("falls back to the defaults for missing or malformed values", () => {
  expect(readLinkState("")).toEqual(DEFAULT_LINK_STATE);
  expect(readLinkState("?shock=33&budget=abc&tab=admin&day=120")).toEqual(
    DEFAULT_LINK_STATE,
  );
  expect(readLinkState("?budget=37&day=0&shock=0").budget).toBe(35);
  expect(readLinkState("?budget=37&day=0&shock=0")).toMatchObject({
    shock: 0,
    day: 0,
  });
});
