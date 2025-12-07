import { Option } from "@/types";

export function normalizeText(text: string): string {
  return text.trim().toLowerCase();
}

export function getOptionPrimaryText(option: Option): string {
  return option.texts[0] ?? "";
}

export function parseOptionTexts(raw: string): string[] {
  return raw
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

export function formatOptionTexts(texts: string[]): string {
  return texts.join(", ");
}


export function optionHasText(option: Option, candidate: string): boolean {
  const normalized = normalizeText(candidate);
  return option.texts.some((text) => normalizeText(text) === normalized);
}

export function ensureOptionHasVariant(option: Option, variant: string): Option {
  if (!variant.trim()) return option;
  if (!optionHasText(option, variant)) {
    option.texts = [...option.texts, variant];
  }
  return option;
}

