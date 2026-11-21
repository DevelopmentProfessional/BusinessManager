import React from "react";
import FormControl from "../fields/FormControl";

export default function InputDate({ className = "", ...props }) {
  return <FormControl {...props} type="date" className={`form-control ui-control-sm ${className}`.trim()} />;
}
