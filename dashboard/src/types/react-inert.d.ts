/**
 * React 18's JSX types omit `inert`, which was only added in React 19 — but it
 * is standard HTML and jsdom (24+) implements it, so the attribute works at
 * runtime today.
 *
 * Declared here rather than cast at the call site: a cast would silently accept
 * any value, while this keeps the type honest (`inert` is boolean-ish: the
 * attribute is present or absent).
 */
import type {} from "react";

declare module "react" {
  // The generic must be redeclared to merge with React's interface; it is not
  // referenced here because `inert` does not depend on the element type.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface HTMLAttributes<T> {
    /** Present (or `true`) marks the subtree non-interactive and unfocusable. */
    inert?: "" | boolean | undefined;
  }
}
