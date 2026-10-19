import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import en from "../locales/en.json";
import zh from "../locales/zh.json";

/**
 * A11Y-10 regression guard.
 *
 * Two separate gaps, both verified live before the fix:
 *  1. No skip link — a keyboard user had to Tab through the whole sidebar
 *     (~19 items plus group headers) to reach page content on every navigation.
 *  2. The sidebar was a plain <div>, so it exposed no navigation landmark and
 *     a screen reader user could not jump to or list the nav region.
 *
 * Asserted against source rather than by mounting. MainLayout pulls in the
 * entire route table, ServiceRestart/Backup providers and a lazily-loaded Chat
 * page; Sidebar reaches the preferences API. Mounting them in jsdom is slow and
 * brittle, and for a landmark/attribute contract source is the honest check.
 * (Same approach as MessageList's virtualised branch — see its test comment.)
 */

const MAIN_LAYOUT = readFileSync(
  resolve(__dirname, "MainLayout/index.tsx"),
  "utf8",
);
const SIDEBAR = readFileSync(resolve(__dirname, "Sidebar.tsx"), "utf8");

const count = (haystack: string, needle: string) =>
  haystack.split(needle).length - 1;

describe("skip link (A11Y-10)", () => {
  it("renders an anchor that targets the main content id", () => {
    const id = MAIN_LAYOUT.match(
      /export const MAIN_CONTENT_ID = "([^"]+)"/,
    )?.[1];
    expect(id).toBeTruthy();
    // The link points at it...
    expect(MAIN_LAYOUT).toContain("href={`#${MAIN_CONTENT_ID}`}");
    // ...and the <main> element carries it.
    expect(MAIN_LAYOUT).toContain("id={MAIN_CONTENT_ID}");
  });

  it("makes main focusable so focus actually moves", () => {
    // Without tabIndex={-1} the anchor would scroll but not move focus, and the
    // next Tab would resume from the skip link instead of the content.
    expect(MAIN_LAYOUT).toMatch(/tabIndex={-1}/);
    expect(MAIN_LAYOUT).toContain(".focus()");
  });

  it("is the first focusable element in the DOM", () => {
    // A skip link that appears after the sidebar is useless.
    const skipAt = MAIN_LAYOUT.indexOf("{skipLink}");
    const sidebarAt = MAIN_LAYOUT.indexOf("<Sidebar");
    expect(skipAt).toBeGreaterThan(-1);
    expect(sidebarAt).toBeGreaterThan(-1);
    expect(skipAt).toBeLessThan(sidebarAt);
  });

  it("is translated in both locales", () => {
    expect(en.nav.skipToContent).toBeTruthy();
    expect(zh.nav.skipToContent).toBeTruthy();
    // Not left as an untranslated copy of the English string.
    expect(zh.nav.skipToContent).not.toBe(en.nav.skipToContent);
  });
});

describe("sidebar navigation landmark (A11Y-10)", () => {
  it("wraps BOTH render paths in a labelled <nav>", () => {
    // Desktop and mobile are separate returns; missing one leaves that layout
    // without a landmark, which is easy to do and invisible in review.
    expect(count(SIDEBAR, "<nav")).toBe(2);
    expect(count(SIDEBAR, "</nav>")).toBe(2);
    expect(count(SIDEBAR, 'aria-label={t("nav.primaryNavigation"')).toBe(2);
  });

  it("does not disturb layout (display: contents)", () => {
    // The <nav> is a wrapper only; without this the sidebar's flex layout breaks.
    expect(count(SIDEBAR, 'style={{ display: "contents" }}')).toBe(2);
  });

  it("is translated in both locales", () => {
    expect(en.nav.primaryNavigation).toBeTruthy();
    expect(zh.nav.primaryNavigation).toBeTruthy();
    expect(zh.nav.primaryNavigation).not.toBe(en.nav.primaryNavigation);
  });
});
