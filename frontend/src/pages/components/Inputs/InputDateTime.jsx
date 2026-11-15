import React from "react";
import FormControl from "../fields/FormControl";

export default function InputDateTime({ className = "", ...props }) {
  return <FormControl {...props} type="datetime-local" className={`form-control ui-control-sm ${className}`.trim()} />;
}
