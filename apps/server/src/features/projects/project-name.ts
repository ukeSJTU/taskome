import { caseFold } from "unicode-case-folding";

export function normalizeProjectText(value: string) {
  return value.trim().normalize("NFKC");
}

export function projectNameKey(value: string) {
  return caseFold(normalizeProjectText(value));
}
