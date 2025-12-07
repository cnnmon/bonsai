import { LineType } from "@/types";
import { twMerge } from "tailwind-merge";

const icons: Record<LineType, { symbol: string; color: string }> = {
  [LineType.SCENE]: { symbol: "§", color: "text-black" },
  [LineType.OPTION]: { symbol: "→", color: "text-green-600" },
  [LineType.NARRATIVE]: { symbol: "¶", color: "text-gray-400" },
  [LineType.DECISION]: { symbol: "?", color: "text-yellow-600" },
  [LineType.JUMP]: { symbol: "↗", color: "text-blue-500" },
};

export default function TypeIcon({ type }: { type: LineType }) {
  const { symbol, color } = icons[type] ?? {
    symbol: "·",
    color: "text-gray-300",
  };
  return (
    <span className={twMerge("w-4 text-center text-xs select-none", color)}>
      {symbol}
    </span>
  );
}
