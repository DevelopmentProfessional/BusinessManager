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
