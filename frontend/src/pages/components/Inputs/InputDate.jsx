import ThemedDatePicker from "./ThemedDatePicker";

export default function InputDate({ className = "", ...props }) {
  return <ThemedDatePicker {...props} mode="date" className={className} type="date" />;
}
