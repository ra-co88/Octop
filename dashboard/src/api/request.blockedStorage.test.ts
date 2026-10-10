import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * Some embedded webviews and private-mode browsers throw on *accessing*
 * window.localStorage, not just on calling a method on it. When that happens
 * every authenticated request used to throw before it was ever sent, so the
 * dashboard showed a blank error instead of asking for a login.
 */
describe("blocked web storage", () => {
  const originals: Array<[string, PropertyDescriptor]> = [];

  function block(name: "localStorage" | "sessionStorage") {
    const original = Object.getOwnPropertyDescriptor(window, name);
    if (original) originals.push([name, original]);
    Object.defineProperty(window, name, {
      configurable: true,
      get() {
        throw new DOMException("storage is blocked", "SecurityError");
      },
    });
  }

  afterEach(() => {
    for (const [name, descriptor] of originals) {
      Object.defineProperty(window, name, descriptor);
    }
    originals.length = 0;
    vi.resetModules();
  });

  it("reads an empty token instead of throwing when localStorage is blocked", async () => {
    block("localStorage");
    const mod = await import("./request");

    expect(() => mod.getAuthToken()).not.toThrow();
    expect(mod.getAuthToken()).toBe("");
  });

  it("still stores the token when localStorage is blocked", async () => {
    block("localStorage");
    const mod = await import("./request");

    expect(() => mod.setAuthToken("a-token")).not.toThrow();
  });

  it("reports a session-only login without consulting localStorage", async () => {
    const mod = await import("./request");
    mod.setAuthToken("session-token", false);

    // localStorage now throws; the answer must come from sessionStorage alone.
    block("localStorage");
    const reloaded = await import("./request");
    expect(reloaded.isSessionOnlyAuth()).toBe(true);
  });

  it("clears the token without throwing when both storages are blocked", async () => {
    block("localStorage");
    block("sessionStorage");
    const mod = await import("./request");

    expect(() => mod.clearAuthToken()).not.toThrow();
  });
});
