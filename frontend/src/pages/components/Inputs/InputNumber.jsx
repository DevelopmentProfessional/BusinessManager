import React from "react";
import FormControl from "../fields/FormControl";

export default function InputNumber({ className = "", ...props }) {
  return <FormControl type="number" className={`form-control ui-control-sm ${className}`.trim()} {...props} />;
}
