import React, { forwardRef } from "react";
import FormControl from "../fields/FormControl";

const InputFile = forwardRef(function InputFile({ className = "", ...props }, ref) {
  return <FormControl ref={ref} {...props} type="file" className={`form-control ui-control-sm ${className}`.trim()} />;
});

export default InputFile;
