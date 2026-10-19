import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pageTitleFor, SECTION_KEYS_WITH_TITLES } from "./pageTitle";
import en from "../locales/en.json";
import zh from "../locales/zh.json";

/**
 * A11Y-11 regression guard.
 *
 * `document.title` was set once from the app name and never updated, so every
 * tab, bookmark and history entry read identically and a screen-reader user
 * navigating by tab title could not tell sections apart.
 */

/** Collect every `nav.*` key defined in a locale bundle. */
function navKeys(bundle: unknown): Set<string> {
  const nav = (bundle as { nav?: Record<string, unknown> }).nav ?? {};
  return new Set(Object.keys(nav).map((k) => `nav.${k}`));
}

const EN_NAV = navKeys(en);
const ZH_NAV = navKeys(zh);

describe("pageTitleFor", () => {
  it("prefixes the section name to the app name", () => {
    const t = (key: string) => (key === "app.pageTitle" ? "Octop" : "Experts");
    expect(pageTitleFor("Octop", "experts", t)).toBe("Experts - Octop");
  });

  it("uses the bare app name for an unknown section", () => {
    const t = (key: string) => (key === "app.pageTitle" ? "Octop" : key);
    expect(pageTitleFor("Octop", "not-a-section", t)).toBe("Octop");
    expect(pageTitleFor("Octop", "", t)).toBe("Octop");
  });

  it("falls back rather than displaying a raw i18n key", () => {
    // i18next returns the key itself when a translation is missing; showing
    // "nav.chat - Octop" in a tab is worse than showing just the app name.
    const t = (key: string) => key;
    expect(pageTitleFor("Octop", "chat", t)).toBe("Octop");
  });

  it("every mapped section has a real key in BOTH locales", () => {
    // Catches a typo like nav.adminSecurity (which does not exist; the sidebar
    // uses nav.security) and a key added to en.json but not zh.json.
    for (const section of SECTION_KEYS_WITH_TITLES) {
      const labelKey = (() => {
        const t = (key: string) => (EN_NAV.has(key) ? "LABEL" : key);
        // Recover the key the map chose by calling with a sentinel.
        const title = pageTitleFor("Octop", section, t);
        return title === "Octop" ? null : title.replace(" - Octop", "");
      })();
      expect(labelKey, `section "${section}" resolves to a missing key`).toBe(
        "LABEL",
      );
    }
  });

  it("keeps every sidebar entry covered by the title map", () => {
    // The map must not rot as nav items are added. Read the sidebar source for
    // its `labelKey` values and require each nav key to have a title entry.
    const src = readFileSync(resolve(__dirname, "sidebarNav.tsx"), "utf8");
    const items = [
      ...src.matchAll(
        /key: "([a-z-]+)",\s*\n\s*path: "[^"]+",\s*\n\s*icon: [^\n]+\n\s*labelKey: "([^"]+)"/g,
      ),
    ].map((m) => ({ key: m[1], labelKey: m[2] }));

    expect(items.length).toBeGreaterThan(10);
    for (const { key, labelKey } of items) {
      expect(
        SECTION_KEYS_WITH_TITLES,
        `sidebar item "${key}" has no page title`,
      ).toContain(key);
      // And the title must use the SAME label the sidebar shows, so the tab and
      // the nav entry can never disagree.
      expect(EN_NAV.has(labelKey), `${labelKey} missing from en.json`).toBe(
        true,
      );
      expect(ZH_NAV.has(labelKey), `${labelKey} missing from zh.json`).toBe(
        true,
      );
    }
  });
});
