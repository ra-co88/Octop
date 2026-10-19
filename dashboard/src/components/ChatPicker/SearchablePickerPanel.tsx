import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Search } from "lucide-react";
import { useFilteredList } from "../../hooks/useFilteredList";
import styles from "./picker.module.less";

export type PickerPanelWidth = "wide" | "narrow" | "compact";

interface SearchablePickerPanelProps<T> {
  items: T[];
  filterFn: (item: T, query: string) => boolean;
  searchPlaceholder: string;
  emptyMessage: string;
  width?: PickerPanelWidth;
  renderItem: (item: T) => ReactNode;
  /** Optional grouping: consecutive items with the same key get a header. */
  getGroupKey?: (item: T) => string;
  renderGroupHeader?: (key: string, firstItem: T) => ReactNode;
  footerIcon: ReactNode;
  footerLabel: string;
  onFooterClick: () => void;
  /** Soften the footer (e.g. remote-bridge “edit on peer” hint). */
  footerMuted?: boolean;
  /** Optional row(s) rendered between the list and the primary footer. */
  beforeFooter?: ReactNode;
  /**
   * Names the search field and the option group. These panels are multi-select
   * toggles inside a popover, so their items are buttons with aria-pressed
   * rather than listbox options — the label is what tells a screen reader what
   * the set of toggles controls.
   */
  ariaLabel: string;
}

export default function SearchablePickerPanel<T>({
  items,
  filterFn,
  searchPlaceholder,
  emptyMessage,
  width = "wide",
  renderItem,
  getGroupKey,
  renderGroupHeader,
  footerIcon,
  footerLabel,
  onFooterClick,
  footerMuted = false,
  beforeFooter,
  ariaLabel,
}: SearchablePickerPanelProps<T>) {
  const { t } = useTranslation();
  const { query, setQuery, filtered } = useFilteredList(items, filterFn);
  const panelClass =
    width === "compact"
      ? styles.panelCompact
      : width === "narrow"
      ? styles.panelNarrow
      : styles.panelWide;

  return (
    <div className={panelClass} data-picker-panel="">
      <div className={styles.search} data-picker-search="">
        <input
          type="search"
          className={styles.searchInput}
          // The placeholder is not an accessible name: it disappears once the
          // user types, and some AT ignores it entirely.
          aria-label={ariaLabel}
          placeholder={searchPlaceholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <Search size={15} className={styles.searchIcon} aria-hidden />
      </div>

      {/* Filtering is visually obvious and was completely silent to assistive
          tech: the list can shrink to empty with no announcement. */}
      <div
        className={styles.searchStatus}
        role="status"
        aria-live="polite"
        data-picker-status=""
      >
        {t("chat.pickerResultCount", "{{count}} results", {
          count: filtered.length,
        })}
      </div>

      <div
        className={styles.list}
        data-picker-list=""
        role="group"
        aria-label={ariaLabel}
      >
        {filtered.length === 0 ? (
          <div className={styles.empty}>{emptyMessage}</div>
        ) : (
          filtered.map((item, index) => {
            const groupKey = getGroupKey?.(item) ?? "";
            const prevKey =
              index > 0 ? getGroupKey?.(filtered[index - 1]) ?? "" : null;
            const showHeader =
              Boolean(getGroupKey && renderGroupHeader) && groupKey !== prevKey;
            return (
              <div key={index}>
                {showHeader ? renderGroupHeader?.(groupKey, item) : null}
                {renderItem(item)}
              </div>
            );
          })
        )}
      </div>

      {beforeFooter}

      <button
        type="button"
        className={`${styles.footer} ${footerMuted ? styles.footerMuted : ""}`}
        data-picker-footer=""
        onClick={onFooterClick}
      >
        {footerIcon}
        <span>{footerLabel}</span>
      </button>
    </div>
  );
}

export { styles as pickerStyles };
