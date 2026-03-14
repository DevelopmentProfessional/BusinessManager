/**
 * ResizableImage — Custom Tiptap image extension with:
 *   - Corner resize handle (drag to resize width)
 *   - Float toolbar (none / left / right) shown when selected
 *   - Rotate CW / CCW (90° increments)
 *   - Flip horizontal / vertical
 *   - ProseMirror drag-and-drop via data-drag-handle
 *
 * Replaces the stock @tiptap/extension-image in RichTextEditor.
 */
import React, { useRef, useCallback } from 'react';
import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Build a CSS transform string from rotation + flip flags */
function buildTransform(rotation, flipH, flipV) {
  const parts = [];
  if (rotation) parts.push(`rotate(${rotation}deg)`);
  if (flipH)    parts.push('scaleX(-1)');
  if (flipV)    parts.push('scaleY(-1)');
  return parts.join(' ') || 'none';
}

/**
 * Parse a CSS transform string back to { rotation, flipH, flipV }.
 * Handles rotate(Ndeg), scaleX(-1), scaleY(-1).
 */
function parseTransform(transform) {
  if (!transform || transform === 'none') return { rotation: 0, flipH: false, flipV: false };
  const rotMatch = transform.match(/rotate\((-?\d+)deg\)/);
  const rotation = rotMatch ? parseInt(rotMatch[1], 10) : 0;
  const flipH = /scaleX\(-1\)/.test(transform);
  const flipV = /scaleY\(-1\)/.test(transform);
  return { rotation, flipH, flipV };
}

// ─── Toolbar button style helpers ────────────────────────────────────────────

const tbBtn = (active = false) => ({
  background: active ? '#6366f1' : 'transparent',
  border: 'none',
  color: '#fff',
  fontSize: 13,
  padding: '2px 6px',
  borderRadius: 4,
  cursor: 'pointer',
  lineHeight: 1,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  minWidth: 24,
});

const tbDivider = {
  width: 1,
  background: '#4b5563',
  margin: '0 3px',
  alignSelf: 'stretch',
};

// ─── Node View ────────────────────────────────────────────────────────────────

function ResizableImageView({ node, updateAttributes, selected }) {
  const { src, alt, width, float: imgFloat, rotation, flipH, flipV } = node.attrs;
  const imgRef = useRef(null);

  // ── Resize (bottom-right corner drag) ──────────────────────────────────────
  const startResize = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startWidth = imgRef.current ? imgRef.current.offsetWidth : (width || 200);

    const onMove = (mv) => {
      const newWidth = Math.max(40, startWidth + (mv.clientX - startX));
      updateAttributes({ width: Math.round(newWidth) });
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [width, updateAttributes]);

  // ── Float ──────────────────────────────────────────────────────────────────
  const setFloat = useCallback((f) => updateAttributes({ float: f }), [updateAttributes]);

  // ── Rotate ─────────────────────────────────────────────────────────────────
  const rotateCW  = useCallback(() => updateAttributes({ rotation: ((rotation || 0) + 90)  % 360 }), [rotation, updateAttributes]);
  const rotateCCW = useCallback(() => updateAttributes({ rotation: ((rotation || 0) - 90 + 360) % 360 }), [rotation, updateAttributes]);

  // ── Flip ───────────────────────────────────────────────────────────────────
  const toggleFlipH = useCallback(() => updateAttributes({ flipH: !flipH }), [flipH, updateAttributes]);
  const toggleFlipV = useCallback(() => updateAttributes({ flipV: !flipV }), [flipV, updateAttributes]);

  // ── Styles ──────────────────────────────────────────────────────────────────
  const isRotated90 = rotation === 90 || rotation === 270;
  const displayWidth = width ? `${width}px` : 'auto';

  const wrapStyle = {
    display: 'inline-block',
    position: 'relative',
    float: (imgFloat === 'left' || imgFloat === 'right') ? imgFloat : 'none',
    margin: imgFloat === 'left'  ? '0.5rem 1.5rem 0.5rem 0'
          : imgFloat === 'right' ? '0.5rem 0 0.5rem 1.5rem'
          : '0.5rem auto',
    width: displayWidth,
    maxWidth: '100%',
    // When rotated 90/270, add vertical padding equal to half the width delta so the
    // image doesn't overflow its line box.
    paddingTop:    isRotated90 ? `calc((${displayWidth} - 100%) / 2)` : 0,
    paddingBottom: isRotated90 ? `calc((${displayWidth} - 100%) / 2)` : 0,
    lineHeight: 0,
    verticalAlign: 'top',
    overflow: isRotated90 ? 'visible' : 'hidden',
  };

  const outerStyle = {
    display: 'block',
    overflow: (imgFloat === 'left' || imgFloat === 'right') ? 'visible' : 'auto',
  };

  const transform = buildTransform(rotation || 0, !!flipH, !!flipV);

  return (
    <NodeViewWrapper as="div" style={outerStyle}>
      {/* data-drag-handle lets ProseMirror treat the whole div as a draggable node */}
      <div style={wrapStyle} data-drag-handle draggable="true">

        {/* ── Toolbar (shown when node is selected) ── */}
        {selected && (
          <div
            contentEditable={false}
            style={{
              position: 'absolute',
              top: -38,
              left: 0,
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              background: '#1f2937',
              borderRadius: 6,
              padding: '3px 5px',
              zIndex: 20,
              boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
              whiteSpace: 'nowrap',
              userSelect: 'none',
            }}
          >
            {/* Float */}
            {[
              { label: 'Block', val: 'none',  title: 'Block (no float)',  symbol: '▪' },
              { label: 'Left',  val: 'left',  title: 'Float left',        symbol: '◧' },
              { label: 'Right', val: 'right', title: 'Float right',       symbol: '◨' },
            ].map(({ label, val, title, symbol }) => (
              <button
                key={val}
                title={title}
                onMouseDown={(e) => { e.preventDefault(); setFloat(val); }}
                style={tbBtn(imgFloat === val)}
              >
                <span style={{ fontSize: 12 }}>{symbol}</span>
                <span style={{ fontSize: 10, marginLeft: 2 }}>{label}</span>
              </button>
            ))}

            <div style={tbDivider} />

            {/* Rotate CCW */}
            <button
              title="Rotate 90° counter-clockwise"
              onMouseDown={(e) => { e.preventDefault(); rotateCCW(); }}
              style={tbBtn()}
            >
              ↺
            </button>

            {/* Rotate CW */}
            <button
              title="Rotate 90° clockwise"
              onMouseDown={(e) => { e.preventDefault(); rotateCW(); }}
              style={tbBtn()}
            >
              ↻
            </button>

            <div style={tbDivider} />

            {/* Flip H */}
            <button
              title="Flip horizontal"
              onMouseDown={(e) => { e.preventDefault(); toggleFlipH(); }}
              style={tbBtn(!!flipH)}
            >
              ↔
            </button>

            {/* Flip V */}
            <button
              title="Flip vertical"
              onMouseDown={(e) => { e.preventDefault(); toggleFlipV(); }}
              style={tbBtn(!!flipV)}
            >
              ↕
            </button>

            <div style={tbDivider} />

            {/* Width readout */}
            <span style={{ color: '#9ca3af', fontSize: 10, paddingLeft: 2, paddingRight: 2 }}>
              {width ? `${width}px` : 'auto'}
              {rotation ? ` · ${rotation}°` : ''}
            </span>
          </div>
        )}

        {/* ── The image ── */}
        <img
          ref={imgRef}
          src={src}
          alt={alt || ''}
          draggable={false}
          style={{
            display: 'block',
            width: width ? `${width}px` : '100%',
            maxWidth: '100%',
            height: 'auto',
            borderRadius: 4,
            outline: selected ? '2px solid #6366f1' : '2px solid transparent',
            transition: 'outline 0.1s',
            cursor: 'default',
            transform,
            transformOrigin: 'center center',
          }}
        />

        {/* ── Resize handle (bottom-right corner, shown when selected) ── */}
        {selected && (
          <div
            contentEditable={false}
            onMouseDown={startResize}
            title="Drag to resize"
            style={{
              position: 'absolute',
              bottom: 0,
              right: 0,
              width: 14,
              height: 14,
              background: '#6366f1',
              borderRadius: '0 0 4px 0',
              cursor: 'se-resize',
              zIndex: 10,
              userSelect: 'none',
            }}
          />
        )}
      </div>
    </NodeViewWrapper>
  );
}

// ─── Tiptap Extension ─────────────────────────────────────────────────────────

export const ResizableImage = Node.create({
  name: 'image',
  group: 'block',
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      src:      { default: null },
      alt:      { default: null },
      title:    { default: null },
      width: {
        default: null,
        parseHTML: (el) => {
          const w = el.style.width || el.getAttribute('width');
          return w ? parseInt(w, 10) || null : null;
        },
        renderHTML: (attrs) => attrs.width ? { style: `width:${attrs.width}px;` } : {},
      },
      float: {
        default: 'none',
        parseHTML: (el) => el.getAttribute('data-float') || el.style.float || 'none',
        renderHTML: (attrs) => ({ 'data-float': attrs.float || 'none' }),
      },
      rotation: {
        default: 0,
        parseHTML: (el) => parseTransform(el.getAttribute('data-transform') || el.style.transform).rotation,
        renderHTML: (attrs) => attrs.rotation ? { 'data-rotation': attrs.rotation } : {},
      },
      flipH: {
        default: false,
        parseHTML: (el) => parseTransform(el.getAttribute('data-transform') || el.style.transform).flipH,
        renderHTML: (attrs) => attrs.flipH ? { 'data-fliph': '1' } : {},
      },
      flipV: {
        default: false,
        parseHTML: (el) => parseTransform(el.getAttribute('data-transform') || el.style.transform).flipV,
        renderHTML: (attrs) => attrs.flipV ? { 'data-flipv': '1' } : {},
      },
    };
  },

  parseHTML() {
    return [{ tag: 'img[src]' }];
  },

  renderHTML({ HTMLAttributes }) {
    const { width, float: f, rotation, flipH, flipV, ...rest } = HTMLAttributes;
    let style = 'max-width:100%;height:auto;display:block;border-radius:4px;';
    if (width) style += `width:${width}px;`;
    if (f === 'left')  style += 'float:left;margin:0.5rem 1.5rem 0.5rem 0;';
    if (f === 'right') style += 'float:right;margin:0.5rem 0 0.5rem 1.5rem;';
    const transform = buildTransform(rotation || 0, !!flipH, !!flipV);
    if (transform !== 'none') style += `transform:${transform};transform-origin:center center;`;
    return ['img', mergeAttributes(rest, { style })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(ResizableImageView);
  },
});

export default ResizableImage;
