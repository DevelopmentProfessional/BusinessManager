import React, { forwardRef } from "react";

const InputColor = forwardRef(function InputColor({ className = "", ...props }, ref) {
  return <input ref={ref} type="color" className={`app-input-color ${className}`.trim()} {...props} />;
});

export default InputColor;
