import { Option } from "@/types";

export interface GrokMatchResult {
  optionId: string | null;
  confidence: number;
}

export async function fetchGrokMatch(
  input: string,
  options: Option[]
): Promise<GrokMatchResult> {
  const response = await fetch("/api/grok-match", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      input,
      options: options.map((o) => ({ id: o.id, texts: o.texts })),
    }),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "Failed to reach Grok matcher");
  }

  const data = await response.json();
  const match = data?.match ?? data?.result;
  if (!match) {
    throw new Error("Invalid response from Grok matcher");
  }

  return {
    optionId: match.optionId ?? null,
    confidence: Number(match.confidence ?? 0),
  };
}

