import { useCallback, useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * Modal dialog with the keyboard behaviour `role="dialog" aria-modal="true"`
 * promises.
 *
 * The three hand-rolled overlays (PwaInstallPrompt's IosGuide and
 * DesktopInstallGuide, ServiceRestartOverlay) already declare themselves modal,
 * but none of them implement it: focus stays on the trigger behind the overlay,
 * Tab walks out into the page underneath, Escape does nothing, and closing does
 * not return focus. Assistive tech is told the rest of the page is inert while
 * the keyboard can still reach it.
 *
 * Scope is deliberately narrow — focus move on open, Tab trap, Escape, restore on
 * close. Layout and styling stay with the caller, so this replaces the shared
 * behaviour without dictating appearance.
 */

/** Elements that can receive focus, in DOM order. */
const FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

export interface AppDialogProps {
  /** Accessible name; required unless the dialog is labelled by its content. */
  "aria-label"?: string;
  "aria-labelledby"?: string;
  /** `alertdialog` for urgent interruptions (restart, destructive confirm). */
  role?: "dialog" | "alertdialog";
  /** When false, Escape and backdrop clicks do not dismiss (e.g. mid-restart). */
  dismissable?: boolean;
  /** Escape key or backdrop click. Omit for a non-dismissable dialog. */
  onClose?: () => void;
  /** Extra attributes for the overlay (className, style, aria-busy, …). */
  overlayProps?: React.HTMLAttributes<HTMLDivElement>;
  /** Class for the overlay element, appended to the default. */
  overlayClassName?: string;
  children: ReactNode;
}

export default function AppDialog({
  role = "dialog",
  dismissable = true,
  onClose,
  overlayProps,
  overlayClassName,
  children,
  ...aria
}: AppDialogProps) {
  const overlayRef = useRef<HTMLDivElement | null>(null);
  /** The element focused before we opened, so we can put focus back. */
  const restoreRef = useRef<HTMLElement | null>(null);

  const focusables = useCallback((): HTMLElement[] => {
    const root = overlayRef.current;
    if (!root) return [];
    // No visibility filter: offsetParent is always null in jsdom (and would
    // wrongly drop legitimately focusable controls there), so rely on the
    // disabled/type selectors above plus `hidden` to exclude inert nodes.
    return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
      (el) =>
        !el.hasAttribute("hidden") && el.getAttribute("aria-hidden") !== "true",
    );
  }, []);

  // Move focus in on open, and restore it on close.
  useEffect(() => {
    restoreRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    // Prefer the first focusable control; fall back to the overlay itself so
    // focus is never left behind on the trigger.
    const target = focusables()[0] ?? overlayRef.current;
    target?.focus();

    return () => {
      restoreRef.current?.focus?.();
    };
  }, [focusables]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape" && dismissable) {
      e.stopPropagation();
      onClose?.();
      return;
    }
    if (e.key !== "Tab") return;

    // Trap Tab within the dialog. Without this the browser moves focus to the
    // page behind the overlay, which aria-modal has already declared inert.
    const items = focusables();
    if (items.length === 0) {
      e.preventDefault();
      return;
    }
    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement;

    if (
      e.shiftKey &&
      (active === first || !overlayRef.current?.contains(active))
    ) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  };

  return createPortal(
    <div
      {...overlayProps}
      ref={overlayRef}
      role={role}
      aria-modal="true"
      {...aria}
      className={overlayClassName}
      onKeyDown={handleKeyDown}
      onClick={(e) => {
        overlayProps?.onClick?.(e);
        if (dismissable && e.target === e.currentTarget) onClose?.();
      }}
    >
      {children}
    </div>,
    document.body,
  );
}
