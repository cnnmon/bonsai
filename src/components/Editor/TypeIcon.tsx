"use client";

import { LineType } from "@/types";
import { twMerge } from "tailwind-merge";

const icons: Record<LineType, { symbol: string; color: string }> = {
  [LineType.SCENE]: { symbol: "§", color: "text-black" },
  [LineType.OPTION]: { symbol: "→", color: "text-green-600" },
  [LineType.NARRATIVE]: { symbol: "¶", color: "text-gray-400" },
  [LineType.DECISION]: { symbol: "?", color: "text-yellow-600" },
  [LineType.JUMP]: { symbol: "↗", color: "text-blue-500" },
  [LineType.PROMPT]: { symbol: "⚡", color: "text-purple-600" },
};

export default function TypeIcon({
  type,
  onClick,
}: {
  type: LineType;
  onClick?: () => void;
}) {
  const { symbol, color } = icons[type] ?? {
    symbol: "·",
    color: "text-gray-300",
  };
  return (
    <span
      onClick={onClick}
      className={twMerge(
        "w-4 text-center text-xs select-none",
        onClick ? "cursor-pointer hover:opacity-70 transition-opacity" : "",
        color
      )}
      aria-label="type"
      title={
        onClick
          ? type === LineType.SCENE
            ? "Jump to scene"
            : type === LineType.PROMPT
            ? "AI generation prompt"
            : ""
          : ""
      }
    >
      {symbol}
    </span>
  );
}
