import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AppDialog from "./AppDialog";

/**
 * A11Y-5 regression guard: a dialog that declares `aria-modal="true"` must
 * behave modally for the keyboard too.
 *
 * The hand-rolled overlays this replaces announced modality to assistive tech
 * while leaving focus on the trigger behind them, letting Tab walk into the
 * inert page and making Escape a no-op.
 */
describe("AppDialog", () => {
  const renderDialog = (
    props: Partial<React.ComponentProps<typeof AppDialog>> = {},
  ) =>
    render(
      <AppDialog aria-label="Test dialog" {...props}>
        <button>first</button>
        <button>last</button>
      </AppDialog>,
    );

  it("moves focus into the dialog on open", () => {
    renderDialog();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    // First focusable control, not the trigger behind the overlay.
    expect(screen.getByRole("button", { name: "first" })).toHaveFocus();
  });

  it("dismisses on Escape when dismissable", async () => {
    const onClose = vi.fn();
    renderDialog({ onClose });

    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("ignores Escape when not dismissable (e.g. mid-restart)", async () => {
    const onClose = vi.fn();
    renderDialog({ onClose, dismissable: false });

    await userEvent.keyboard("{Escape}");
    expect(onClose).not.toHaveBeenCalled();
  });

  it("traps Tab: focus stays inside the dialog", async () => {
    renderDialog();
    const first = screen.getByRole("button", { name: "first" });
    const last = screen.getByRole("button", { name: "last" });

    // Tab forward off the last control wraps back to the first.
    last.focus();
    await userEvent.tab();
    expect(first).toHaveFocus();

    // Shift+Tab from the first wraps to the last.
    await userEvent.tab({ shift: true });
    expect(last).toHaveFocus();
  });

  it("restores focus to the trigger on unmount", async () => {
    const trigger = document.createElement("button");
    trigger.textContent = "trigger";
    document.body.appendChild(trigger);
    trigger.focus();

    const { unmount } = renderDialog();
    expect(screen.getByRole("button", { name: "first" })).toHaveFocus();

    unmount();
    expect(trigger).toHaveFocus();
    trigger.remove();
  });

  it("dismisses on backdrop click but not on inner click", async () => {
    const onClose = vi.fn();
    renderDialog({ onClose });

    await userEvent.click(screen.getByRole("button", { name: "first" }));
    expect(onClose).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("dialog"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
