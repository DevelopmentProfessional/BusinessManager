import React from "react";
import FormControl from "../fields/FormControl";

export default function InputText({ className = "", type = "text", ...props }) {
  return <FormControl {...props} type={type} className={`form-control ui-control-sm ${className}`.trim()} />;
}
