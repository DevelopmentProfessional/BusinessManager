// FILE: formatters.js
// formats currency, percent, and phone values for display

export function formatCurrency(v) {
  return `$${(+v || 0).toFixed(2)}`;
}

export function formatPercent(v) {
  return `${(+v || 0).toFixed(1)}%`;
}

export function formatPhone(raw) {
  if (!raw) return "";
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  if (digits.length === 11 && digits[0] === "1") {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  return raw;
}
