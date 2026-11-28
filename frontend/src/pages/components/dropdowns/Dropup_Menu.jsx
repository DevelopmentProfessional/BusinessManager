import React, { useEffect, useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";
import { getViewportClampedMenuBounds, getViewportClampedMenuBottom } from "./menuPosition";

const SIDE_MARGIN = 12;
const MENU_GAP = 8;

function getMenuPosition(anchor, minWidth, maxWidth, maxHeight) {
  const viewport = window.visualViewport;
  const viewportTop = viewport?.offsetTop ?? 0;
  const bounds = getViewportClampedMenuBounds(anchor, { minWidth, maxWidth, sideMargin: SIDE_MARGIN });
  const availableHeight = Math.max(1, anchor.top - viewportTop - MENU_GAP - SIDE_MARGIN);

  return {
    position: "fixed",
    left: bounds.left,
    bottom: getViewportClampedMenuBottom(anchor.top, MENU_GAP),
    width: bounds.width,
    minWidth: bounds.width,
    maxWidth: bounds.maxWidth,
    maxHeight: Math.min(maxHeight, availableHeight),
    overflowY: "auto",
    boxSizing: "border-box",
  };
}

export default function Dropup_Menu({
  anchorRef,
  open,
  children,
  className = "",
  minWidth = 320,
  maxWidth = 352,
  maxHeight = 420,
}) {
  const [portalTarget, setPortalTarget] = useState(null);
  const [menuPosition, setMenuPosition] = useState(null);

  useEffect(() => {
    if (typeof document !== "undefined") {
      setPortalTarget(document.body);
    }
  }, []);

  useLayoutEffect(() => {
    if (!open || !anchorRef?.current) {
      setMenuPosition(null);
      return undefined;
    }

    const updateMenuPosition = () => {
      const anchor = anchorRef.current;
      if (!anchor) {
        setMenuPosition(null);
        return;
      }

      setMenuPosition(getMenuPosition(anchor.getBoundingClientRect(), minWidth, maxWidth, maxHeight));
    };

    const viewport = window.visualViewport;
    updateMenuPosition();
    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);
    viewport?.addEventListener("resize", updateMenuPosition);
    viewport?.addEventListener("scroll", updateMenuPosition);

    return () => {
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
      viewport?.removeEventListener("resize", updateMenuPosition);
      viewport?.removeEventListener("scroll", updateMenuPosition);
    };
  }, [anchorRef, maxHeight, maxWidth, minWidth, open]);

  if (!open || !portalTarget || !menuPosition) {
    return null;
  }

  return createPortal(
    <div
      className={`app-dropdown-portal-menu app-menu-panel ${className}`.trim()}
      style={menuPosition}
    >
      {children}
    </div>,
    portalTarget
  );
}
