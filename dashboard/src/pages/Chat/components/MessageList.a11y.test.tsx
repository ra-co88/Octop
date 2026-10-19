import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import MessageList from "./MessageList";
import { VoiceOutputProvider } from "../../../context/VoiceOutputContext";

/**
 * A11Y-1 regression guard: the chat transcript must be a live region.
 *
 * Without `role="log"` + `aria-live`, a screen reader user gets no announcement
 * when a reply arrives and must manually re-navigate the transcript.
 *
 * MessageList has two render paths and they are separate code sites: the plain
 * div (short histories) and the virtualised Virtuoso list (>= 30 groups). The
 * first is asserted by RENDERING it. The second is asserted by inspecting the
 * source, because mounting Virtuoso with a real message list does not settle in
 * jsdom — the same class of problem documented for EditAgentDrawer — so a
 * render-based assertion there would hang rather than fail.
 */

const SOURCE = readFileSync(resolve(__dirname, "MessageList.tsx"), "utf8");

/** Attributes every transcript root must carry, in both branches. */
const LIVE_REGION_ATTRS = [
  'role="log"',
  'aria-live="polite"',
  'aria-relevant="additions"',
];

function renderInRouter(ui: React.ReactElement) {
  return render(
    <MemoryRouter>
      <VoiceOutputProvider>{ui}</VoiceOutputProvider>
    </MemoryRouter>,
  );
}

describe("MessageList live region", () => {
  it("is a polite log region on the non-virtual path", () => {
    const { container } = renderInRouter(
      <MessageList
        messages={[{ id: "a", role: "user", content: "hello", timestamp: 1 }]}
      />,
    );

    const log = container.querySelector('[role="log"]');
    expect(log).not.toBeNull();
    expect(log).toHaveAttribute("aria-live", "polite");
    expect(log).toHaveAttribute("aria-relevant", "additions");
  });

  it("marks the region busy only while streaming", () => {
    const msg = { id: "a", role: "user" as const, content: "hi", timestamp: 1 };
    const { container, rerender } = renderInRouter(
      <MessageList messages={[msg]} />,
    );
    const log = () => container.querySelector('[role="log"]');

    // Idle: absent, so completed turns announce immediately.
    expect(log()).not.toHaveAttribute("aria-busy");

    rerender(
      <MemoryRouter>
        <VoiceOutputProvider>
          <MessageList messages={[msg]} isStreaming />
        </VoiceOutputProvider>
      </MemoryRouter>,
    );
    expect(log()).toHaveAttribute("aria-busy", "true");
  });

  it("applies the live-region attributes at BOTH render sites", () => {
    // Count occurrences in source, not in a render: the Virtuoso branch cannot
    // be mounted reliably. Two sites = plain div + Virtuoso.
    for (const attr of LIVE_REGION_ATTRS) {
      const count = SOURCE.split(attr).length - 1;
      expect(count, `${attr} should appear twice, once per render path`).toBe(
        2,
      );
    }

    // aria-busy is bound to isStreaming at both sites, never hard-coded.
    expect(
      SOURCE.split("aria-busy={isStreaming || undefined}").length - 1,
    ).toBe(2);
  });
});
