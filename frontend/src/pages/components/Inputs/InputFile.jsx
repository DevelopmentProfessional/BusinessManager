import React, { forwardRef, useId, useState } from "react";
import { ArrowUpTrayIcon } from "../../../icons";

const InputFile = forwardRef(function InputFile({ className = "", id, onChange, style, title = "Upload file", ...props }, ref) {
  const generatedId = useId();
  const inputId = id || generatedId;
  const [fileName, setFileName] = useState("");

  const handleChange = (event) => {
    setFileName(event.target.files?.[0]?.name || "");
    onChange?.(event);
  };

  return (
    <span className={`app-input-file ${className}`.trim()} style={style}>
      <input ref={ref} {...props} id={inputId} type="file" onChange={handleChange} className="app-input-file__input" />
      <label htmlFor={inputId} className="app-input-file__button btn btn-outline-secondary" title={title} aria-label={title}>
        <ArrowUpTrayIcon aria-hidden="true" />
      </label>
      <span className="app-input-file__name" title={fileName || "No file chosen"}>
        {fileName || "No file chosen"}
      </span>
    </span>
  );
});

export default InputFile;
