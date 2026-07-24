import { useEffect, useRef, useState } from "react";

const MEASURE_CANVAS = typeof document !== "undefined" ? document.createElement("canvas") : null;
const MEASURE_CONTEXT = MEASURE_CANVAS ? MEASURE_CANVAS.getContext("2d") : null;

function measureTextWidth(text, font) {
  if (!MEASURE_CONTEXT) return text.length * 8;
  MEASURE_CONTEXT.font = font;
  return MEASURE_CONTEXT.measureText(text).width;
}

function truncateSingleWord(word, maxWidth, font) {
  if (!word) return "";
  if (measureTextWidth(word, font) <= maxWidth) return word;

  let low = 0;
  let high = word.length;
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    const part = word.slice(0, mid);
    if (measureTextWidth(part, font) <= maxWidth) {
      low = mid;
    } else {
      high = mid - 1;
    }
  }

  return word.slice(0, Math.max(low, 1));
}

export function truncateByWholeWords(text, maxWidth, font) {
  const normalized = String(text || "").trim().replace(/\s+/g, " ");
  if (!normalized || maxWidth <= 0) return "";

  if (measureTextWidth(normalized, font) <= maxWidth) {
    return normalized;
  }

  const words = normalized.split(" ");
  if (words.length === 1) {
    return truncateSingleWord(words[0], maxWidth, font);
  }

  let best = "";
  for (const word of words) {
    const next = best ? `${best} ${word}` : word;
    if (measureTextWidth(next, font) <= maxWidth) {
      best = next;
      continue;
    }
    break;
  }

  if (best) {
    return best;
  }

  return truncateSingleWord(words[0], maxWidth, font);
}

export function useWordSafeLabel(label, { enabled = true, reserveWidth = 0 } = {}) {
  const ref = useRef(null);
  const [displayLabel, setDisplayLabel] = useState(label || "");

  useEffect(() => {
    if (!enabled) {
      setDisplayLabel(label || "");
      return;
    }

    const element = ref.current;
    if (!element) {
      setDisplayLabel(label || "");
      return;
    }

    const recalc = () => {
      const computed = window.getComputedStyle(element);
      const font = computed.font;
      const maxWidth = Math.max(0, element.clientWidth - reserveWidth);
      setDisplayLabel(truncateByWholeWords(label || "", maxWidth, font));
    };

    recalc();

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", recalc);
      return () => window.removeEventListener("resize", recalc);
    }

    const observer = new ResizeObserver(recalc);
    observer.observe(element);
    return () => observer.disconnect();
  }, [enabled, label, reserveWidth]);

  return { ref, displayLabel };
}
