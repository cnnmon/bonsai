import { HistoryEntry } from "@/types";
import { useState } from "react";

export default function Decision({
  entry,
  isPending,
  onSelect,
  isGenerating,
}: {
  entry: HistoryEntry;
  isPending: boolean;
  onSelect: (text: string) => void;
  isGenerating: boolean;
}) {
  const [query, setQuery] = useState("");
  return (
    <>
      <p>{entry.text}</p>
      {isPending ? (
        <div className="flex flex-col gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type to decide..."
            disabled={isGenerating}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                if (query.trim().length > 0) {
                  onSelect(query);
                }
              }
            }}
          />
          {isGenerating && (
            <div className="text-xs text-gray-500">Matching your choice...</div>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          <input value={entry.chosenOption || ""} disabled />
          {entry.selectionMeta && (
            <div className="text-xs text-gray-500">
              Using: {entry.selectionMeta.option}
              {entry.selectionMeta.cached
                ? " (cached)"
                : typeof entry.selectionMeta.confidence === "number"
                ? ` (${Math.round(
                    entry.selectionMeta.confidence * 100
                  )}% match)`
                : ""}
            </div>
          )}
        </div>
      )}
    </>
  );
}
