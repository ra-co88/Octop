import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import SidebarCollapsedIconNav from "./SidebarCollapsedIconNav";
import type { NavItem } from "./sidebarNav";

/**
 * A11Y-4 regression guard: the active sidebar entry must expose
 * `aria-current="page"`.
 *
 * The item's active state was previously conveyed by colour alone, so a screen
 * reader user got no indication of which section they were in. The name matters
 * too: the collapsed rail hides the label in a Tooltip, which is NOT part of the
 * accessibility tree, so without `aria-label` each button announces as "button".
 */

// Tooltip renders a portal; the button itself is what we assert on.
const items: NavItem[] = [
  { key: "chat", path: "/chat", icon: <span>c</span>, labelKey: "nav.chat" },
  {
    key: "experts",
    path: "/experts",
    icon: <span>e</span>,
    labelKey: "nav.experts",
  },
];

/** Minimal t() that returns the key, so names are predictable. */
const t = ((key: string) => key) as never;

function renderNav(selectedKey: string) {
  return render(
    <SidebarCollapsedIconNav
      items={items}
      selectedKey={selectedKey}
      onNavigate={vi.fn()}
      role="admin"
      hasUpdate={false}
      t={t}
    />,
  );
}

describe("SidebarCollapsedIconNav accessibility", () => {
  it("marks the selected item with aria-current=page", () => {
    renderNav("experts");

    const active = screen.getByRole("button", { current: "page" });
    expect(active).toHaveAttribute("aria-current", "page");
    expect(active).toHaveAccessibleName("nav.experts");
  });

  it("leaves non-selected items without aria-current", () => {
    renderNav("experts");

    const chat = screen.getByRole("button", { name: "nav.chat" });
    expect(chat).not.toHaveAttribute("aria-current");
  });

  it("gives every collapsed item an accessible name", () => {
    renderNav("chat");

    // Would throw if the icon-only buttons had no accessible name.
    expect(
      screen.getByRole("button", { name: "nav.chat" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "nav.experts" }),
    ).toBeInTheDocument();
  });
});
