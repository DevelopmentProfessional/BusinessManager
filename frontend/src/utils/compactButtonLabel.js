export default function compactButtonLabel(label) {
  if (typeof label !== "string") return label;

  const normalized = label.trim().replace(/\s+/g, " ");
  if (!normalized) return normalized;

  const key = normalized.toLowerCase();

  const exactMap = {
    "back to documents": "Back",
    "clear all filters": "Clear",
    "clear filter": "Clear",
    "clear filters": "Clear",
    "event type": "Type",
    "log out": "Exit",
    "new rule": "New",
    "save changes": "Save",
    "send reminder": "Remind",
  };

  if (exactMap[key]) return exactMap[key];
  if (key.startsWith("filter ")) return normalized.slice(7).trim() || "Filter";
  if (key.startsWith("clear ")) return "Clear";
  if (key.startsWith("save ")) return "Save";
  if (key.startsWith("create ")) return "Add";
  if (key.startsWith("add ")) return "Add";
  if (key.startsWith("update ")) return "Save";
  if (key.startsWith("delete ")) return "Delete";
  if (key.startsWith("remove ")) return "Remove";
  if (key.startsWith("back to ")) return "Back";

  return normalized;
}
