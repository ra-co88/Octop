import { describe, expect, it, vi } from "vitest";
import { runExclusive, type MutableRef } from "./asyncLatch";

/**
 * Regression guard for the double-submit window described in `asyncLatch.ts`.
 *
 * The first case is the one that matters: it reproduces the original bug shape
 * (an `await` before any render-state guard commits) and asserts the latch
 * collapses two overlapping clicks into one call. The last case is a control
 * that proves the assertion is not vacuous.
 */
describe("runExclusive", () => {
  const latch = (): MutableRef<boolean> => ({ current: false });

  it("runs the wrapped call once when invoked twice before it settles", async () => {
    const ref = latch();
    let calls = 0;
    let release!: () => void;

    const fn = vi.fn(async () => {
      calls += 1;
      // Model the async pre-flight (validateFields + probeRootDir) that made
      // the render-state guard useless: we park until released.
      await new Promise<void>((resolve) => {
        release = resolve;
      });
      return "saved";
    });

    const first = runExclusive(ref, fn);
    // Second click in the same synchronous window, before the first settles.
    const second = runExclusive(ref, fn);

    expect(ref.current).toBe(true);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(await second).toBeUndefined();

    release();
    expect(await first).toBe("saved");
    expect(calls).toBe(1);
  });

  it("does NOT run the second call while the first is pending (control)", async () => {
    const ref = latch();
    const fn = vi.fn(async () => {
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
      return 1;
    });

    const p1 = runExclusive(ref, fn);
    const p2 = runExclusive(ref, fn);

    await Promise.all([p1, p2]);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("releases the latch after success so a later click works", async () => {
    const ref = latch();
    const fn = vi.fn(async () => "ok");

    expect(await runExclusive(ref, fn)).toBe("ok");
    expect(ref.current).toBe(false);
    expect(await runExclusive(ref, fn)).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("releases the latch when the wrapped call rejects", async () => {
    const ref = latch();
    const boom = vi.fn(async () => {
      throw new Error("network down");
    });

    await expect(runExclusive(ref, boom)).rejects.toThrow("network down");
    // A wedged latch would silently disable Save forever.
    expect(ref.current).toBe(false);
    expect(await runExclusive(ref, async () => "recovered")).toBe("recovered");
  });

  it("CONTROL: without the latch the second click does run twice", async () => {
    // Same shape as the first case, but calling the handler directly. This must
    // observe TWO calls; if it ever observes one, the suite above has stopped
    // proving anything about the latch.
    let calls = 0;
    const unguarded = async () => {
      calls += 1;
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
      return "saved";
    };

    await Promise.all([unguarded(), unguarded()]);
    expect(calls).toBe(2);
  });
});
