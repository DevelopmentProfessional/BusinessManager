// FILE: Badge_Status.jsx
// maps a status string to a Badge variant and renders it
import React from "react";
import Badge from "./Badge";
import { statusVariant } from "../../utils/colorMapping";

export default function Badge_Status({ status, pill = true }) {
  return <Badge variant={statusVariant(status)} pill={pill} label={status} />;
}
