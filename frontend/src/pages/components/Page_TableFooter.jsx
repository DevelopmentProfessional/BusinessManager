import React, { useRef, useEffect, useState } from "react";
import useViewMode from "../../services/useViewMode";

/**
 * PageTableFooter
 *
 * Props:
 *   searchTerm: string
 *   onSearch: (value: string) => void
 *   searchPlaceholder?: string
 *   beforeSearch?: ReactNode  — optional row rendered above the search input
 *   hideSearch?: boolean      — when true, the search input is not rendered
 *   addButton?: ReactNode     — optional button rendered to the left of search input
 *   children: Button_Toolbar buttons and filter dropdowns (rendered above search)
 *
 * On mobile the footer is position:fixed (floats above content like the nav "..." button).
 * A sibling spacer div reserves the same height in the flex flow so content doesn't
 * scroll all the way behind the footer.
 */
export default function PageTableFooter({ searchTerm, onSearch, searchPlaceholder = "Search...", beforeSearch, hideSearch, addButton, children }) {
  const { footerAlign } = useViewMode();
  const footerRef = useRef(null);
  // Start at 140 so the spacer reserves space before the first ResizeObserver tick
  const [footerHeight, setFooterHeight] = useState(140);

  useEffect(() => {
    const el = footerRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((entries) => {
      const h = entries[0]?.borderBoxSize?.[0]?.blockSize ?? entries[0]?.contentRect?.height ?? 0;
      setFooterHeight(Math.ceil(h));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const alignClass = footerAlign === "center" ? "justify-content-center" : footerAlign === "right" ? "justify-content-end" : "justify-content-start";
  return (
    <>
      {/* Spacer: on mobile the footer is position:absolute (out of flex flow), so this
          div reserves the equivalent height so content doesn't scroll behind the footer. */}
      <div className="app-footer-spacer" style={{ "--app-footer-h": `${footerHeight}px` }} aria-hidden="true" />
      <footer ref={footerRef} className="app-footer-shell app-footer-search flex-shrink-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 shadow-sm" style={{ zIndex: 10 }}>
        {/* Controls: optional top row + search + buttons */}
        <div className="app-footer-padding app-standard-footer bg-white dark:bg-gray-800">
          <div className="app-footer-stack">
            {beforeSearch && <div className={`search-hide-on-focus app-footer-toolbar d-flex align-items-center ${alignClass}`}>{beforeSearch}</div>}
            {/* Buttons row - now above search */}
            <div className={`search-hide-on-focus app-footer-toolbar d-flex align-items-center ${alignClass}`}>{children}</div>
            {/* Search row - Add button + search input */}
            {!hideSearch && (
              <div className="app-footer-search-row d-flex align-items-center gap-1 w-100">
                {addButton && <div>{addButton}</div>}
                <input type="text" placeholder={searchPlaceholder} value={searchTerm} onChange={(e) => onSearch(e.target.value)} className="app-search-input form-control w-100 rounded-pill" />
              </div>
            )}
          </div>
        </div>
      </footer>
    </>
  );
}
