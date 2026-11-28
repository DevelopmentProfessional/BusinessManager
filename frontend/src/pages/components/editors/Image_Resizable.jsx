/**
 * Image_Resizable — Custom Tiptap image extension with:
 *   - Corner resize handle (drag to resize width)
 *   - Alignment toolbar (left / center / right) shown when selected
 *   - Rotate CW / CCW (90° increments)
 *   - Flip horizontal / vertical
 *   - ProseMirror drag-and-drop via data-drag-handle
 *
 * Replaces the stock @tiptap/extension-image in Editor_RichText.
 */
import React, { useRef, useCallback, useEffect, useState } from "react";
import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer, NodeViewWrapper } from "@tiptap/react";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Build a CSS transform string from rotation + flip flags */
function buildTransform(rotation, flipH, flipV) {
  const parts = [];
  if (rotation) parts.push(`rotate(${rotation}deg)`);
  if (flipH) parts.push("scaleX(-1)");
  if (flipV) parts.push("scaleY(-1)");
  return parts.join(" ") || "none";
}

/**
 * Parse a CSS transform string back to { rotation, flipH, flipV }.
 * Handles rotate(Ndeg), scaleX(-1), scaleY(-1).
 */
function parseTransform(transform) {
  if (!transform || transform === "none") return { rotation: 0, flipH: false, flipV: false };
  const rotMatch = transform.match(/rotate\((-?\d+)deg\)/);
  const rotation = rotMatch ? parseInt(rotMatch[1], 10) : 0;
  const flipH = /scaleX\(-1\)/.test(transform);
  const flipV = /scaleY\(-1\)/.test(transform);
  return { rotation, flipH, flipV };
}

// ─── Toolbar button style helpers ────────────────────────────────────────────

const tbBtn = (active = false) => ({
  background: active ? "#6366f1" : "transparent",
  border: "none",
  color: "#fff",
  fontSize: 13,
  padding: "2px 6px",
  borderRadius: 4,
  cursor: "pointer",
  lineHeight: 1,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  minWidth: 24,
});

const tbDivider = {
  width: 1,
  background: "#4b5563",
  margin: "0 3px",
  alignSelf: "stretch",
};

// ─── Node View ────────────────────────────────────────────────────────────────

function ResizableImageView({ node, updateAttributes, selected, deleteNode }) {
  const { src, alt, width, float: imgFloat, rotation, flipH, flipV, wrapMode = "through", x = 0, y = 0 } = node.attrs;
  const isThrough = wrapMode === "through";
  const [livePos, setLivePos] = useState({ x: x || 0, y: y || 0 });
  const [isPositioning, setIsPositioning] = useState(false);
  const imgRef = useRef(null);

  useEffect(() => {
    setLivePos({ x: node.attrs.x || 0, y: node.attrs.y || 0 });
  }, [node.attrs.x, node.attrs.y]);

  // ── Drag to position freely ("Through" layer mode) ───────────────────────────
  const startDrag = useCallback(
    (e) => {
      // Don't drag if clicking buttons, resize handle, or toolbar
      if (e.target.closest("button, .resize-handle, .image-toolbar")) return;
      e.preventDefault();
      e.stopPropagation();

      const startPointerX = e.touches ? e.touches[0].clientX : e.clientX;
      const startPointerY = e.touches ? e.touches[0].clientY : e.clientY;
      const startX = livePos.x || 0;
      const startY = livePos.y || 0;
      setIsPositioning(true);

      const onMove = (mv) => {
        const clientX = mv.touches ? mv.touches[0].clientX : mv.clientX;
        const clientY = mv.touches ? mv.touches[0].clientY : mv.clientY;
        const nextX = Math.round(startX + (clientX - startPointerX));
        const nextY = Math.round(startY + (clientY - startPointerY));
        setLivePos({ x: nextX, y: nextY });
      };

      const onUp = (up) => {
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
        window.removeEventListener("touchmove", onMove);
        window.removeEventListener("touchend", onUp);
        setIsPositioning(false);

        const endX = up.changedTouches ? up.changedTouches[0].clientX : up.clientX;
        const endY = up.changedTouches ? up.changedTouches[0].clientY : up.clientY;
        const finalX = Math.round(startX + (endX - startPointerX));
        const finalY = Math.round(startY + (endY - startPointerY));
        updateAttributes({ x: finalX, y: finalY });
      };

      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
      window.addEventListener("touchmove", onMove, { passive: false });
      window.addEventListener("touchend", onUp);
    },
    [livePos, updateAttributes]
  );

  // ── Resize (bottom-right corner drag — mouse + touch) ──────────────────────
  const startResize = useCallback(
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      const startX = e.touches ? e.touches[0].clientX : e.clientX;
      const startWidth = imgRef.current ? imgRef.current.offsetWidth : width || 200;

      const onMove = (mv) => {
        const cx = mv.touches ? mv.touches[0].clientX : mv.clientX;
        const newWidth = Math.max(40, startWidth + (cx - startX));
        updateAttributes({ width: Math.round(newWidth) });
      };
      const onUp = () => {
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
        window.removeEventListener("touchmove", onMove);
        window.removeEventListener("touchend", onUp);
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
      window.addEventListener("touchmove", onMove, { passive: false });
      window.addEventListener("touchend", onUp);
    },
    [width, updateAttributes]
  );

  // ── Mode & Alignment ───────────────────────────────────────────────────────
  const toggleWrapMode = useCallback(() => {
    const nextMode = isThrough ? "inline" : "through";
    updateAttributes({ wrapMode: nextMode });
  }, [isThrough, updateAttributes]);

  const resetPosition = useCallback(() => {
    setLivePos({ x: 0, y: 0 });
    updateAttributes({ x: 0, y: 0 });
  }, [updateAttributes]);

  // ── Rotate & Flip ──────────────────────────────────────────────────────────
  const rotateCW = useCallback(() => updateAttributes({ rotation: ((rotation || 0) + 90) % 360 }), [rotation, updateAttributes]);
  const rotateCCW = useCallback(() => updateAttributes({ rotation: ((rotation || 0) - 90 + 360) % 360 }), [rotation, updateAttributes]);
  const toggleFlipH = useCallback(() => updateAttributes({ flipH: !flipH }), [flipH, updateAttributes]);
  const toggleFlipV = useCallback(() => updateAttributes({ flipV: !flipV }), [flipV, updateAttributes]);

  // ── Styles ──────────────────────────────────────────────────────────────────
  const isRotated90 = rotation === 90 || rotation === 270;
  const displayWidth = width ? `${width}px` : "auto";
  const transform = buildTransform(rotation || 0, !!flipH, !!flipV);

  if (isThrough) {
    return (
      <NodeViewWrapper
        as="span"
        className="image-resizable-root image-through-layer"
        style={{
          display: "inline-block",
          position: "relative",
          width: 0,
          height: 0,
          margin: 0,
          padding: 0,
          lineHeight: 0,
          verticalAlign: "top",
          overflow: "visible",
          userSelect: "none",
        }}
      >
        <span
          className="image-through-inner"
          style={{
            display: "inline-block",
            position: "absolute",
            left: `${livePos.x}px`,
            top: `${livePos.y}px`,
            width: displayWidth,
            zIndex: selected ? 25 : 15,
            cursor: isPositioning ? "grabbing" : "grab",
            userSelect: "none",
            touchAction: "none",
          }}
          onMouseDown={startDrag}
          onTouchStart={startDrag}
        >
          {/* ── Toolbar (shown when node is selected) ── */}
          {selected && (
            <span
              contentEditable={false}
              className="image-toolbar"
              style={{
                position: "absolute",
                bottom: -38,
                left: "50%",
                transform: "translateX(-50%)",
                display: "flex",
                alignItems: "center",
                gap: 1,
                background: "#1f2937",
                borderRadius: 6,
                padding: "3px 5px",
                zIndex: 30,
                boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
                whiteSpace: "nowrap",
                userSelect: "none",
              }}
            >
              {/* Drag indicator */}
              <span style={{ color: "#38bdf8", fontSize: 11, paddingRight: 4, display: "flex", alignItems: "center", gap: 2 }}>
                <span>✋</span>
                <span>Through</span>
              </span>

              <div style={tbDivider} />

              {/* Mode toggle */}
              <button
                type="button"
                title="Switch to inline mode"
                onMouseDown={(e) => {
                  e.preventDefault();
                  toggleWrapMode();
                }}
                style={tbBtn(false)}
              >
                In-line
              </button>

              <div style={tbDivider} />

              {/* Rotate CCW */}
              <button
                type="button"
                title="Rotate 90° CCW"
                onMouseDown={(e) => {
                  e.preventDefault();
                  rotateCCW();
                }}
                style={tbBtn()}
              >
                ↺
              </button>

              {/* Rotate CW */}
              <button
                type="button"
                title="Rotate 90° CW"
                onMouseDown={(e) => {
                  e.preventDefault();
                  rotateCW();
                }}
                style={tbBtn()}
              >
                ↻
              </button>

              <div style={tbDivider} />

              {/* Flip H */}
              <button
                type="button"
                title="Flip horizontal"
                onMouseDown={(e) => {
                  e.preventDefault();
                  toggleFlipH();
                }}
                style={tbBtn(!!flipH)}
              >
                ↔
              </button>

              {/* Flip V */}
              <button
                type="button"
                title="Flip vertical"
                onMouseDown={(e) => {
                  e.preventDefault();
                  toggleFlipV();
                }}
                style={tbBtn(!!flipV)}
              >
                ↕
              </button>

              {(livePos.x !== 0 || livePos.y !== 0) && (
                <>
                  <div style={tbDivider} />
                  <button
                    type="button"
                    title="Reset position to origin"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      resetPosition();
                    }}
                    style={tbBtn()}
                  >
                    Reset
                  </button>
                </>
              )}

              <div style={tbDivider} />

              {/* Position / Size readout */}
              <span style={{ color: "#9ca3af", fontSize: 10, paddingLeft: 2, paddingRight: 2 }}>
                {width ? `${width}px` : "auto"} · ({livePos.x}, {livePos.y})
              </span>
            </span>
          )}

          {/* ── Delete button (top-left, shown when selected) ── */}
          {selected && (
            <button
              type="button"
              contentEditable={false}
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                deleteNode();
              }}
              title="Remove image"
              style={{
                position: "absolute",
                top: 4,
                left: 4,
                width: 20,
                height: 20,
                background: "#ef4444",
                border: "none",
                borderRadius: "50%",
                cursor: "pointer",
                zIndex: 25,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#fff",
                fontSize: 14,
                lineHeight: 1,
                padding: 0,
                userSelect: "none",
                boxShadow: "0 1px 4px rgba(0,0,0,0.4)",
              }}
            >
              ×
            </button>
          )}

          {/* ── The image ── */}
          <img
            ref={imgRef}
            src={src}
            alt={alt || ""}
            draggable={false}
            style={{
              display: "block",
              width: width ? `${width}px` : "auto",
              maxWidth: "none",
              height: "auto",
              borderRadius: 4,
              outline: selected ? "2px solid #6366f1" : "1px dashed rgba(99, 102, 241, 0.4)",
              transition: "outline 0.1s",
              cursor: isPositioning ? "grabbing" : "grab",
              transform,
              transformOrigin: "center center",
              pointerEvents: "auto",
            }}
          />

          {/* ── Resize handle (bottom-right corner, shown when selected) ── */}
          {selected && (
            <span
              contentEditable={false}
              className="resize-handle"
              onMouseDown={startResize}
              onTouchStart={startResize}
              title="Drag to resize"
              style={{
                position: "absolute",
                bottom: -2,
                right: -2,
                width: 18,
                height: 18,
                background: "#6366f1",
                borderRadius: "0 0 4px 0",
                cursor: "se-resize",
                zIndex: 25,
                userSelect: "none",
                boxShadow: "0 1px 4px rgba(0,0,0,0.35)",
              }}
            />
          )}
        </span>
      </NodeViewWrapper>
    );
  }

  // ── Inline mode fallback ───────────────────────────────────────────────────
  const isLeft = imgFloat === "left";
  const isRight = imgFloat === "right";
  const isCenter = !isLeft && !isRight;
  const justifyContent = isLeft ? "flex-start" : isRight ? "flex-end" : "center";
  const setAlignment = (align) => {
    if (align === "left") updateAttributes({ float: "left" });
    else if (align === "right") updateAttributes({ float: "right" });
    else updateAttributes({ float: "none" });
  };

  return (
    <NodeViewWrapper as="div" style={{ display: "flex", justifyContent, width: "100%", overflow: "visible" }}>
      <div style={{ display: "block", position: "relative", margin: "0.5rem 0", width: displayWidth, maxWidth: "100%", lineHeight: 0, verticalAlign: "top" }}>
        {selected && (
          <div
            contentEditable={false}
            className="image-toolbar"
            style={{
              position: "absolute",
              bottom: -38,
              left: "50%",
              transform: "translateX(-50%)",
              display: "flex",
              alignItems: "center",
              gap: 1,
              background: "#1f2937",
              borderRadius: 6,
              padding: "3px 5px",
              zIndex: 20,
              boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
              whiteSpace: "nowrap",
              userSelect: "none",
            }}
          >
            <button
              type="button"
              title="Switch to through (free layer) mode"
              onMouseDown={(e) => {
                e.preventDefault();
                toggleWrapMode();
              }}
              style={tbBtn(true)}
            >
              Through
            </button>
            <div style={tbDivider} />
            {[
              { label: "L", val: "left", title: "Align left", symbol: "◧" },
              { label: "C", val: "center", title: "Align center", symbol: "▣" },
              { label: "R", val: "right", title: "Align right", symbol: "◨" },
            ].map(({ label, val, title, symbol }) => (
              <button
                key={val}
                type="button"
                title={title}
                onMouseDown={(e) => {
                  e.preventDefault();
                  setAlignment(val);
                }}
                style={tbBtn(val === "left" ? isLeft : val === "right" ? isRight : isCenter)}
              >
                <span style={{ fontSize: 12 }}>{symbol}</span>
                <span style={{ fontSize: 10, marginLeft: 2 }}>{label}</span>
              </button>
            ))}
            <div style={tbDivider} />
            <button type="button" title="Rotate CCW" onMouseDown={(e) => { e.preventDefault(); rotateCCW(); }} style={tbBtn()}>↺</button>
            <button type="button" title="Rotate CW" onMouseDown={(e) => { e.preventDefault(); rotateCW(); }} style={tbBtn()}>↻</button>
            <div style={tbDivider} />
            <button type="button" title="Flip H" onMouseDown={(e) => { e.preventDefault(); toggleFlipH(); }} style={tbBtn(!!flipH)}>↔</button>
            <button type="button" title="Flip V" onMouseDown={(e) => { e.preventDefault(); toggleFlipV(); }} style={tbBtn(!!flipV)}>↕</button>
          </div>
        )}
        <img
          ref={imgRef}
          src={src}
          alt={alt || ""}
          draggable={false}
          style={{
            display: "block",
            width: width ? `${width}px` : "auto",
            maxWidth: "100%",
            height: "auto",
            borderRadius: 4,
            outline: selected ? "2px solid #6366f1" : "2px solid transparent",
            transform,
            transformOrigin: "center center",
          }}
        />
        {selected && (
          <div
            contentEditable={false}
            className="resize-handle"
            onMouseDown={startResize}
            onTouchStart={startResize}
            title="Drag to resize"
            style={{
              position: "absolute",
              bottom: -2,
              right: -2,
              width: 18,
              height: 18,
              background: "#6366f1",
              borderRadius: "0 0 4px 0",
              cursor: "se-resize",
              zIndex: 10,
              userSelect: "none",
            }}
          />
        )}
      </div>
    </NodeViewWrapper>
  );
}

// ─── Tiptap Extension ─────────────────────────────────────────────────────────

export const Image_Resizable = Node.create({
  name: "image",
  group: "inline",
  inline: true,
  atom: true,
  draggable: false,

  addCommands() {
    return {
      setImage:
        (options) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: {
              wrapMode: "through",
              x: 0,
              y: 0,
              width: 320,
              ...options,
            },
          });
        },
    };
  },

  addAttributes() {
    return {
      src: { default: null },
      alt: { default: null },
      title: { default: null },
      width: {
        default: 320,
        parseHTML: (el) => {
          const w = el.style.width || el.getAttribute("width");
          return w ? parseInt(w, 10) || null : null;
        },
        renderHTML: (attrs) => (attrs.width ? { style: `width:${attrs.width}px;` } : {}),
      },
      wrapMode: {
        default: "through",
        parseHTML: (el) => el.getAttribute("data-wrap") || "through",
        renderHTML: (attrs) => ({ "data-wrap": attrs.wrapMode || "through" }),
      },
      x: {
        default: 0,
        parseHTML: (el) => {
          const v = el.getAttribute("data-x");
          return v != null ? parseInt(v, 10) || 0 : 0;
        },
        renderHTML: (attrs) => ({ "data-x": attrs.x ?? 0 }),
      },
      y: {
        default: 0,
        parseHTML: (el) => {
          const v = el.getAttribute("data-y");
          return v != null ? parseInt(v, 10) || 0 : 0;
        },
        renderHTML: (attrs) => ({ "data-y": attrs.y ?? 0 }),
      },
      float: {
        default: "none",
        parseHTML: (el) => el.getAttribute("data-float") || el.style.float || "none",
        renderHTML: (attrs) => ({ "data-float": attrs.float || "none" }),
      },
      rotation: {
        default: 0,
        parseHTML: (el) => parseTransform(el.getAttribute("data-transform") || el.style.transform).rotation,
        renderHTML: (attrs) => (attrs.rotation ? { "data-rotation": attrs.rotation } : {}),
      },
      flipH: {
        default: false,
        parseHTML: (el) => parseTransform(el.getAttribute("data-transform") || el.style.transform).flipH,
        renderHTML: (attrs) => (attrs.flipH ? { "data-fliph": "1" } : {}),
      },
      flipV: {
        default: false,
        parseHTML: (el) => parseTransform(el.getAttribute("data-transform") || el.style.transform).flipV,
        renderHTML: (attrs) => (attrs.flipV ? { "data-flipv": "1" } : {}),
      },
    };
  },

  parseHTML() {
    return [
      { tag: "span[data-wrap='through'] img[src]" },
      { tag: "img[src]" },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const { width, float: floatAttr, rotation, flipH, flipV, wrapMode: wrapAttr, x: xAttr, y: yAttr, ...rest } = HTMLAttributes;
    const isThrough = (wrapAttr || HTMLAttributes["data-wrap"] || "through") === "through";
    const imageFloat = floatAttr || HTMLAttributes["data-float"] || "none";
    const posX = xAttr ?? (HTMLAttributes["data-x"] ? parseInt(HTMLAttributes["data-x"], 10) : 0);
    const posY = yAttr ?? (HTMLAttributes["data-y"] ? parseInt(HTMLAttributes["data-y"], 10) : 0);
    const transform = buildTransform(rotation || 0, !!flipH, !!flipV);

    if (isThrough) {
      let imgStyle = `position:absolute;left:${posX}px;top:${posY}px;z-index:10;max-width:none;height:auto;display:block;border-radius:4px;pointer-events:auto;`;
      if (width) imgStyle += `width:${width}px;`;
      if (transform !== "none") imgStyle += `transform:${transform};transform-origin:center center;`;
      return [
        "span",
        {
          class: "image-through-container",
          "data-wrap": "through",
          "data-x": posX,
          "data-y": posY,
          style: "display:inline-block;position:relative;width:0;height:0;line-height:0;margin:0;padding:0;overflow:visible;vertical-align:top;",
        },
        ["img", mergeAttributes(rest, { style: imgStyle })],
      ];
    }

    let style = "max-width:100%;height:auto;display:block;border-radius:4px;margin:0.5rem auto;";
    if (width) style += `width:${width}px;`;
    if (imageFloat === "left") style += "margin:0.5rem auto 0.5rem 0;";
    if (imageFloat === "right") style += "margin:0.5rem 0 0.5rem auto;";
    if (transform !== "none") style += `transform:${transform};transform-origin:center center;`;
    return ["img", mergeAttributes(rest, { style, "data-float": imageFloat, "data-wrap": "inline" })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(ResizableImageView);
  },
});

export default Image_Resizable;
