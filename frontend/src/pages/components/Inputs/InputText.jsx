import React from "react";
import FormControl from "../fields/FormControl";

export default function InputText({ className = "", ...props }) {
  return <FormControl {...props} type="text" className={`form-control ui-control-sm ${className}`.trim()} />;
}
