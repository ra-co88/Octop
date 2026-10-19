import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ChromeTabBar } from "./index";

/**
 * A11Y-3 regression guard (ChromeTabBar half).
 *
 * The tablist had role="tab" chips but no key handler and no tabIndex, so the
 * tabs were not focusable at all and the arrow keys did nothing. The helper is
 * unit-tested separately; this proves it is actually WIRED to this component —
 * a passing helper test says nothing about whether the component calls it.
 */

const tabs = [
  { key: "one", label: "One" },
  { key: "two", label: "Two" },
  { key: "three", label: "Three" },
];

function renderBar(activeKey = "one") {
  const onChange = vi.fn();
  render(
    <ChromeTabBar tabs={tabs} activeKey={activeKey} onChange={onChange} />,
  );
  return { onChange };
}

describe("ChromeTabBar tablist keyboard (A11Y-3)", () => {
  it("makes only the selected tab reachable by Tab", () => {
    renderBar("two");
    expect(screen.getByRole("tab", { name: /Two/ })).toHaveAttribute(
      "tabindex",
      "0",
    );
    expect(screen.getByRole("tab", { name: /One/ })).toHaveAttribute(
      "tabindex",
      "-1",
    );
  });

  it("moves focus and selects on ArrowRight", () => {
    const { onChange } = renderBar("one");
    const first = screen.getByRole("tab", { name: /One/ });
    first.focus();
    fireEvent.keyDown(first, { key: "ArrowRight" });
    expect(document.activeElement).toBe(
      screen.getByRole("tab", { name: /Two/ }),
    );
    expect(onChange).toHaveBeenCalledWith("two");
  });

  it("wraps from the last tab back to the first", () => {
    const { onChange } = renderBar("three");
    const last = screen.getByRole("tab", { name: /Three/ });
    last.focus();
    fireEvent.keyDown(last, { key: "ArrowRight" });
    expect(onChange).toHaveBeenCalledWith("one");
  });

  it("jumps to the last tab with End", () => {
    const { onChange } = renderBar("one");
    const first = screen.getByRole("tab", { name: /One/ });
    first.focus();
    fireEvent.keyDown(first, { key: "End" });
    expect(onChange).toHaveBeenCalledWith("three");
  });

  it("does not change tabs on an unrelated key", () => {
    const { onChange } = renderBar("one");
    const first = screen.getByRole("tab", { name: /One/ });
    first.focus();
    fireEvent.keyDown(first, { key: "a" });
    expect(onChange).not.toHaveBeenCalled();
  });
});
