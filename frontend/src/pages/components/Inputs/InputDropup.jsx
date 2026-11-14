import React from "react";
import Dropdown_Custom from "../dropdowns/Dropdown_Custom";

export default function InputDropup({ openUpward = true, ...props }) {
  return <Dropdown_Custom openUpward={openUpward} {...props} />;
}
