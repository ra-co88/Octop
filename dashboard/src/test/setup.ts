/**
 * Vitest jsdom setup.
 *
 * Antd's components rely on a few browser APIs jsdom doesn't ship:
 *   - ``window.matchMedia`` (used by Grid responsive breakpoints)
 *   - ``ResizeObserver`` (used by Card/Drawer/Modal portals)
 *   - ``IntersectionObserver`` (used by virtual lists)
 *
 * Recharts also wants ``ResizeObserver`` for the ``ResponsiveContainer``;
 * it'll log a console error otherwise even though our snapshot tests
 * don't actually render the chart at a real size.
 */

import "@testing-library/jest-dom/vitest";
import { afterEach, beforeAll, vi } from "vitest";
import { cleanup } from "@testing-library/react";

// Auto-mock react-i18next so components' ``t(key, fallback)`` calls
// resolve synchronously to ``fallback`` without needing the real
// i18n module (which would async-fetch tool labels and add 1-2s of
// console noise per test file).
vi.mock("react-i18next", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-i18next")>();

  type TOptions = Record<string, unknown> & { defaultValue?: string };

  // Interpolate ``{{name}}`` placeholders like real i18next so tests can
  // assert user-visible copy such as "已捕获 42 条对话记忆".
  const interpolate = (template: string, options?: TOptions): string => {
    if (!options) return template;
    return template.replace(/\{\{(\w+)\}\}/g, (match, name: string) =>
      name in options ? String(options[name]) : match,
    );
  };

  return {
    ...actual,
    useTranslation: () => ({
      t: (
        key: string,
        fallback?: string | TOptions,
        options?: TOptions,
      ): string => {
        if (typeof fallback === "string") return interpolate(fallback, options);
        if (fallback && typeof fallback === "object") {
          const template = fallback.defaultValue ?? key;
          return interpolate(template, fallback);
        }
        return key;
      },
      i18n: { language: "zh", changeLanguage: () => Promise.resolve() },
    }),
    Trans: ({ children }: { children?: React.ReactNode }) => children,
  };
});

afterEach(() => {
  cleanup();
});

/**
 * Pre-warm the heaviest lazily-imported module.
 *
 * useChat's loadThreadHistory resolves ./useSessions through a dynamic
 * await import(...), so the first test that calls it pays the whole Vite
 * transform cost inside its own timed window. That transform measures
 * ~2.4 s on an idle machine and exceeds the 5 s default testTimeout when
 * the box is busy, which made useChat.history.test.ts fail as a unit under
 * load while passing in isolation.
 *
 * Importing it here moves that cost into setup, where no per-test timeout
 * applies. The module has no import-time side effects; it only defines
 * hooks and helpers.
 */
beforeAll(async () => {
  await import("../pages/Chat/hooks/useSessions");
});

if (typeof window !== "undefined") {
  // matchMedia
  if (!window.matchMedia) {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  }

  // ResizeObserver
  class _ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  if (!window.ResizeObserver) {
    (
      window as unknown as { ResizeObserver: typeof _ResizeObserver }
    ).ResizeObserver = _ResizeObserver;
  }

  // IntersectionObserver
  class _IntersectionObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
    root = null;
    rootMargin = "";
    thresholds = [];
  }
  if (!window.IntersectionObserver) {
    (
      window as unknown as {
        IntersectionObserver: typeof _IntersectionObserver;
      }
    ).IntersectionObserver = _IntersectionObserver;
  }

  // DOMMatrix — pdfjs-dist (via react-pdf) instantiates one at MODULE SCOPE:
  //   node_modules/pdfjs-dist/build/pdf.mjs:9387  const SCALE_MATRIX = new DOMMatrix();
  // jsdom does not ship DOMMatrix, so merely *importing* react-pdf throws
  // "ReferenceError: DOMMatrix is not defined" during collection. That is worse
  // than a failing assertion: vitest reports the whole FILE as failed with
  // "Tests: no tests", so the real tests never run.
  //
  // It reached far beyond the PDF components — a plain .ts test with no DOM
  // (pages/Agent/Skills/skillMarkdown.test.ts) broke because it imports a helper
  // from components/SkillDrawer, which renders react-pdf. Same for
  // AuthGuard.test.tsx and Settings/Models ModelListEditor.test.tsx.
  //
  // Minimal by design: the only module-scope constructor is the no-arg
  // `new DOMMatrix()`, and only `.a` and `.d` are read from it
  // (SCALE_MATRIX.a / SCALE_MATRIX.d, both identity === 1). A full transform
  // implementation would be untested scaffolding; tests that genuinely exercise
  // PDF rendering should stub what they need explicitly.
  class _DOMMatrix {
    a = 1;
    b = 0;
    c = 0;
    d = 1;
    e = 0;
    f = 0;
    constructor(init?: string | number[]) {
      if (Array.isArray(init) && init.length >= 6) {
        [this.a, this.b, this.c, this.d, this.e, this.f] = init;
      }
    }
  }
  if (!("DOMMatrix" in window)) {
    (window as unknown as { DOMMatrix: typeof _DOMMatrix }).DOMMatrix =
      _DOMMatrix;
    (globalThis as unknown as { DOMMatrix: typeof _DOMMatrix }).DOMMatrix =
      _DOMMatrix;
  }

  // jsdom doesn't implement ``getComputedStyle().transition`` properly,
  // so antd's wave / motion can throw — silence that one noisy console
  // warning without hiding real errors.
  const _origError = console.error.bind(console);
  console.error = (...args: unknown[]) => {
    const first = args[0];
    if (
      typeof first === "string" &&
      (first.includes(
        "Not implemented: HTMLFormElement.prototype.requestSubmit",
      ) ||
        first.includes("React does not recognize the") ||
        first.includes("antd: ") ||
        first.includes("[antd:"))
    ) {
      return;
    }
    _origError(...args);
  };
}
