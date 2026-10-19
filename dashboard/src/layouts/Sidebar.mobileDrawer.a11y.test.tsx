import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

/**
 * A11Y-2 regression guard: the mobile drawer must leave the accessibility tree
 * when closed, and Escape must dismiss it.
 *
 * The drawer is only moved off-screen with `transform: translateX(-100%)`, so it
 * stayed in the a11y tree — a screen reader walked a nav the user could not see,
 * and Tab landed on off-screen links. There were also 0 Escape handlers anywhere
 * under layouts/, so an open drawer could only be dismissed by finding the
 * toggle again: impossible for a keyboard user already inside it.
 */

vi.mock("../context/AuthContext", () => ({
  useAuth: () => ({ user: { username: "tester", role: "admin" } }),
}));

vi.mock("../api/modules/agents", () => ({
  listAgents: vi.fn().mockResolvedValue([]),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback ?? key,
    i18n: { language: "en", changeLanguage: vi.fn() },
  }),
}));

import Sidebar from "./Sidebar";

function renderSidebar(collapsed: boolean, onToggle = vi.fn()) {
  return {
    onToggle,
    ...render(
      <MemoryRouter>
        <Sidebar
          collapsed={collapsed}
          onToggle={onToggle}
          selectedKey="chat"
          isMobile
        />
      </MemoryRouter>,
    ),
  };
}

describe("mobile sidebar drawer (A11Y-2)", () => {
  /**
   * The drawer is the element carrying a non-identity transform. Finding it this
   * way matters: an earlier version of this test accepted "any element with
   * aria-hidden", which passed even with the fix removed, because decorative
   * icons legitimately carry aria-hidden.
   */
  function findDrawer(container: HTMLElement): HTMLElement {
    const all = Array.from(container.querySelectorAll<HTMLElement>("div"));
    const drawer = all.find((el) =>
      (el.style.transform ?? "").includes("translateX"),
    );
    if (!drawer) throw new Error("drawer element not found");
    return drawer;
  }

  it("marks the closed drawer aria-hidden", () => {
    const { container } = renderSidebar(true);
    expect(findDrawer(container)).toHaveAttribute("aria-hidden", "true");
  });

  it("marks the closed drawer inert so focus cannot enter it", () => {
    // aria-hidden alone leaves the links tabbable; inert is what stops Tab
    // landing on off-screen controls.
    const { container } = renderSidebar(true);
    expect(findDrawer(container)).toHaveAttribute("inert");
  });

  it("neither hides nor inerts the drawer when open", () => {
    const { container } = renderSidebar(false);
    const drawer = findDrawer(container);
    expect(drawer).not.toHaveAttribute("aria-hidden");
    expect(drawer).not.toHaveAttribute("inert");
    expect(
      screen.getByRole("navigation", { name: /Primary|nav\./ }),
    ).toBeInTheDocument();
  });

  it("closes the open drawer on Escape", () => {
    const { onToggle } = renderSidebar(false);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it("does not fire onToggle for Escape while already closed", () => {
    // The handler is only mounted for an open drawer, so a stray Escape must
    // not flip the drawer open.
    const { onToggle } = renderSidebar(true);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onToggle).not.toHaveBeenCalled();
  });

  it("ignores keys other than Escape", () => {
    const { onToggle } = renderSidebar(false);
    fireEvent.keyDown(window, { key: "Enter" });
    fireEvent.keyDown(window, { key: "a" });
    expect(onToggle).not.toHaveBeenCalled();
  });
});
