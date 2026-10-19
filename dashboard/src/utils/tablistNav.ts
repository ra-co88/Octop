/**
 * Roving-focus keyboard handling for ARIA tablists.
 *
 * A `role="tablist"` with `role="tab"` children announces correctly to a screen
 * reader but is not navigable: the arrow keys are expected to move between tabs,
 * and without a handler they scroll the page instead. This was duplicated logic
 * in `AgentSelector`; extracted so other tablists (e.g. `ChromeTabBar`) share one
 * implementation rather than growing a second, subtly different copy.
 *
 * Kept a plain function rather than a hook so it can be unit-tested by passing a
 * synthetic event — the components that use it are large and awkward to mount.
 */

import type { KeyboardEvent } from "react";

const NAV_KEYS = [
  "ArrowRight",
  "ArrowLeft",
  "ArrowDown",
  "ArrowUp",
  "Home",
  "End",
] as const;

export interface TablistNavOptions {
  /**
   * Called with the newly focused tab. Omit for manual activation (focus moves,
   * selection waits for Enter/Space); pass it for automatic activation.
   */
  onActivate?: (tab: HTMLElement) => void;
  /** Restrict navigation to these keys. Defaults to all six. */
  keys?: readonly string[];
}

/**
 * Move roving focus within the tablist that owns `event`.
 *
 * Returns the newly focused element, or `null` when the event was not a
 * navigation key or the tablist had no tabs — so callers can tell a handled
 * event from an ignored one without duplicating the key check.
 *
 * Focus wraps at both ends, which is what users expect from a tab strip and
 * what `AgentSelector` already did.
 */
export function handleTablistNav(
  event: KeyboardEvent<HTMLElement>,
  options: TablistNavOptions = {},
): HTMLElement | null {
  const { onActivate, keys = NAV_KEYS } = options;
  if (!keys.includes(event.key)) return null;

  const tabs = Array.from(
    event.currentTarget.querySelectorAll<HTMLElement>('[role="tab"]'),
  );
  if (tabs.length === 0) return null;

  const current = tabs.indexOf(document.activeElement as HTMLElement);
  let next: number;
  switch (event.key) {
    case "Home":
      next = 0;
      break;
    case "End":
      next = tabs.length - 1;
      break;
    case "ArrowRight":
    case "ArrowDown":
      next = current < 0 ? 0 : (current + 1) % tabs.length;
      break;
    default:
      next = current <= 0 ? tabs.length - 1 : current - 1;
  }

  event.preventDefault();
  const target = tabs[next];
  target?.focus();
  if (target && onActivate) onActivate(target);
  return target ?? null;
}
