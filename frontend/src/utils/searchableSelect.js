const WHITESPACE_PATTERN = /\s/;

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function matchesWildcardText(term, ...candidates) {
  const normalizedTerm = String(term ?? "")
    .trim()
    .toLowerCase();
  if (!normalizedTerm) {
    return true;
  }

  const characters = Array.from(normalizedTerm).filter((character) => !WHITESPACE_PATTERN.test(character));
  if (characters.length === 0) {
    return true;
  }

  const wildcardPattern = new RegExp(characters.map((character) => escapeRegex(character)).join(".*"), "i");

  return candidates.some((candidate) => {
    const text = String(candidate ?? "").trim();
    return text.length > 0 && wildcardPattern.test(text);
  });
}
