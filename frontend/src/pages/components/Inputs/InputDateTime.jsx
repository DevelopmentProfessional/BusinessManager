import ThemedDatePicker from "./ThemedDatePicker";

export default function InputDateTime({ className = "", ...props }) {
  return <ThemedDatePicker {...props} mode="datetime" className={className} type="datetime-local" />;
}
