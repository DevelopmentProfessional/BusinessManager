import React from "react";
import FormControl from "../fields/FormControl";

export default function InputDate({ className = "", ...props }) {
  return <FormControl type="date" className={`form-control ui-control-sm ${className}`.trim()} {...props} />;
}
