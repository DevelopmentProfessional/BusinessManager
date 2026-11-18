import React, { forwardRef, useCallback, useLayoutEffect, useRef } from "react";
import FormControl from "../fields/FormControl";

const InputTextarea = forwardRef(function InputTextarea({ className = "", autoResize = true, onChange, onPointerDown, onPointerUp, onMouseDown, onMouseUp, onTouchStart, onTouchEnd, ...props }, ref) {
  const textareaRef = useRef(null);
  const setTextareaRef = useCallback((element) => {
    textareaRef.current = element;
    if (typeof ref === "function") ref(element);
    else if (ref) ref.current = element;
  }, [ref]);

  const resizeToContent = useCallback((element) => {
    if (!autoResize || !element) return;
    element.style.height = "auto";
    const userHeight = Number(element.dataset.userHeight) || 0;
    const height = Math.max(element.scrollHeight, userHeight);
    element.style.height = `${height}px`;
  }, [autoResize]);

  useLayoutEffect(() => {
    resizeToContent(textareaRef.current);
  }, [resizeToContent, props.value, props.defaultValue, props.rows]);

  const handleChange = (event) => {
    onChange?.(event);
    resizeToContent(event.currentTarget);
  };

  const recordStartHeight = () => {
    if (autoResize && textareaRef.current) {
      textareaRef.current.dataset.resizeStartHeight = String(textareaRef.current.getBoundingClientRect().height);
    }
  };

  const rememberUserHeight = () => {
    if (autoResize) {
      requestAnimationFrame(() => {
        const element = textareaRef.current;
        if (!element) return;
        const height = element.getBoundingClientRect().height;
        const startHeight = Number(element.dataset.resizeStartHeight);
        if (Number.isFinite(startHeight) && Math.abs(height - startHeight) > 1) {
          element.dataset.userHeight = String(height);
        }
        delete element.dataset.resizeStartHeight;
      });
    }
  };

  return (
    <FormControl
      ref={setTextareaRef}
      {...props}
      as="textarea"
      onChange={handleChange}
      onPointerDown={(event) => {
        onPointerDown?.(event);
        recordStartHeight(event);
      }}
      onPointerUp={(event) => {
        onPointerUp?.(event);
        rememberUserHeight(event);
      }}
      onMouseDown={(event) => {
        onMouseDown?.(event);
        recordStartHeight(event);
      }}
      onMouseUp={(event) => {
        onMouseUp?.(event);
        rememberUserHeight(event);
      }}
      onTouchStart={(event) => {
        onTouchStart?.(event);
        recordStartHeight(event);
      }}
      onTouchEnd={(event) => {
        onTouchEnd?.(event);
        rememberUserHeight(event);
      }}
      className={`form-control ui-control-sm ${className}`.trim()}
      style={{ ...props.style, ...(autoResize ? { resize: props.style?.resize || "vertical" } : {}) }}
    />
  );
});

export default InputTextarea;
