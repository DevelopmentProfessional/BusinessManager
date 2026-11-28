// FILE: Button_Toolbar.jsx
// re-exports Button_App for backward compatibility; use Button_App for new code
import React from "react";
import Button_App from "./Button_App";

export default function Button_Toolbar(props) {
  return <Button_App {...props} />;
}
