import React, { forwardRef } from "react";
import FormControl from "../fields/FormControl";

const InputTextarea = forwardRef(function InputTextarea({ className = "", ...props }, ref) {
  return <FormControl ref={ref} as="textarea" className={`form-control ui-control-sm ${className}`.trim()} {...props} />;
});

export default InputTextarea;
