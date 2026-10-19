import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

/**
 * A11Y-14 regression guard.
 *
 * The inline variant renders "label: value" into a span that truncates with an
 * ellipsis. There was no title, so a long id was unrecoverable for a sighted
 * user — the accessible name carried the full text, so only the visual case was
 * broken, which is exactly the kind of gap a screen-reader-only check misses.
 */

vi.mock("@/utils/copyText", () => ({
  copyText: vi.fn().mockResolvedValue(true),
}));
vi.mock("@/utils/antdMessage", () => ({
  message: { success: vi.fn(), error: vi.fn() },
}));

import { CopyableResourceId } from "./CopyableResourceId";

const LONG = "expert_01JABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

describe("CopyableResourceId tooltip (A11Y-14)", () => {
  it("exposes the full text as a title when inline", () => {
    // .inlineText truncates; without a title the tail is unreadable.
    render(<CopyableResourceId label="ID" value={LONG} inline />);
    const button = screen.getByRole("button");
    expect(button).toHaveAttribute("title", `ID: ${LONG}`);
  });

  it("exposes the full text as a title when not inline", () => {
    render(<CopyableResourceId label="ID" value={LONG} />);
    const button = screen.getByRole("button");
    expect(button).toHaveAttribute("title", `ID: ${LONG}`);
  });

  it("keeps the accessible name carrying the value", () => {
    // The title must not replace the real text content.
    render(<CopyableResourceId label="ID" value={LONG} inline />);
    expect(screen.getByRole("button")).toHaveAccessibleName(new RegExp(LONG));
  });
});
