import React, { forwardRef, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import FormControl from "../fields/FormControl";

const InputTextarea = forwardRef(function InputTextarea(
  {
    className = "",
    autoResize = true,
    resizable = true,
    onChange,
    onPointerDown,
    onPointerUp,
    onMouseDown,
    onMouseUp,
    onTouchStart,
    onTouchEnd,
    placeholder: _placeholder,
    ...props
  },
  ref
) {
  const textareaRef = useRef(null);
  const setTextareaRef = useCallback(
    (element) => {
      textareaRef.current = element;
      if (typeof ref === "function") ref(element);
      else if (ref) ref.current = element;
    },
    [ref]
  );

  const isProgrammaticResizeRef = useRef(false);
  const isDraggingRef = useRef(false);
  const userHeightRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);

  const resizeToContent = useCallback(
    (element) => {
      if (!autoResize || !element) return;
      if (isDraggingRef.current) return;

      isProgrammaticResizeRef.current = true;
      element.style.height = "auto";

      const computed = window.getComputedStyle(element);
      const borderOffset = (parseFloat(computed.borderTopWidth) || 0) + (parseFloat(computed.borderBottomWidth) || 0);
      const minHeight = parseFloat(computed.minHeight) || 0;
      const userHeight = userHeightRef.current || Number(element.dataset.userHeight) || 0;

      const scrollHeightWithBorder = element.scrollHeight + borderOffset;
      const targetHeight = Math.max(scrollHeightWithBorder, userHeight, minHeight);

      element.style.height = `${targetHeight}px`;
    },
    [autoResize]
  );

  useLayoutEffect(() => {
    resizeToContent(textareaRef.current);
  }, [resizeToContent, props.value, props.defaultValue, props.rows]);

  const handleChange = (event) => {
    onChange?.(event);
    resizeToContent(event.currentTarget);
  };

  const handleDragStart = useCallback((event) => {
    if (event.button !== 0 && event.pointerType === "mouse") return;
    event.preventDefault();
    event.stopPropagation();

    const element = textareaRef.current;
    if (!element) return;

    // Find nearest scrollable ancestor container (e.g. .app-modal-body or page scroll surface)
    let scrollParent = element.parentElement;
    while (scrollParent && scrollParent !== document.body) {
      const cs = window.getComputedStyle(scrollParent);
      if (cs.overflowY === "auto" || cs.overflowY === "scroll") {
        break;
      }
      scrollParent = scrollParent.parentElement;
    }
    if (!scrollParent || scrollParent === document.body) {
      scrollParent = null;
    }

    const startY = event.clientY;
    const startHeight = element.getBoundingClientRect().height;
    const startScrollTop = scrollParent ? scrollParent.scrollTop : 0;
    isDraggingRef.current = true;
    setIsDragging(true);

    const handleEl = event.currentTarget;
    try {
      handleEl.setPointerCapture?.(event.pointerId);
    } catch (_) {}

    const handlePointerMove = (moveEvent) => {
      if (!isDraggingRef.current) return;

      // Auto-scroll the scroll parent if dragging near its bottom or top edge
      if (scrollParent) {
        const parentRect = scrollParent.getBoundingClientRect();
        const distFromBottom = parentRect.bottom - moveEvent.clientY;
        if (distFromBottom < 60) {
          const scrollSpeed = Math.max(8, Math.round((60 - distFromBottom) * 0.4));
          scrollParent.scrollTop += scrollSpeed;
        } else if (moveEvent.clientY - parentRect.top < 40) {
          const scrollSpeed = Math.max(8, Math.round((40 - (moveEvent.clientY - parentRect.top)) * 0.4));
          scrollParent.scrollTop -= scrollSpeed;
        }
      }

      const currentScrollTop = scrollParent ? scrollParent.scrollTop : 0;
      const scrollDelta = currentScrollTop - startScrollTop;
      const deltaY = moveEvent.clientY - startY + scrollDelta;

      const computed = window.getComputedStyle(element);
      const minHeight = parseFloat(computed.minHeight) || 40;
      const newHeight = Math.max(minHeight, startHeight + deltaY);

      isProgrammaticResizeRef.current = true;
      element.style.height = `${newHeight}px`;
      const rounded = Math.round(newHeight);
      userHeightRef.current = rounded;
      element.dataset.userHeight = String(rounded);
    };

    const handlePointerEnd = (endEvent) => {
      isDraggingRef.current = false;
      setIsDragging(false);
      try {
        handleEl.releasePointerCapture?.(endEvent.pointerId);
      } catch (_) {}
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerEnd);
      window.removeEventListener("pointercancel", handlePointerEnd);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerEnd);
    window.addEventListener("pointercancel", handlePointerEnd);
  }, []);

  const handleWheel = (event) => {
    props.onWheel?.(event);
    const element = textareaRef.current;
    if (!element) return;

    // If the textarea has no internal scroll or reached its top/bottom scroll boundary,
    // seamlessly forward wheel scroll to the parent scrolling container (modal body / page)
    const isAtTop = element.scrollTop <= 0 && event.deltaY < 0;
    const isAtBottom = element.scrollTop + element.clientHeight >= element.scrollHeight - 1 && event.deltaY > 0;
    const hasNoScroll = element.scrollHeight <= element.clientHeight + 1;

    if (hasNoScroll || isAtTop || isAtBottom) {
      let scrollParent = element.parentElement;
      while (scrollParent && scrollParent !== document.body) {
        const cs = window.getComputedStyle(scrollParent);
        if (cs.overflowY === "auto" || cs.overflowY === "scroll") {
          scrollParent.scrollTop += event.deltaY;
          break;
        }
        scrollParent = scrollParent.parentElement;
      }
    }
  };

  return (
    <div className="app-textarea-wrapper position-relative w-100">
      <FormControl
        ref={setTextareaRef}
        {...props}
        as="textarea"
        onChange={handleChange}
        onWheel={handleWheel}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onMouseDown={onMouseDown}
        onMouseUp={onMouseUp}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        className={`form-control ui-control-sm ${className}`.trim()}
        style={{
          ...props.style,
          resize: "none",
        }}
      />
      {resizable && (
        <div
          role="separator"
          tabIndex={-1}
          aria-orientation="vertical"
          aria-label="Resize textarea"
          title="Drag to resize"
          className={`app-textarea-drag-handle ${isDragging ? "is-dragging" : ""}`}
          onPointerDown={handleDragStart}
        >
          <span className="app-textarea-drag-dot" />
        </div>
      )}
    </div>
  );
});

export default InputTextarea;
