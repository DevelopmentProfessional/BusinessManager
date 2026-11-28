import React from "react";
import { ArrowPathIcon } from "../../../icons";
import { runAppSync } from "../../../services/appSync";
import Button_Toolbar from "./Button_Toolbar";

export default function Button_AppRefresh() {
  return (
    <Button_Toolbar
      icon={ArrowPathIcon}
      label=""
      onClick={runAppSync}
      className="btn-outline-secondary"
      title="Reload application and load the latest updates"
    />
  );
}
