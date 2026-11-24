import React, { useEffect, useId, useRef, useState } from "react";
import InputDate from "./InputDate";
import InputTime from "./InputTime";

function splitDateTime(value) {
  const normalizedValue = typeof value === "string" ? value.slice(0, 16) : "";
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})$/.exec(normalizedValue);
  return match ? { date: match[1], time: match[2] } : { date: "", time: "" };
}

export default function InputDateTime(props) {
  const {
    className = "",
    dateClassName = "",
    timeClassName = "",
    dateLabel = "Date",
    timeLabel = "Time",
    id,
    name,
    type = "datetime-local",
    value,
    defaultValue,
    onChange,
    min,
    max,
    minDate,
    maxDate,
    required,
    disabled,
    ...pickerProps
  } = props;
  const generatedId = useId();
  const dateId = id ? `${id}-date` : `${generatedId}-date`;
  const timeId = id ? `${id}-time` : `${generatedId}-time`;
  const [parts, setParts] = useState(() => splitDateTime(value ?? defaultValue ?? ""));
  const lastEmittedValue = useRef(null);
  const combinedValue = parts.date && parts.time ? `${parts.date}T${parts.time}` : "";

  useEffect(() => {
    if (value === undefined) return;
    if (lastEmittedValue.current === value) {
      lastEmittedValue.current = null;
      return;
    }

    lastEmittedValue.current = null;
    setParts(splitDateTime(value));
  }, [value]);

  const handlePartChange = (part, nextPartValue) => {
    const nextParts = { ...parts, [part]: nextPartValue || "" };
    const nextValue = nextParts.date && nextParts.time ? `${nextParts.date}T${nextParts.time}` : "";

    setParts(nextParts);
    if (value !== undefined) lastEmittedValue.current = nextValue;
    onChange?.({
      target: { name, value: nextValue, type },
      currentTarget: { name, value: nextValue, type },
    });
  };

  const dateMin = typeof min === "string" ? min.slice(0, 10) : undefined;
  const dateMax = typeof max === "string" ? max.slice(0, 10) : undefined;

  return (
    <div className="app-date-time-input" role="group" aria-label="Date and time">
      {name && <input type="hidden" name={name} value={combinedValue} disabled={disabled} />}
      <div className="app-date-time-input__field">
        <label className="app-date-time-input__label" htmlFor={dateId}>{dateLabel}</label>
        <InputDate
          {...pickerProps}
          id={dateId}
          value={parts.date}
          min={dateMin}
          max={dateMax}
          minDate={minDate}
          maxDate={maxDate}
          required={required}
          disabled={disabled}
          className={`${className} ${dateClassName}`.trim()}
          onChange={(event) => handlePartChange("date", event.target.value)}
        />
      </div>
      <div className="app-date-time-input__field">
        <label className="app-date-time-input__label" htmlFor={timeId}>{timeLabel}</label>
        <InputTime
          {...pickerProps}
          id={timeId}
          value={parts.time}
          required={required}
          disabled={disabled}
          className={`${className} ${timeClassName}`.trim()}
          onChange={(event) => handlePartChange("time", event.target.value)}
        />
      </div>
    </div>
  );
}
