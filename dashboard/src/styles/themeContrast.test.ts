import { describe, expect, it } from "vitest";
import {
  ANTD_BRAND_TOKENS,
  DEFAULT_PALETTE,
  PALETTE_SWATCH,
  VALID_PALETTES,
} from "./themePalettes";

/**
 * A11Y-6 contrast gate.
 *
 * Rose used to be exempt from the contrast check — it was pinned to the
 * "historic Elegant Rose" (#E85D75 / #F08B9A) instead. That exemption meant the
 * DEFAULT palette shipped white text on a rose primary button at 3.36:1 in
 * light mode and 2.37:1 in dark, both under the 4.5:1 WCAG AA floor. The
 * palette is now #B04759 with darker hover/active states, and this file makes
 * the exemption impossible to reintroduce silently.
 *
 * Kept separate from themePalettes.test.ts so a regression here reads as
 * "contrast broke", not "palette values changed".
 */

function relativeLuminance(hex: string): number {
  const channels = [1, 3, 5].map((offset) => {
    const value = Number.parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrastRatio(foreground: string, background: string): number {
  const a = relativeLuminance(foreground);
  const b = relativeLuminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

const WHITE = "#FFFFFF";
/** WCAG 1.4.3 — normal-size text. */
const AA_TEXT = 4.5;

describe("brand contrast (WCAG 1.4.3)", () => {
  it.each(VALID_PALETTES)(
    "keeps %s primary buttons readable with white text in both modes",
    (palette) => {
      for (const mode of ["light", "dark"] as const) {
        const tokens = ANTD_BRAND_TOKENS[palette][mode];
        for (const state of [
          "colorPrimary",
          "colorPrimaryHover",
          "colorPrimaryActive",
        ] as const) {
          const color = tokens[state];
          expect(
            contrastRatio(color, WHITE),
            `${palette}.${mode}.${state} (${color}) on white`,
          ).toBeGreaterThanOrEqual(AA_TEXT);
        }
      }
    },
  );

  it("does not exempt the default palette from the gate", () => {
    // The specific regression this file exists to prevent: rose silently
    // rejoining the exempt list, or the default palette changing to one that
    // is not covered by the it.each above.
    expect(VALID_PALETTES).toContain(DEFAULT_PALETTE);
    for (const mode of ["light", "dark"] as const) {
      expect(
        contrastRatio(
          ANTD_BRAND_TOKENS[DEFAULT_PALETTE][mode].colorPrimary,
          WHITE,
        ),
      ).toBeGreaterThanOrEqual(AA_TEXT);
    }
  });

  it("documents why the swatch FILL carries no contrast requirement", () => {
    // Investigated while writing this gate, and the answer is "no requirement",
    // not "a requirement we are failing":
    //
    //  - The chips are `aria-hidden` decorative fills inside a 42x42 labelled,
    //    focusable button (PaletteSwitcher.tsx), so no text sits on them.
    //  - They are not distinguished by fill-vs-surface contrast alone: the
    //    button supplies position, an `aria-label` with the palette name, a
    //    hover background, and an active-state ring. The chip edge is a soft
    //    `inset 0 0 0 1px rgba(0,0,0,0.08)` hairline (~1.19:1 on white), which
    //    is decorative and pre-existing.
    //  - WCAG 1.4.11 applies to the *component*, and this component is the
    //    button, which is keyboard focusable with a visible focus ring.
    //
    // So a fill-vs-white assertion would be a false gate: it would fail emerald
    // (#10B981, 2.54:1) and amber (#F59E0B, 2.15:1) while telling us nothing
    // about whether a user can operate the picker. This test pins the reasoning
    // and the data, so the next person does not re-litigate it or "fix" the
    // values to satisfy a rule the design does not rely on.
    const measured = VALID_PALETTES.map((palette) => ({
      palette,
      ratio: contrastRatio(PALETTE_SWATCH[palette], WHITE),
    }));
    // Sanity: every palette still renders a real swatch...
    for (const { palette } of measured) {
      expect(PALETTE_SWATCH[palette], `swatch ${palette}`).toMatch(
        /^#[0-9A-Fa-f]{6}$/,
      );
    }
    // ...and this documents the actual spread we accepted.
    const lowest = measured.reduce((a, b) => (a.ratio < b.ratio ? a : b));
    expect(lowest.palette).toBe("amber");
    expect(lowest.ratio).toBeGreaterThan(2);
  });
});
