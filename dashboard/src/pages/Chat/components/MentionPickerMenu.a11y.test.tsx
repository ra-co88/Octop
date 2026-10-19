import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

/**
 * A11Y-11 regression guard (mention picker half).
 *
 * The mention menu was a stack of <div>s and <button>s with no listbox or
 * combobox semantics — 0 such roles existed anywhere under pages/Chat. So the
 * highlight that arrow keys move was invisible to assistive tech: a screen
 * reader got the text of every suggestion but no indication which one Enter
 * would pick.
 */

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback ?? key,
  }),
}));

vi.mock("./ExpertAgentAvatar", () => ({
  default: () => null,
}));

import MentionPickerMenu, {
  MENTION_LISTBOX_ID,
  mentionOptionId,
  type MentionPick,
} from "./MentionPickerMenu";

const items: MentionPick[] = [
  { kind: "connector", name: "c1", label: "Connector One" },
  { kind: "agent", agent_id: "a1", label: "Agent One" },
  { kind: "subagent", slug: "s1", label: "Subagent One" },
];

function setup(activeIndex: number) {
  return render(
    <MentionPickerMenu
      items={items}
      query=""
      activeIndex={activeIndex}
      onSelect={vi.fn()}
      onHover={vi.fn()}
    />,
  );
}

describe("mention picker listbox (A11Y-11)", () => {
  it("renders the menu as a labelled listbox", () => {
    setup(0);
    const listbox = screen.getByRole("listbox");
    expect(listbox).toHaveAttribute("id", MENTION_LISTBOX_ID);
    expect(listbox).toHaveAccessibleName();
  });

  it("exposes every suggestion as an option", () => {
    setup(0);
    expect(screen.getAllByRole("option")).toHaveLength(3);
  });

  it("marks exactly the active option as selected", () => {
    // This is the whole point: the arrow-key highlight has to be announced.
    setup(1);
    const selected = screen
      .getAllByRole("option")
      .filter((el) => el.getAttribute("aria-selected") === "true");
    expect(selected).toHaveLength(1);
    expect(selected[0]).toHaveTextContent("Agent One");
  });

  it("gives each option the id the composer points at", () => {
    // aria-activedescendant must resolve to a real element or it is inert.
    setup(2);
    const active = document.getElementById(mentionOptionId(2));
    expect(active).not.toBeNull();
    expect(active).toHaveAttribute("aria-selected", "true");
    expect(active).toHaveTextContent("Subagent One");
  });

  it("keeps ids stable across active-index changes", () => {
    const { rerender } = setup(0);
    const firstIds = screen.getAllByRole("option").map((el) => el.id);
    rerender(
      <MentionPickerMenu
        items={items}
        query=""
        activeIndex={2}
        onSelect={vi.fn()}
        onHover={vi.fn()}
      />,
    );
    expect(screen.getAllByRole("option").map((el) => el.id)).toEqual(firstIds);
  });

  it("still selects on click (the roles did not break interaction)", () => {
    const onSelect = vi.fn();
    render(
      <MentionPickerMenu
        items={items}
        query=""
        activeIndex={0}
        onSelect={onSelect}
        onHover={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("option", { name: /Agent One/ }));
    expect(onSelect).toHaveBeenCalledWith(items[1]);
  });

  it("renders the empty state as a listbox too", () => {
    // aria-controls points here whenever the menu is open; pointing at a
    // non-listbox would break the relationship.
    render(
      <MentionPickerMenu
        items={[]}
        query=""
        activeIndex={0}
        onSelect={vi.fn()}
        onHover={vi.fn()}
      />,
    );
    expect(screen.getByRole("listbox")).toHaveAttribute(
      "id",
      MENTION_LISTBOX_ID,
    );
    expect(screen.queryAllByRole("option")).toHaveLength(0);
  });
});
