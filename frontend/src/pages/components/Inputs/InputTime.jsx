import ThemedDatePicker from "./ThemedDatePicker";

export default function InputTime({ className = "", ...props }) {
  return <ThemedDatePicker {...props} mode="time" className={className} type="time" />;
}
