import React, { forwardRef, useCallback, useEffect, useLayoutEffect, useRef } from "react";
import FormControl from "../fields/FormControl";

const InputTextarea = forwardRef(function InputTextarea(
  {
    className = "",
    autoResize = true,
    onChange,
    onPointerDown,
    onPointerUp,
    onMouseDown,
    onMouseUp,
    onTouchStart,
    onTouchEnd,
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
  const isPointerDownRef = useRef(false);
  const userHeightRef = useRef(null);

  useEffect(() => {
    const handlePointerUp = () => {
      isPointerDownRef.current = false;
    };

    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("mouseup", handlePointerUp);
    window.addEventListener("touchend", handlePointerUp);
    window.addEventListener("touchcancel", handlePointerUp);

    return () => {
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("mouseup", handlePointerUp);
      window.removeEventListener("touchend", handlePointerUp);
      window.removeEventListener("touchcancel", handlePointerUp);
    };
  }, []);

  useEffect(() => {
    const element = textareaRef.current;
    if (!element || !autoResize) return;

    if (typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (isProgrammaticResizeRef.current) {
          isProgrammaticResizeRef.current = false;
          return;
        }

        if (isPointerDownRef.current) {
          const newHeight = entry.borderBoxSize?.[0]?.blockSize ?? entry.target.getBoundingClientRect().height;
          if (newHeight > 0) {
            const rounded = Math.round(newHeight);
            userHeightRef.current = rounded;
            entry.target.dataset.userHeight = String(rounded);
          }
        }
      }
    });

    observer.observe(element);
    return () => observer.disconnect();
  }, [autoResize]);

  const resizeToContent = useCallback(
    (element) => {
      if (!autoResize || !element) return;
      if (isPointerDownRef.current) return;

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

  const handlePointerDown = (event) => {
    isPointerDownRef.current = true;
    onPointerDown?.(event);
  };

  const handlePointerUp = (event) => {
    isPointerDownRef.current = false;
    onPointerUp?.(event);
  };

  const handleMouseDown = (event) => {
    isPointerDownRef.current = true;
    onMouseDown?.(event);
  };

  const handleMouseUp = (event) => {
    isPointerDownRef.current = false;
    onMouseUp?.(event);
  };

  const handleTouchStart = (event) => {
    isPointerDownRef.current = true;
    onTouchStart?.(event);
  };

  const handleTouchEnd = (event) => {
    isPointerDownRef.current = false;
    onTouchEnd?.(event);
  };

  return (
    <FormControl
      ref={setTextareaRef}
      {...props}
      as="textarea"
      onChange={handleChange}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      className={`form-control ui-control-sm ${className}`.trim()}
      style={{ ...props.style, ...(autoResize ? { resize: props.style?.resize || "vertical" } : {}) }}
    />
  );
});

export default InputTextarea;
