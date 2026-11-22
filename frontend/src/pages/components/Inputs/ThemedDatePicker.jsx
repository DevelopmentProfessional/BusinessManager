import React, { useState } from "react";
import DatePicker from "react-datepicker";
import { format, isValid, parseISO } from "date-fns";
import { CalendarDaysIcon, ClockIcon } from "../../../icons";

function parseValue(value, mode) {
  if (!value) return null;

  if (mode === "time") {
    const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
    return match ? new Date(2000, 0, 1, Number(match[1]), Number(match[2])) : null;
  }

  const expectedLength = mode === "date" ? 10 : 16;
  const normalizedValue = value.slice(0, expectedLength);
  const pattern = mode === "date"
    ? /^\d{4}-\d{2}-\d{2}$/
    : /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
  if (!pattern.test(normalizedValue)) return null;

  const date = parseISO(normalizedValue);
  const formatString = mode === "date" ? "yyyy-MM-dd" : "yyyy-MM-dd'T'HH:mm";
  return isValid(date) && format(date, formatString) === normalizedValue ? date : null;
}

function formatValue(date, mode) {
  if (!date) return "";
  if (mode === "date") return format(date, "yyyy-MM-dd");
  if (mode === "time") return format(date, "HH:mm");
  return format(date, "yyyy-MM-dd'T'HH:mm");
}

export default function ThemedDatePicker({ mode, ...props }) {
  const {
    value,
    defaultValue,
    name,
    onChange,
    min,
    max,
    minDate,
    maxDate,
    type,
    placeholder,
    className = "",
    ...pickerProps
  } = props;
  const [uncontrolledValue, setUncontrolledValue] = useState(defaultValue || "");
  const currentValue = value === undefined ? uncontrolledValue : value;
  const selected = parseValue(currentValue, mode);
  const resolvedMinDate = parseValue(min, mode) || minDate;
  const resolvedMaxDate = parseValue(max, mode) || maxDate;
  const dateFormat = mode === "date"
    ? "MM/dd/yyyy"
    : mode === "time"
      ? "h:mm aa"
      : "MM/dd/yyyy h:mm aa";

  const handleChange = (date) => {
    const nextValue = formatValue(date, mode);
    if (value === undefined) setUncontrolledValue(nextValue);
    onChange?.({
      target: { name, value: nextValue, type },
      currentTarget: { name, value: nextValue, type },
    });
  };

  return (
    <>
      {name && <input type="hidden" name={name} value={currentValue || ""} />}
      <DatePicker
        {...pickerProps}
        selected={selected}
        onChange={handleChange}
        minDate={resolvedMinDate}
        maxDate={resolvedMaxDate}
        showTimeSelect={mode !== "date"}
        showTimeSelectOnly={mode === "time"}
        timeIntervals={15}
        timeFormat="h:mm aa"
        dateFormat={dateFormat}
        placeholderText={mode === "date" ? "MM/DD/YYYY" : dateFormat.toUpperCase()}
        className={`form-control ui-control-sm ${className}`.trim()}
        wrapperClassName="app-date-picker-wrapper"
        calendarClassName="app-themed-datepicker"
        popperClassName="app-themed-datepicker-popper"
        popperPlacement="bottom-start"
        portalId="app-datepicker-portal"
        showIcon
        icon={mode === "time"
          ? <ClockIcon className="app-date-picker-icon" aria-hidden="true" />
          : <CalendarDaysIcon className="app-date-picker-icon" aria-hidden="true" />}
        calendarIconClassName="app-date-picker-icon"
        toggleCalendarOnIconClick
        showPopperArrow={false}
        todayButton={mode === "date" ? "Today" : undefined}
        shouldCloseOnSelect={mode !== "datetime"}
      />
    </>
  );
}
