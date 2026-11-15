import React, { forwardRef } from "react";
import FormControl from "../fields/FormControl";

const InputTextarea = forwardRef(function InputTextarea({ className = "", ...props }, ref) {
  return <FormControl ref={ref} {...props} as="textarea" className={`form-control ui-control-sm ${className}`.trim()} />;
});

export default InputTextarea;
