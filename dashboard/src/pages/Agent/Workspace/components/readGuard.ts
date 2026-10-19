/**
 * Latest-write-wins guard for async reads.
 *
 * A drawer that awaits a file read and then applies it unconditionally has no
 * way to tell a fresh response from a stale one. Click slow file A, then fast
 * file B: B renders, then A's response lands last and overwrites it. The user
 * sees the wrong file's contents under the right file's name.
 *
 * `runExclusive` does not help here — it *blocks* concurrent calls, which is
 * right for double-submit and wrong for reads. Reads should all proceed, and
 * only the newest one may apply.
 *
 * This is deliberately not a React hook: the caller holds the counter in a ref
 * so it survives re-renders, and keeping it a plain function makes the ordering
 * testable without mounting a 1500-line drawer.
 */

/** Minimal shape of a React `useRef` result — avoids importing React here. */
export interface MutableRef<T> {
  current: T;
}

/** A ticket issued by `beginRead`. */
export interface ReadTicket {
  /** Issues a ticket and marks it as the newest request. */
  begin: () => number;
  /** True only if `token` is still the newest ticket issued. */
  isCurrent: (token: number) => boolean;
}

/**
 * Create a guard whose `isCurrent` is true only for the most recent `begin`.
 *
 * ```ts
 * const guard = createReadGuard(seqRef);
 * const token = guard.begin();
 * const r = await request(...);
 * if (!guard.isCurrent(token)) return;   // a newer read superseded this one
 * setContent(r.content);
 * ```
 *
 * The counter only ever increases, so a token can never be revalidated by
 * wrapping around, and a caller that forgets to check simply keeps the old
 * (buggy) behaviour rather than introducing a new one.
 */
export function createReadGuard(ref: MutableRef<number>): ReadTicket {
  return {
    begin: () => {
      ref.current += 1;
      return ref.current;
    },
    isCurrent: (token: number) => ref.current === token,
  };
}
