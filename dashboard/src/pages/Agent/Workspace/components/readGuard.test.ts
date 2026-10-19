import { describe, expect, it } from "vitest";
import { createReadGuard, type MutableRef } from "./readGuard";

/**
 * RACE-1 regression guard.
 *
 * WorkspaceDrawer awaits a file read and then applies it unconditionally, so a
 * slow read for file A can land after a fast read for file B and overwrite the
 * viewer. The user then sees A's contents under B's name.
 *
 * These cases pin the ordering contract directly. The drawer is 1500 lines with
 * pdfjs at module scope (which throws DOMMatrix in jsdom), so drive the guard
 * rather than mounting it - the same reasoning behind extracting runExclusive.
 */

function ref(): MutableRef<number> {
  return { current: 0 };
}

describe("createReadGuard (RACE-1)", () => {
  it("treats the newest ticket as current", () => {
    const guard = createReadGuard(ref());
    const token = guard.begin();
    expect(guard.isCurrent(token)).toBe(true);
  });

  it("invalidates the earlier ticket when a newer one is taken", () => {
    // The core of the bug: B begins after A, so A must no longer apply.
    const guard = createReadGuard(ref());
    const slowA = guard.begin();
    const fastB = guard.begin();
    expect(guard.isCurrent(slowA)).toBe(false);
    expect(guard.isCurrent(fastB)).toBe(true);
  });

  it("keeps only the LAST of many concurrent reads current", () => {
    const guard = createReadGuard(ref());
    const tokens = [guard.begin(), guard.begin(), guard.begin()];
    expect(tokens.map((t) => guard.isCurrent(t))).toEqual([false, false, true]);
  });

  it("never revalidates an old token as new ones arrive", () => {
    const guard = createReadGuard(ref());
    const first = guard.begin();
    for (let i = 0; i < 5; i += 1) guard.begin();
    expect(guard.isCurrent(first)).toBe(false);
  });

  it("survives across separate guard instances sharing one ref", () => {
    // The drawer recreates the guard on every render, so the counter - not the
    // guard object - is what must carry the ordering.
    const counter = ref();
    const a = createReadGuard(counter).begin();
    const b = createReadGuard(counter).begin();
    expect(createReadGuard(counter).isCurrent(a)).toBe(false);
    expect(createReadGuard(counter).isCurrent(b)).toBe(true);
  });

  it("simulates the out-of-order landing the bug produces", async () => {
    // Direct model of the failure: A resolves after B.
    const guard = createReadGuard(ref());
    let viewer = "";

    const readA = (async () => {
      const token = guard.begin();
      await new Promise((r) => setTimeout(r, 30)); // slow
      if (!guard.isCurrent(token)) return; // the fix
      viewer = "A";
    })();

    const readB = (async () => {
      const token = guard.begin();
      await new Promise((r) => setTimeout(r, 5)); // fast
      if (!guard.isCurrent(token)) return;
      viewer = "B";
    })();

    await Promise.all([readA, readB]);
    // Without the guard this is "A" - the stale read wins and the viewer lies.
    expect(viewer).toBe("B");
  });
});
