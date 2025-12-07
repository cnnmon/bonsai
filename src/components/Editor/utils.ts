import { nanoid } from "nanoid";
import { LineType, NarrativeLine, DecisionLine, JumpLine, Option } from "@/types";

export function getPrefix(type: LineType): string {
  switch (type) {
    case LineType.NARRATIVE:
      return "- ";
    case LineType.DECISION:
      return "* ";
    case LineType.OPTION:
      return "~ ";
    case LineType.JUMP:
      return "↗ ";
    default:
      return "";
  }
}

// Generate unique IDs for lines
export function generateId(): string {
  return nanoid(10);
}

// Factory functions for creating lines with auto-generated IDs
export function createNarrativeLine(text: string): NarrativeLine {
  return {
    type: LineType.NARRATIVE,
    id: generateId(),
    text,
  };
}

export function createDecisionLine(prompt: string, options: Option[] = []): DecisionLine {
  return {
    type: LineType.DECISION,
    id: generateId(),
    prompt,
    options,
  };
}

export function createJumpLine(target: string): JumpLine {
  return {
    type: LineType.JUMP,
    id: generateId(),
    target,
  };
}

export function createOption(
  texts: string[],
  lines: (NarrativeLine | DecisionLine | JumpLine)[] = []
): Option {
  return {
    id: generateId(),
    texts,
    lines,
  };
}
