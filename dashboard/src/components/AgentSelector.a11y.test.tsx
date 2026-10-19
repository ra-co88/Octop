import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { OctopAgent } from "../context/AgentContext";

/**
 * A11Y-9 regression guard.
 *
 * The agent picker showed a row of chips with no tablist semantics, so the
 * grouping was invisible to assistive tech and every chip was its own tab stop.
 */

const state = {
  agents: [] as OctopAgent[],
  activeAgentId: "writer" as string | null,
  loading: false,
};

const setActiveAgent = vi.fn((id: string | null) => {
  state.activeAgentId = id;
});

vi.mock("../context/AgentContext", () => ({
  useAgent: () => ({
    get agents() {
      return state.agents;
    },
    get activeAgentId() {
      return state.activeAgentId;
    },
    get loading() {
      return state.loading;
    },
    setActiveAgent,
  }),
}));

import AgentSelector from "./AgentSelector";

function fakeAgent(
  partial: Pick<OctopAgent, "agent_id" | "name"> & Partial<OctopAgent>,
): OctopAgent {
  return {
    id: 1,
    description: null,
    persona_mbti: null,
    default_model: null,
    system_prompt: null,
    template_name: null,
    state: "running",
    last_error: null,
    icon: null,
    icon_name: null,
    icon_url: null,
    color: "#2563eb",
    config: {},
    is_owner: true,
    kind: "expert",
    ...partial,
  };
}

const a = fakeAgent({ agent_id: "a", name: "Alpha" });
const b = fakeAgent({ agent_id: "b", name: "Beta" });
const c = fakeAgent({ agent_id: "c", name: "Gamma" });

function setup(activeId = "a") {
  state.agents = [a, b, c];
  state.activeAgentId = activeId;
  return render(<AgentSelector />);
}

describe("AgentSelector tablist (A11Y-9)", () => {
  beforeEach(() => {
    setActiveAgent.mockClear();
  });

  it("exposes the picker as a tablist of tabs", () => {
    setup();
    expect(screen.getByRole("tablist")).toBeInTheDocument();
    expect(screen.getAllByRole("tab")).toHaveLength(3);
  });

  it("marks exactly one tab selected", () => {
    setup("b");
    const selected = screen
      .getAllByRole("tab")
      .filter((el) => el.getAttribute("aria-selected") === "true");
    expect(selected).toHaveLength(1);
    expect(selected[0]).toHaveAccessibleName(/Beta/);
  });

  it("keeps only the selected tab in the tab order (roving tabindex)", () => {
    setup("b");
    const tabs = screen.getAllByRole("tab");
    const focusable = tabs.filter((el) => el.getAttribute("tabindex") === "0");
    expect(focusable).toHaveLength(1);
    expect(focusable[0]).toHaveAccessibleName(/Beta/);
  });

  it("moves selection with ArrowRight and wraps at the end", async () => {
    setup("a");
    const [alpha] = screen.getAllByRole("tab");
    alpha.focus();

    await userEvent.keyboard("{ArrowRight}");
    expect(setActiveAgent).toHaveBeenLastCalledWith("b");

    await userEvent.keyboard("{ArrowRight}");
    expect(setActiveAgent).toHaveBeenLastCalledWith("c");

    // Wrap: c -> a
    await userEvent.keyboard("{ArrowRight}");
    expect(setActiveAgent).toHaveBeenLastCalledWith("a");
  });

  it("supports Home and End", async () => {
    setup("b");
    const tabs = screen.getAllByRole("tab");
    tabs[1].focus();

    await userEvent.keyboard("{End}");
    expect(setActiveAgent).toHaveBeenLastCalledWith("c");

    await userEvent.keyboard("{Home}");
    expect(setActiveAgent).toHaveBeenLastCalledWith("a");
  });

  it("names each tab with its agent AND its state", () => {
    // The dot is colour-only, so the state must reach the accessible name.
    state.agents = [
      fakeAgent({ agent_id: "ok", name: "Healthy", state: "running" }),
      fakeAgent({ agent_id: "bad", name: "Broken", state: "failed" }),
    ];
    state.activeAgentId = "ok";
    render(<AgentSelector />);

    // The i18n mock in test/setup.ts resolves t(key, fallback) to the fallback,
    // so the state reads as the raw value here. The contract under test is that
    // the state is part of the name at all — without it the dot's colour is the
    // only signal, which is what a deuteranope cannot read.
    const running = screen.getByRole("tab", { name: /Healthy.*running/ });
    const failed = screen.getByRole("tab", { name: /Broken.*failed/ });
    expect(running).toBeInTheDocument();
    expect(failed).toBeInTheDocument();
    // And the two are distinguishable by name alone, not just by dot colour.
    expect(running.getAttribute("aria-label")).not.toBe(
      failed.getAttribute("aria-label"),
    );
  });

  it("hides the state dot from assistive tech (name carries it instead)", () => {
    setup();
    const tab = screen.getAllByRole("tab")[0];
    const dot = tab.querySelector("[data-state]");
    expect(dot).not.toBeNull();
    expect(dot).toHaveAttribute("aria-hidden");
  });
});
