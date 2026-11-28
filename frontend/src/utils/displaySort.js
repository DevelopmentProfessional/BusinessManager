const COLLATOR = new Intl.Collator(undefined, { sensitivity: "base", numeric: true });

function asText(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function isSpecialTopOption(option) {
  const value = asText(option?.value).toLowerCase();
  const label = asText(option?.label).toLowerCase();
  if (value === "") return true;
  return /^(all|none|select|choose|any)\b/.test(label);
}

export function sortOptionsByLabel(options = [], { pinSpecialTop = true } = {}) {
  const list = Array.isArray(options) ? [...options] : [];
  return list.sort((a, b) => {
    if (pinSpecialTop) {
      const aTop = isSpecialTopOption(a);
      const bTop = isSpecialTopOption(b);
      if (aTop !== bTop) return aTop ? -1 : 1;
    }

    return COLLATOR.compare(asText(a?.label), asText(b?.label));
  });
}

export function sortItemsAlphabetically(items = [], preferredKeys = []) {
  if (!Array.isArray(items)) return [];
  const keys = preferredKeys.length > 0 ? preferredKeys : ["name", "title", "label", "original_filename", "filename", "email", "username", "id"];

  const pick = (item) => {
    for (const key of keys) {
      const value = item?.[key];
      const text = asText(value);
      if (text) return text;
    }

    if (item && typeof item === "object") {
      const fullName = `${asText(item.first_name)} ${asText(item.last_name)}`.trim();
      if (fullName) return fullName;
    }

    return asText(item);
  };

  return [...items].sort((a, b) => COLLATOR.compare(pick(a), pick(b)));
}
