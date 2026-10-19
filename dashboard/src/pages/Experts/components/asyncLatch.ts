/**
 * Synchronous in-flight latch for async UI actions.
 *
 * ``disabled={saving}`` is render state: React cannot commit it until after the
 * handler returns, so a second click while an async pre-flight is still in
 * flight starts a second request. A `useRef` flips immediately, before any
 * `await`, which closes that window.
 *
 * `EditAgentDrawer` is the reason this exists: its save handler awaited form
 * validation and a root-dir probe before calling `setSaving(true)`, so a
 * double-click fired two PATCHes (commit 798a19ec, PR #14). Extracted so the
 * latch can be unit-tested without mounting the 1400-line drawer, whose mount
 * effects are impractical to drive in jsdom.
 */

/** Minimal shape of a React `useRef` result — avoids importing React here. */
export interface MutableRef<T> {
  current: T;
}

/**
 * Run `fn` unless a call is already in flight, and reset the latch afterwards.
 *
 * The caller owns the ref so the same latch survives re-renders. When a call is
 * skipped the returned promise resolves to `undefined`; when it runs, it
 * resolves to `fn`'s value. The latch is released in a `finally`, so a rejected
 * `fn` does not wedge the control.
 */
export async function runExclusive<T>(
  ref: MutableRef<boolean>,
  fn: () => Promise<T>,
): Promise<T | undefined> {
  if (ref.current) return undefined;
  ref.current = true;
  try {
    return await fn();
  } finally {
    ref.current = false;
  }
}
