import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

/**
 * A11Y-11 regression guard (shared picker panel half).
 *
 * SearchablePickerPanel backs five of the six chat pickers (expert, knowledge,
 * skill, subagent, connector), which own no list markup themselves. Before this
 * fix it had zero ARIA: the search box was named only by a placeholder, and
 * filtering was completely silent.
 *
 * These panels are MULTI-SELECT TOGGLES inside a popover, not comboboxes. That
 * is why the list is role="group" with aria-pressed on the items rather than
 * role="listbox" with aria-selected: the rows contain real <button>s, and an
 * option may not contain interactive descendants.
 */

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    // Resolve to the fallback, as the shared test setup does, so assertions
    // read the literal string rather than a locale lookup.
    t: (_key: string, fallback?: string, options?: { count?: number }) =>
      fallback === undefined
        ? _key
        : fallback.replace("{{count}}", String(options?.count ?? "")),
  }),
}));

import SearchablePickerPanel from "./SearchablePickerPanel";

interface Row {
  id: string;
  name: string;
}

const rows: Row[] = [
  { id: "a", name: "Alpha" },
  { id: "b", name: "Beta" },
];

function setup(
  overrides: Partial<Parameters<typeof SearchablePickerPanel<Row>>[0]> = {},
) {
  return render(
    <SearchablePickerPanel<Row>
      items={rows}
      filterFn={(item, query) =>
        item.name.toLowerCase().includes(query.toLowerCase())
      }
      searchPlaceholder="Search things"
      ariaLabel="Things"
      emptyMessage="Nothing here"
      renderItem={(item) => (
        <button type="button" aria-pressed={item.id === "a"}>
          {item.name}
        </button>
      )}
      footerIcon={null}
      footerLabel="Manage"
      onFooterClick={vi.fn()}
      {...overrides}
    />,
  );
}

describe("searchable picker panel (A11Y-11)", () => {
  it("gives the search field an accessible name, not just a placeholder", () => {
    setup();
    // The placeholder disappears on first keystroke and is not a name.
    expect(screen.getByRole("searchbox")).toHaveAccessibleName("Things");
  });

  it("exposes the list as a labelled group", () => {
    setup();
    expect(screen.getByRole("group")).toHaveAccessibleName("Things");
  });

  it("announces the result count through a live region", () => {
    // Filtering was previously silent: the list could shrink to nothing with no
    // announcement at all.
    setup();
    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-live", "polite");
    expect(status).toHaveTextContent("2 results");
  });

  it("keeps the live region present even when the filter matches nothing", () => {
    // An aria-live region must exist BEFORE its content changes, or the update
    // is not announced. Rendering it only in the non-empty branch would break
    // exactly the case that needs announcing most.
    setup({ items: [] });
    expect(screen.getByRole("status")).toHaveTextContent("0 results");
  });

  it("still renders the items and the empty state", () => {
    setup();
    expect(screen.getAllByRole("button")).toHaveLength(3); // 2 rows + footer
    expect(screen.getByText("Alpha")).toBeInTheDocument();

    setup({ items: [] });
    expect(screen.getByText("Nothing here")).toBeInTheDocument();
  });

  it("carries aria-pressed through from renderItem", () => {
    // The panel does not own toggle state - callers pass it in renderItem - so
    // this pins that the panel does not strip it.
    setup();
    expect(screen.getByRole("button", { name: "Alpha" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "Beta" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });
});
