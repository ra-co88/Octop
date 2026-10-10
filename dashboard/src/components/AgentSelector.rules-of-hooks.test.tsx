import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import AgentSelector from "./AgentSelector";

/**
 * Regression guard: AgentSelector must not change hook count across renders.
 *
 * The shell mounts this component while AgentContext is still loading, and
 * `loading` starts true, so the first render returns a spinner from an early
 * return that sits above every hook in the picker. When agents arrive the
 * same instance renders the full bar. Any hook declared after those early
 * returns therefore runs on the second render only, and React throws
 * "Rendered more hooks than during the previous render" the moment agents
 * load - the shell crashes rather than the picker failing softly.
 *
 * Upstream hoisted the hooks above the early returns (95860cc4, "show teams in
 * the memory and channels agent picker", #1588). This test exists so a later
 * refactor cannot quietly reintroduce the ordering bug.
 */
const state = vi.hoisted(() => ({
  current: {
    agents: [] as unknown[],
    activeAgentId: null as string | null,
    setActiveAgent: () => {},
    loading: true,
  },
}));

vi.mock("../context/AgentContext", () => ({ useAgent: () => state.current }));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (_k: string, d?: string) => d ?? _k }),
}));

const agent = (id: string, name: string) => ({
  agent_id: id,
  name,
  state: "idle",
});

describe("AgentSelector rules of hooks", () => {
  it("keeps hook order stable when loading flips to false", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    state.current = {
      agents: [],
      activeAgentId: null,
      setActiveAgent: () => {},
      loading: true,
    };
    const view = render(<AgentSelector variant="bar" />);

    state.current = {
      agents: [agent("a1", "Alpha")],
      activeAgentId: "a1",
      setActiveAgent: () => {},
      loading: false,
    };
    view.rerender(<AgentSelector variant="bar" />);

    const logged = spy.mock.calls.map((c) => String(c[0])).join("\n");
    spy.mockRestore();

    expect(logged).not.toMatch(/Rendered (more|fewer) hooks/);
  });

  it("keeps hook order stable when the picker empties", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    state.current = {
      agents: [agent("a1", "Alpha")],
      activeAgentId: "a1",
      setActiveAgent: () => {},
      loading: false,
    };
    const view = render(<AgentSelector variant="bar" />);

    state.current = {
      agents: [],
      activeAgentId: null,
      setActiveAgent: () => {},
      loading: false,
    };
    view.rerender(<AgentSelector variant="bar" />);

    const logged = spy.mock.calls.map((c) => String(c[0])).join("\n");
    spy.mockRestore();

    expect(logged).not.toMatch(/Rendered (more|fewer) hooks/);
  });
});
