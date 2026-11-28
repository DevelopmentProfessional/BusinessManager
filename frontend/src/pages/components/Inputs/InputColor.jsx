import React, { forwardRef } from "react";

const InputColor = forwardRef(function InputColor({ className = "", style, ...props }, ref) {
  return <input ref={ref} {...props} type="color" className={`app-input-color mb-0 ${className}`.trim()} style={style} />;
});

export default InputColor;
