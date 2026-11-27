export function getViewportClampedMenuBounds(
  anchor,
  { minWidth = 176, maxWidth = Number.POSITIVE_INFINITY, sideMargin = 8 } = {}
) {
  const viewport = window.visualViewport;
  const viewportLeft = viewport?.offsetLeft ?? 0;
  const viewportWidth = viewport?.width ?? window.innerWidth;
  const availableWidth = Math.max(1, viewportWidth - sideMargin * 2);
  const width = Math.min(Math.max(anchor.width, minWidth), maxWidth, availableWidth);
  const maxLeft = viewportLeft + viewportWidth - width - sideMargin;

  return {
    left: Math.max(viewportLeft + sideMargin, Math.min(anchor.left, maxLeft)),
    width,
    maxWidth: availableWidth,
  };
}

export function getViewportClampedMenuVerticalPosition(
  anchor,
  { gap = 8, sideMargin = 8, maxHeight = 260, openUpward = true } = {}
) {
  const viewport = window.visualViewport;
  const viewportTop = viewport?.offsetTop ?? 0;
  const viewportBottom = viewportTop + (viewport?.height ?? window.innerHeight);
  const availableAbove = Math.max(0, anchor.top - viewportTop - gap - sideMargin);
  const availableBelow = Math.max(0, viewportBottom - anchor.bottom - gap - sideMargin);
  const shouldOpenUpward = openUpward && (availableAbove >= maxHeight || availableAbove >= availableBelow);
  const availableHeight = shouldOpenUpward ? availableAbove : availableBelow;

  return {
    top: shouldOpenUpward ? undefined : anchor.bottom + gap,
    bottom: shouldOpenUpward ? viewportBottom - anchor.top + gap : undefined,
    maxHeight: Math.max(1, Math.min(maxHeight, availableHeight)),
  };
}

export function getViewportClampedMenuBottom(anchorTop, gap = 8) {
  const viewport = window.visualViewport;
  const viewportTop = viewport?.offsetTop ?? 0;
  const viewportBottom = viewportTop + (viewport?.height ?? window.innerHeight);
  return viewportBottom - anchorTop + gap;
}
