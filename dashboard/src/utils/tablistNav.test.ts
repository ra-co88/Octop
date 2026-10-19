import { describe, expect, it, vi } from "vitest";
import { handleTablistNav } from "./tablistNav";

/**
 * A11Y-3 regression guard.
 *
 * A role="tablist" is announced correctly but is not *navigable* without a key
 * handler: the arrow keys scroll the page instead of moving between tabs. This
 * logic lived inline in AgentSelector and is now shared with ChromeTabBar, whose
 * tabs were not focusable at all (no tabIndex).
 *
 * Built on a real DOM rather than a synthetic event object, because the helper
 * reads document.activeElement and queries the DOM — mocking those would test
 * the mock instead of the behaviour.
 */

function buildTabs(count = 3) {
  const list = document.createElement("div");
  list.setAttribute("role", "tablist");
  const tabs: HTMLElement[] = [];
  for (let i = 0; i < count; i += 1) {
    const tab = document.createElement("div");
    tab.setAttribute("role", "tab");
    tab.setAttribute("data-tab-key", `k${i}`);
    tab.tabIndex = i === 0 ? 0 : -1;
    list.appendChild(tab);
    tabs.push(tab);
  }
  document.body.appendChild(list);
  return { list, tabs };
}

function press(
  list: HTMLElement,
  key: string,
  onActivate?: (t: HTMLElement) => void,
) {
  const event = new KeyboardEvent("keydown", {
    key,
    bubbles: true,
    cancelable: true,
  }) as unknown as Parameters<typeof handleTablistNav>[0];
  Object.defineProperty(event, "currentTarget", { value: list });
  return handleTablistNav(event, { onActivate });
}

describe("handleTablistNav (A11Y-3)", () => {
  it("ignores keys that are not navigation keys", () => {
    const { list, tabs } = buildTabs();
    tabs[0].focus();
    expect(press(list, "a")).toBeNull();
    expect(press(list, "Enter")).toBeNull();
    expect(document.activeElement).toBe(tabs[0]);
  });

  it("moves right and wraps at the end", () => {
    const { list, tabs } = buildTabs();
    tabs[0].focus();
    press(list, "ArrowRight");
    expect(document.activeElement).toBe(tabs[1]);
    press(list, "ArrowRight");
    expect(document.activeElement).toBe(tabs[2]);
    press(list, "ArrowRight");
    // wrap
    expect(document.activeElement).toBe(tabs[0]);
  });

  it("moves left and wraps at the start", () => {
    const { list, tabs } = buildTabs();
    tabs[0].focus();
    press(list, "ArrowLeft");
    expect(document.activeElement).toBe(tabs[2]);
  });

  it("treats Down/Up as forward/back, per the horizontal-or-vertical pattern", () => {
    const { list, tabs } = buildTabs();
    tabs[0].focus();
    press(list, "ArrowDown");
    expect(document.activeElement).toBe(tabs[1]);
    press(list, "ArrowUp");
    expect(document.activeElement).toBe(tabs[0]);
  });

  it("jumps to first and last with Home and End", () => {
    const { list, tabs } = buildTabs();
    tabs[1].focus();
    press(list, "End");
    expect(document.activeElement).toBe(tabs[2]);
    press(list, "Home");
    expect(document.activeElement).toBe(tabs[0]);
  });

  it("focuses from a cold start when nothing inside is focused", () => {
    // activeElement is body, so indexOf is -1 and forward motion starts at 0.
    const { list, tabs } = buildTabs();
    (document.activeElement as HTMLElement)?.blur();
    press(list, "ArrowRight");
    expect(document.activeElement).toBe(tabs[0]);
  });

  it("calls onActivate with the newly focused tab", () => {
    const { list, tabs } = buildTabs();
    const onActivate = vi.fn();
    tabs[0].focus();
    press(list, "ArrowRight", onActivate);
    expect(onActivate).toHaveBeenCalledWith(tabs[1]);
  });

  it("does not call onActivate for a non-navigation key", () => {
    const { list, tabs } = buildTabs();
    const onActivate = vi.fn();
    tabs[0].focus();
    press(list, "x", onActivate);
    expect(onActivate).not.toHaveBeenCalled();
  });

  it("returns null for an empty tablist", () => {
    const empty = document.createElement("div");
    empty.setAttribute("role", "tablist");
    document.body.appendChild(empty);
    expect(press(empty, "ArrowRight")).toBeNull();
  });

  it("prevents default so the arrow keys do not scroll the page", () => {
    const { list, tabs } = buildTabs();
    tabs[0].focus();
    const event = new KeyboardEvent("keydown", {
      key: "ArrowRight",
      bubbles: true,
      cancelable: true,
    });
    Object.defineProperty(event, "currentTarget", { value: list });
    handleTablistNav(
      event as unknown as Parameters<typeof handleTablistNav>[0],
    );
    expect(event.defaultPrevented).toBe(true);
  });
});
