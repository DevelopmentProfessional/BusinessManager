import React from "react";

export default function Field_Floating({ id, label, children, className = "" }) {
  return (
    <div className={`form-floating ${className}`.trim()}>
      {React.cloneElement(children, { id: id || children.props.id, placeholder: children.props.placeholder || label })}
      <label htmlFor={id || children.props.id}>{label}</label>
    </div>
  );
}
