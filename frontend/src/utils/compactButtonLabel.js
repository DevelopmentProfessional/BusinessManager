/** Short labels for toolbar/pill buttons. Pass full phrase as title/aria when context needs it. */
export default function compactButtonLabel(label) {
  if (typeof label !== "string") return label;

  const normalized = label.trim().replace(/\s+/g, " ");
  if (!normalized) return normalized;

  const key = normalized.toLowerCase();

  const exactMap = {
    "add asset": "Add",
    "add employee": "Add",
    "add client": "Add",
    "add service": "Add",
    "add supplier": "Add",
    "add resource": "Add",
    "add to cart": "Add",
    "add item": "Add",
    "add permission": "Add",
    "add existing…": "Add",
    "add existing...": "Add",
    "back to login": "Back",
    "check/start database": "DB",
    "checking/starting database...": "…",
    "complete production run": "Done",
    "create po": "Order",
    "downloading...": "…",
    "import csv": "CSV",
    "open camera": "Cam",
    "open email draft": "Email",
    "process payment": "Pay",
    "process payroll": "Pay",
    "process payroll →": "Pay",
    "refresh app": "Sync",
    "reset password": "Reset",
    "retake photo": "Retake",
    "select all": "All",
    "uploading...": "…",
    "add new permission": "Add",
    "apply to": "Apply",
    "back to documents": "Back",
    "cancel edit": "Cancel",
    "choose from documents": "Pick",
    "clear all filters": "Clear",
    "clear all": "Clear",
    "clear filter": "Clear",
    "clear filters": "Clear",
    "confirm cash payment": "Confirm",
    "confirm pay": "Pay",
    "continue shopping": "Shop",
    "create & select": "Add",
    "create asset": "Add",
    "create client": "Add",
    "create department": "Add",
    "create employee": "Add",
    "create item": "Add",
    "create new client": "New",
    "create new customer": "New",
    "create new role": "Add",
    "create order": "Order",
    "create purchase order": "Order",
    "create service": "Add",
    "create signature": "Sign",
    "create user": "Add",
    "create new permission": "Add",
    "deleting...": "…",
    "deleting…": "…",
    "delete item": "Delete",
    "delete service": "Delete",
    "edit image url": "Edit",
    "event type": "Type",
    "export csv": "CSV",
    "export pdf report": "PDF",
    "export scenario json": "JSON",
    "filter category": "Category",
    "filter role": "Role",
    "filter status": "Status",
    "filter subscription": "Subs",
    "import data": "Import",
    "import scenario": "Import",
    "importing...": "…",
    "importing…": "…",
    "log out": "Exit",
    "manage categories": "Cats",
    "manage permissions": "Perms",
    "manage roles": "Roles",
    "manage subscriptions": "Subs",
    "new client": "New",
    "new customer": "New",
    "new rule": "New",
    "print invoice": "Invoice",
    "print receipt": "Receipt",
    "process pay": "Pay",
    "replace signature": "Sign",
    "reset to default": "Reset",
    "reset to defaults": "Reset",
    "save branding": "Save",
    "save changes": "Save",
    "save notifications": "Save",
    "save payroll settings": "Save",
    "save portal settings": "Save",
    "save settings": "Save",
    "save signature": "Save",
    "save template": "Save",
    "saving...": "Save",
    "saving…": "Save",
    "creating...": "…",
    "creating…": "…",
    "processing...": "…",
    "processing…": "…",
    "send reminder": "Remind",
    "update employee": "Save",
    "update service": "Save",
    "upload photo": "Upload",
    "continue": "Shop",
    "checkout": "Pay",
    "suppliers": "Supply",
    "discounts": "Deals",
    "insights": "Stats",
    "templates": "Docs",
    "categories": "Cats",
    "insurance": "Ins",
    "history": "Past",
    "signature": "Sign",
    "textsize": "Size",
    "training mode": "Train",
    "compact mode": "Icons",
  };

  if (exactMap[key]) return exactMap[key];
  if (key.startsWith("filter ")) {
    const rest = normalized.slice(7).trim();
    if (rest.toLowerCase() === "subscription") return "Subs";
    return rest.length <= 10 ? rest : rest.split(/\s+/)[0];
  }
  if (key.startsWith("clear ")) return "Clear";
  if (key.startsWith("save ")) return "Save";
  if (key.startsWith("create ")) return "Add";
  if (key.startsWith("add ")) return "Add";
  if (key.startsWith("update ")) return "Save";
  if (key.startsWith("delete ")) return "Delete";
  if (key.startsWith("remove ")) return "Remove";
  if (key.startsWith("back to ")) return "Back";
  if (key.startsWith("manage ")) {
    const rest = normalized.slice(7).trim();
    if (!rest) return "Open";
    return compactButtonLabel(rest);
  }
  if (key.startsWith("print ")) return normalized.slice(6).trim() || "Print";
  if (key.startsWith("export ")) {
    const rest = normalized.slice(7).trim().toLowerCase();
    if (rest.includes("json")) return "JSON";
    if (rest.includes("pdf")) return "PDF";
    if (rest.includes("csv")) return "CSV";
    return "Export";
  }
  if (key.startsWith("import ")) return "Import";
  if (key.startsWith("pay $")) return "Pay";
  if (key.startsWith("confirm ")) return "Confirm";
  if (key.startsWith("send ")) return "Send";
  if (key.startsWith("upload ")) return "Upload";
  if (key.startsWith("choose ")) return "Pick";
  if (key === "previous") return "Prev";

  return normalized;
}
