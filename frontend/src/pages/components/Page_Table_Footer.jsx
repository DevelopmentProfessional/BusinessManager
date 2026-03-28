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
 *   children: Button_Toolbar buttons and filter dropdowns (rendered below search)
 *
 * On mobile the footer is position:fixed (floats above content like the nav "..." button).
 * A sibling spacer div reserves the same height in the flex flow so content doesn't
 * scroll all the way behind the footer.
 */
export default function PageTableFooter({ searchTerm, onSearch, searchPlaceholder = "Search...", beforeSearch, hideSearch, children }) {
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
      <div ref={footerRef} className="app-footer-search flex-shrink-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 shadow-sm" style={{ zIndex: 10 }}>
        {/* Controls: optional top row + search + buttons */}
        <div className="p-3 pt-2 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
          <div className="row g-0">
            <div className="col-10">
              {beforeSearch && <div className={`search-hide-on-focus d-flex align-items-center gap-1 mb-2 ${alignClass}`}>{beforeSearch}</div>}
              {!hideSearch && (
                <div className="position-relative w-100 mb-2">
                  <span className="position-absolute top-50 start-0 translate-middle-y ps-2 text-muted" style={{ pointerEvents: "none" }}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                      <path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001q.044.06.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1 1 0 0 0-.115-.1zM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0" />
                    </svg>
                  </span>
                  <input type="text" placeholder={searchPlaceholder} value={searchTerm} onChange={(e) => onSearch(e.target.value)} className="app-search-input form-control ps-5 w-100 rounded-pill" />
                </div>
              )}
              <div className={`search-hide-on-focus d-flex align-items-center gap-1 pb-2 flex-wrap ${alignClass}`} style={{ minHeight: "3rem" }}>
                {children}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
