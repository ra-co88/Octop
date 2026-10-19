/**
 * Mapping from a nav section key to its localized page-title key.
 *
 * `document.title` used to be set once, from the app name, and never updated —
 * so every browser tab, bookmark, and history entry read identically regardless
 * of the section, and a screen-reader user navigating by tab title had no way to
 * tell pages apart. These are the SAME labels the sidebar uses, so the tab title
 * and the visible nav entry can never disagree.
 *
 * Keys come from `resolveSelectedKey()` in `dashboard/src/routes`, which already
 * maps every route path to one of `SIDEBAR_NAV_KEYS`.
 */
const SECTION_LABEL_KEYS: Record<string, string> = {
  chat: "nav.chat",
  experts: "nav.experts",
  tasks: "nav.tasks",
  "token-usage": "nav.tokenUsage",
  personalization: "nav.personalization",
  channels: "nav.channels",
  connectors: "nav.connectors",
  "skill-packages": "nav.skillPackages",
  "knowledge-bases": "nav.knowledgeBases",
  bridge: "nav.bridge",
  workbench: "nav.workbench",
  "remote-desktop": "nav.remoteDesktop",
  acp: "nav.acp",
  "admin-users": "nav.adminUsers",
  models: "nav.models",
  "admin-storage": "nav.adminStorage",
  "admin-plugins": "nav.adminPlugins",
  "admin-security": "nav.security",
  "admin-advanced": "nav.adminAdvanced",
  "agent-config": "nav.agentConfig",
};

/**
 * Build the document title for a section.
 *
 * Returns the bare app name when the key is unknown, so an unmapped or new
 * route degrades to today's behaviour rather than showing a raw key.
 */
export function pageTitleFor(
  appName: string,
  sectionKey: string,
  translate: (key: string) => string,
): string {
  const labelKey = SECTION_LABEL_KEYS[sectionKey];
  if (!labelKey) return appName;
  const section = translate(labelKey);
  // If a label is missing the translator may return the key itself; showing
  // "nav.chat - Octop" is worse than showing nothing, so fall back.
  if (!section || section === labelKey) return appName;
  return `${section} - ${appName}`;
}

/** Exposed for the test that keeps this in sync with the sidebar. */
export const SECTION_KEYS_WITH_TITLES = Object.keys(SECTION_LABEL_KEYS);
