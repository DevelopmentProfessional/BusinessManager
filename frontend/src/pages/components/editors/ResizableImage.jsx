/**
 * ResizableImage — Custom Tiptap image extension with:
 *   - Corner resize handle (drag to resize width)
 *   - Float toolbar (none / left / right) shown when selected
 *   - ProseMirror drag-and-drop via data-drag-handle
 *
 * Replaces the stock @tiptap/extension-image in RichTextEditor.
 */
import React, { useRef, useCallback } from 'react';
import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react';

// ─── Node View ────────────────────────────────────────────────────────────────

function ResizableImageView({ node, updateAttributes, selected }) {
  const { src, alt, width, float: imgFloat } = node.attrs;
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

  const setFloat = useCallback((f) => updateAttributes({ float: f }), [updateAttributes]);

  // ── Styles ──────────────────────────────────────────────────────────────────
  const wrapStyle = {
    display: 'inline-block',
    position: 'relative',
    float: (imgFloat === 'left' || imgFloat === 'right') ? imgFloat : 'none',
    margin: imgFloat === 'left'  ? '0.5rem 1.5rem 0.5rem 0'
          : imgFloat === 'right' ? '0.5rem 0 0.5rem 1.5rem'
          : '0.5rem 0',
    width: width ? `${width}px` : 'auto',
    maxWidth: '100%',
    lineHeight: 0,
    verticalAlign: 'top',
  };

  const outerStyle = {
    display: 'block',
    // Clear floats when center/none so the block takes its own line
    overflow: (imgFloat === 'left' || imgFloat === 'right') ? 'visible' : 'hidden',
  };

  return (
    <NodeViewWrapper as="div" style={outerStyle}>
      {/* data-drag-handle lets ProseMirror treat the whole div as a draggable node */}
      <div style={wrapStyle} data-drag-handle draggable="true">

        {/* ── Float toolbar (shown when node is selected) ── */}
        {selected && (
          <div
            contentEditable={false}
            style={{
              position: 'absolute',
              top: -34,
              left: 0,
              display: 'flex',
              alignItems: 'center',
              gap: 2,
              background: '#1f2937',
              borderRadius: 6,
              padding: '3px 6px',
              zIndex: 20,
              boxShadow: '0 2px 8px rgba(0,0,0,0.35)',
              whiteSpace: 'nowrap',
              userSelect: 'none',
            }}
          >
            {[
              { label: 'Block',  val: 'none',  symbol: '▪' },
              { label: 'Left',   val: 'left',  symbol: '◧' },
              { label: 'Right',  val: 'right', symbol: '◨' },
            ].map(({ label, val, symbol }) => (
              <button
                key={val}
                title={`Float ${label}`}
                onMouseDown={(e) => { e.preventDefault(); setFloat(val); }}
                style={{
                  background: imgFloat === val ? '#6366f1' : 'transparent',
                  border: 'none',
                  color: '#fff',
                  fontSize: 11,
                  padding: '1px 7px',
                  borderRadius: 4,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 3,
                }}
              >
                <span style={{ fontSize: 13 }}>{symbol}</span> {label}
              </button>
            ))}
            <div style={{ width: 1, background: '#4b5563', margin: '0 3px', alignSelf: 'stretch' }} />
            <span style={{ color: '#9ca3af', fontSize: 10, paddingRight: 2 }}>
              {width ? `${width}px` : 'auto'}
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
      src:   { default: null },
      alt:   { default: null },
      title: { default: null },
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
    };
  },

  parseHTML() {
    return [{ tag: 'img[src]' }];
  },

  renderHTML({ HTMLAttributes }) {
    const { width, float: f, ...rest } = HTMLAttributes;
    let style = 'max-width:100%;height:auto;display:block;border-radius:4px;';
    if (width) style += `width:${width}px;`;
    if (f === 'left')  style += 'float:left;margin:0.5rem 1.5rem 0.5rem 0;';
    if (f === 'right') style += 'float:right;margin:0.5rem 0 0.5rem 1.5rem;';
    return ['img', mergeAttributes(rest, { style })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(ResizableImageView);
  },
});

export default ResizableImage;
