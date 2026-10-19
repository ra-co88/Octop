import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * A11Y-6b regression guard.
 *
 * The agent state indicator used to be a bare coloured span whose three colours
 * were saturated green / amber / red. Measured under a deuteranopia simulation,
 * running vs failed separated by only 1.10:1 — visually identical — and the best
 * separation achievable by tuning hue alone was 1.57:1, well under the 3:1 WCAG
 * asks for non-text UI. Colour cannot carry this signal, so each state group now
 * gets a distinct SHAPE and colour is reinforcement only.
 *
 * Asserted against the stylesheet because that is where the contract lives, and
 * because jsdom does not apply Less. A mounted test could only read back the
 * data-state attribute it was handed, which would pass regardless of styling.
 */

const LESS = readFileSync(
  resolve(__dirname, "AgentSelector.module.less"),
  "utf8",
);
/** Isolate the .stateDot block so sibling rules cannot satisfy an assertion. */
const DOT = LESS.slice(
  LESS.indexOf(".stateDot {"),
  LESS.indexOf(".select {", LESS.indexOf(".stateDot {")),
);

const blockFor = (state: string) => {
  const i = DOT.indexOf(`[data-state="${state}"]`);
  if (i === -1) throw new Error(`no rule for data-state="${state}"`);
  const open = DOT.indexOf("{", i);
  return DOT.slice(DOT.lastIndexOf("&", i), DOT.indexOf("}", open) + 1);
};

describe("agent state indicator is not colour-only (A11Y-6b)", () => {
  it("gives failed a non-round shape", () => {
    // The square is the one unmistakable-in-greyscale signal.
    expect(blockFor("failed")).toMatch(/border-radius:\s*1px/);
    expect(blockFor("error")).toMatch(/border-radius:\s*1px/);
  });

  it("gives stopped a hollow ring rather than a filled disc", () => {
    const stopped = blockFor("stopped");
    expect(stopped).toMatch(/background:\s*transparent/);
    expect(stopped).toMatch(/border:/);
  });

  it("gives the transient states a shape distinct from both disc and ring", () => {
    for (const state of ["starting", "stopping"]) {
      const block = blockFor(state);
      expect(block).toMatch(/linear-gradient/);
      expect(block).toMatch(/border:/);
    }
  });

  it("keeps running a solid disc with no border", () => {
    const running = blockFor("running");
    expect(running).toMatch(/background:\s*#/);
    expect(running).not.toMatch(/border:/);
  });

  it("does not encode two states with only the same shape and same colour", () => {
    // running vs starting were both plain discs before; they must differ now.
    expect(blockFor("running")).not.toBe(blockFor("starting"));
  });

  it("uses colours that meet 3:1 against a white surface", () => {
    // WCAG 1.4.11 for non-text UI. The old #22c55e/#eab308 pair was 2.2:1/1.9:1.
    const relativeLuminance = (hex: string) => {
      const c = hex.replace("#", "");
      const [r, g, b] = [0, 2, 4]
        .map((i) => parseInt(c.slice(i, i + 2), 16) / 255)
        .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const againstWhite = (hex: string) =>
      1.05 / (relativeLuminance(hex) + 0.05);

    for (const state of ["running", "stopped", "failed", "starting"]) {
      const block = blockFor(state);
      const hex =
        block.match(/#[0-9a-fA-F]{6}/)?.[0] ??
        block.match(/background:\s*#([0-9a-fA-F]{6})/)?.[1];
      expect(hex, `no colour found for ${state}`).toBeTruthy();
      expect(
        againstWhite(`#${hex!.replace("#", "")}`),
        `${state} (${hex}) is below 3:1 on white`,
      ).toBeGreaterThanOrEqual(3);
    }
  });
});
