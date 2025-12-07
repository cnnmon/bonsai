import { BranchGenerationResultPayload } from "@/types/branching";

export type BranchGenerationResult =
  | {
      type: "paragraph";
      text?: string;
      question?: string;
    }
  | {
      type: "new_scene";
      sceneLabel?: string;
      paragraphs?: string[];
      question?: string;
    }
  | {
      type: "existing_scene";
      sceneLabel?: string;
      paragraphs?: string[];
    }
  | {
      type: "parse_error";
    };

export async function fetchBranchGeneration(
  payload: BranchGenerationResultPayload
): Promise<BranchGenerationResult> {
  const response = await fetch("/api/grok-branch", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(
      message
        ? `Branch generation failed (${response.status}): ${message}`
        : `Branch generation failed (${response.status})`
    );
  }

  const data = await response.json();
  console.log("[branchGeneration] Grok response data:", JSON.stringify(data, null, 2));
  try {
    if (typeof data?.content === "string") {
      return JSON.parse(data.content);
    }
    if (data?.content && typeof data.content === "object") {
      return data.content as BranchGenerationResult;
    }
  } catch {
    // fall through
  }
  return { type: "parse_error" };
}

