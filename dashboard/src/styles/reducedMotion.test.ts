import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * A11Y-8 reduced-motion gate.
 *
 * Ten components opt out of animation individually, but nothing covered antd's
 * own transitions (drawers, modals, dropdowns) — those cannot be reached from a
 * component module. So the app-wide guard is asserted here.
 *
 * CSS is not executed by vitest, so this reads the stylesheet as text. That is
 * honest about what it is: a structural guard that the rule exists, is scoped to
 * the reduced-motion query, and stays blunt enough to win. It does not and
 * cannot prove browser behaviour.
 */

const CSS_PATH = resolve(__dirname, "layout.css");
const css = readFileSync(CSS_PATH, "utf8");

/** The block between the reduced-motion query and its closing brace. */
function reducedMotionBlock(): string {
  const start = css.indexOf("@media (prefers-reduced-motion: reduce)");
  // Thrown rather than asserted: if this is missing, the module-level `block`
  // below cannot be built, and vitest reports a bare "no tests" for a thrown
  // assertion here. A descriptive error reads as the real regression it is.
  if (start === -1) {
    throw new Error(
      "A11Y-8: layout.css has no @media (prefers-reduced-motion: reduce) block",
    );
  }
  const open = css.indexOf("{", start);
  let depth = 0;
  for (let i = open; i < css.length; i += 1) {
    if (css[i] === "{") depth += 1;
    else if (css[i] === "}") {
      depth -= 1;
      if (depth === 0) return css.slice(open, i + 1);
    }
  }
  throw new Error("unbalanced braces in layout.css");
}

const block = reducedMotionBlock();

describe("global reduced-motion guard (A11Y-8)", () => {
  it("exists in the app-wide stylesheet", () => {
    // layout.css is imported by App.tsx, so the rule reaches the whole app.
    expect(css).toContain("prefers-reduced-motion: reduce");
  });

  it("targets every element, not a list someone must maintain", () => {
    for (const selector of ["*", "*::before", "*::after"]) {
      expect(block).toContain(selector);
    }
  });

  it("collapses animations and transitions to near-zero", () => {
    // Near-zero rather than none: components that await an animationend event
    // would never settle if the animation were removed outright.
    expect(block).toMatch(/animation-duration:\s*0\.01ms/);
    expect(block).toMatch(/transition-duration:\s*0\.01ms/);
  });

  it("bounds iteration so a looping animation cannot spin forever", () => {
    expect(block).toMatch(/animation-iteration-count:\s*1/);
  });

  it("forces !important so it beats component-level rules", () => {
    // antd and the per-component rules set durations without !important, so the
    // catch-all only wins with it.
    const declarations = block.match(/[a-z-]+:\s*[^;]+;/g) ?? [];
    expect(declarations.length).toBeGreaterThan(0);
    for (const declaration of declarations) {
      expect(declaration).toContain("!important");
    }
  });
});
