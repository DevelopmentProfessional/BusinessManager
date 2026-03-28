/**
 * ResizableImage — Custom Tiptap image extension with:
 *   - Corner resize handle (drag to resize width)
 *   - Alignment toolbar (left / center / right) shown when selected
 *   - Rotate CW / CCW (90° increments)
 *   - Flip horizontal / vertical
 *   - ProseMirror drag-and-drop via data-drag-handle
 *
 * Replaces the stock @tiptap/extension-image in RichTextEditor.
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

function ResizableImageView({ node, updateAttributes, selected, deleteNode, getPos, editor }) {
  const { src, alt, width, float: imgFloat, rotation, flipH, flipV } = node.attrs;
  const imgRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [activeDropZone, setActiveDropZone] = useState(null);
  const touchDragRef = useRef(null);

  // ── Resize (bottom-right corner drag — mouse + touch) ──────────────────────
  const startResize = useCallback(
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      const startX = e.touches ? e.touches[0].clientX : e.clientX;
      const startWidth = imgRef.current ? imgRef.current.offsetWidth : width || 200;

      const onMove = (mv) => {
        const x = mv.touches ? mv.touches[0].clientX : mv.clientX;
        const newWidth = Math.max(40, startWidth + (x - startX));
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

  // ── Alignment ──────────────────────────────────────────────────────────────
  const isLeft = imgFloat === "left";
  const isRight = imgFloat === "right";
  const isCenter = !isLeft && !isRight;
  const justifyContent = isLeft ? "flex-start" : isRight ? "flex-end" : "center";
  const setAlignment = useCallback(
    (align) => {
      if (align === "left") updateAttributes({ float: "left" });
      else if (align === "right") updateAttributes({ float: "right" });
      else updateAttributes({ float: "none" });
    },
    [updateAttributes]
  );

  const handleDragStart = useCallback(
    (event) => {
      if (!selected) return;
      setIsDragging(true);
      setActiveDropZone(null);
      if (event.dataTransfer) {
        event.dataTransfer.effectAllowed = "move";
        try {
          event.dataTransfer.setData("text/plain", "image-align");
        } catch {}
      }
    },
    [selected]
  );

  const handleDragEnd = useCallback(() => {
    if (activeDropZone) {
      setAlignment(activeDropZone);
    }
    setIsDragging(false);
    setActiveDropZone(null);
  }, [activeDropZone, setAlignment]);

  // ── Touch drag (mobile) ────────────────────────────────────────────────────
  const handleTouchStart = useCallback(
    (e) => {
      if (e.touches.length !== 1) return;
      e.stopPropagation();
      const touch = e.touches[0];
      touchDragRef.current = { startX: touch.clientX, startY: touch.clientY, active: false };

      const onMove = (mv) => {
        if (!touchDragRef.current || mv.touches.length !== 1) return;
        const t = mv.touches[0];
        const dx = t.clientX - touchDragRef.current.startX;
        const dy = t.clientY - touchDragRef.current.startY;
        if (!touchDragRef.current.active && Math.hypot(dx, dy) > 8) {
          touchDragRef.current.active = true;
        }
        if (touchDragRef.current.active) {
          mv.preventDefault();
          setIsDragging(true);
          const w = window.innerWidth || 1;
          const third = w / 3;
          setActiveDropZone(t.clientX < third ? "left" : t.clientX < third * 2 ? "center" : "right");
        }
      };

      const onEnd = (up) => {
        window.removeEventListener("touchmove", onMove);
        window.removeEventListener("touchend", onEnd);
        if (!touchDragRef.current?.active) {
          touchDragRef.current = null;
          return;
        }
        const t = up.changedTouches[0];
        const w = window.innerWidth || 1;
        const third = w / 3;
        const align = t.clientX < third ? "left" : t.clientX < third * 2 ? "center" : "right";
        setAlignment(align);
        // Reposition node in document at the touch drop point
        if (editor && typeof getPos === "function") {
          const docPos = editor.view.posAtCoords({ left: t.clientX, top: t.clientY });
          if (docPos) {
            const from = getPos();
            const { state, dispatch } = editor.view;
            const resolvedNode = state.doc.nodeAt(from);
            if (resolvedNode && from !== docPos.pos) {
              const adjustedTo = docPos.pos > from ? docPos.pos - resolvedNode.nodeSize : docPos.pos;
              const tr = state.tr;
              tr.delete(from, from + resolvedNode.nodeSize);
              tr.insert(adjustedTo, resolvedNode);
              dispatch(tr);
            }
          }
        }
        setIsDragging(false);
        setActiveDropZone(null);
        touchDragRef.current = null;
      };

      window.addEventListener("touchmove", onMove, { passive: false });
      window.addEventListener("touchend", onEnd);
    },
    [setAlignment, editor, getPos]
  );

  useEffect(() => {
    if (!isDragging) return undefined;

    const updateZoneFromPointer = (clientX) => {
      const width = window.innerWidth || 1;
      const third = width / 3;
      if (clientX < third) {
        setActiveDropZone("left");
      } else if (clientX < third * 2) {
        setActiveDropZone("center");
      } else {
        setActiveDropZone("right");
      }
    };

    const handleWindowDragOver = (event) => {
      updateZoneFromPointer(event.clientX);
    };

    const handleWindowDrop = (event) => {
      updateZoneFromPointer(event.clientX);
    };

    window.addEventListener("dragover", handleWindowDragOver);
    window.addEventListener("drop", handleWindowDrop);

    return () => {
      window.removeEventListener("dragover", handleWindowDragOver);
      window.removeEventListener("drop", handleWindowDrop);
    };
  }, [isDragging]);

  // ── Rotate ─────────────────────────────────────────────────────────────────
  const rotateCW = useCallback(() => updateAttributes({ rotation: ((rotation || 0) + 90) % 360 }), [rotation, updateAttributes]);
  const rotateCCW = useCallback(() => updateAttributes({ rotation: ((rotation || 0) - 90 + 360) % 360 }), [rotation, updateAttributes]);

  // ── Flip ───────────────────────────────────────────────────────────────────
  const toggleFlipH = useCallback(() => updateAttributes({ flipH: !flipH }), [flipH, updateAttributes]);
  const toggleFlipV = useCallback(() => updateAttributes({ flipV: !flipV }), [flipV, updateAttributes]);

  // ── Styles ──────────────────────────────────────────────────────────────────
  const isRotated90 = rotation === 90 || rotation === 270;
  const displayWidth = width ? `${width}px` : "auto";

  const wrapStyle = {
    display: "block",
    position: "relative",
    margin: "0.5rem 0",
    width: displayWidth,
    maxWidth: "100%",
    // When rotated 90/270, add vertical padding equal to half the width delta so the
    // image doesn't overflow its line box.
    paddingTop: isRotated90 ? `calc((${displayWidth} - 100%) / 2)` : 0,
    paddingBottom: isRotated90 ? `calc((${displayWidth} - 100%) / 2)` : 0,
    lineHeight: 0,
    verticalAlign: "top",
    overflow: isRotated90 ? "visible" : "hidden",
  };

  const outerStyle = {
    display: "flex",
    justifyContent,
    width: "100%",
    overflow: "visible",
  };

  const transform = buildTransform(rotation || 0, !!flipH, !!flipV);

  return (
    <NodeViewWrapper as="div" style={outerStyle}>
      {isDragging && (
        <div
          contentEditable={false}
          style={{
            position: "fixed",
            inset: 0,
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            zIndex: 999,
            pointerEvents: "none",
          }}
        >
          {[
            { key: "left", label: "Align Left" },
            { key: "center", label: "Align Center" },
            { key: "right", label: "Align Right" },
          ].map((zone) => {
            const isActive = activeDropZone === zone.key;
            return (
              <div
                key={zone.key}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: isActive ? "rgba(99, 102, 241, 0.28)" : "rgba(17, 24, 39, 0.12)",
                  borderLeft: zone.key !== "left" ? "1px solid rgba(255,255,255,0.35)" : "none",
                  borderRight: zone.key !== "right" ? "1px solid rgba(255,255,255,0.35)" : "none",
                  color: isActive ? "#312e81" : "#111827",
                  fontSize: 14,
                  fontWeight: 700,
                  letterSpacing: "0.02em",
                  transition: "background-color 0.12s ease, color 0.12s ease",
                }}
              >
                <span
                  style={{
                    background: "rgba(255,255,255,0.82)",
                    borderRadius: 999,
                    padding: "0.45rem 0.8rem",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
                  }}
                >
                  {zone.label}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* data-drag-handle lets ProseMirror treat the whole div as a draggable node */}
      <div style={wrapStyle} data-drag-handle draggable="true" onDragStart={handleDragStart} onDragEnd={handleDragEnd} onTouchStart={handleTouchStart}>
        {/* ── Toolbar (shown when node is selected) ── */}
        {selected && (
          <div
            contentEditable={false}
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
            {/* Alignment */}
            {[
              { label: "L", val: "left", title: "Align left", symbol: "◧" },
              { label: "C", val: "center", title: "Align center", symbol: "▣" },
              { label: "R", val: "right", title: "Align right", symbol: "◨" },
            ].map(({ label, val, title, symbol }) => (
              <button
                key={val}
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

            {/* Rotate CCW */}
            <button
              title="Rotate 90° counter-clockwise"
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
              title="Rotate 90° clockwise"
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
              title="Flip vertical"
              onMouseDown={(e) => {
                e.preventDefault();
                toggleFlipV();
              }}
              style={tbBtn(!!flipV)}
            >
              ↕
            </button>

            <div style={tbDivider} />

            {/* Width readout */}
            <span style={{ color: "#9ca3af", fontSize: 10, paddingLeft: 2, paddingRight: 2 }}>
              {width ? `${width}px` : "auto"}
              {rotation ? ` · ${rotation}°` : ""}
            </span>
          </div>
        )}

        {/* ── Delete button (top-left, shown when selected) ── */}
        {selected && (
          <button
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
              zIndex: 15,
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
            maxWidth: "100%",
            height: "auto",
            borderRadius: 4,
            outline: selected ? "2px solid #6366f1" : "2px solid transparent",
            transition: "outline 0.1s",
            cursor: "default",
            transform,
            transformOrigin: "center center",
          }}
        />

        {/* ── Resize handle (bottom-right corner, shown when selected) ── */}
        {selected && (
          <div
            contentEditable={false}
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
              boxShadow: "0 1px 4px rgba(0,0,0,0.35)",
            }}
          />
        )}
      </div>
    </NodeViewWrapper>
  );
}

// ─── Tiptap Extension ─────────────────────────────────────────────────────────

export const ResizableImage = Node.create({
  name: "image",
  group: "block",
  atom: true,
  draggable: true,

  addCommands() {
    return {
      setImage:
        (options) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: options,
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
        default: null,
        parseHTML: (el) => {
          const w = el.style.width || el.getAttribute("width");
          return w ? parseInt(w, 10) || null : null;
        },
        renderHTML: (attrs) => (attrs.width ? { style: `width:${attrs.width}px;` } : {}),
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
    return [{ tag: "img[src]" }];
  },

  renderHTML({ HTMLAttributes }) {
    const { width, float: floatAttr, rotation, flipH, flipV, ...rest } = HTMLAttributes;
    const imageFloat = floatAttr || HTMLAttributes["data-float"] || "none";
    let style = "max-width:100%;height:auto;display:block;border-radius:4px;margin:0.5rem auto;";
    if (width) style += `width:${width}px;`;
    if (imageFloat === "left") style += "margin:0.5rem auto 0.5rem 0;";
    if (imageFloat === "right") style += "margin:0.5rem 0 0.5rem auto;";
    const transform = buildTransform(rotation || 0, !!flipH, !!flipV);
    if (transform !== "none") style += `transform:${transform};transform-origin:center center;`;
    return ["img", mergeAttributes(rest, { style, "data-float": imageFloat })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(ResizableImageView);
  },
});

export default ResizableImage;
