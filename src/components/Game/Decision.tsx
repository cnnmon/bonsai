import { HistoryEntry } from "@/types";
import { useState } from "react";

export default function Decision({
  entry,
  isPending,
  onSelect,
  generationStatus,
}: {
  entry: HistoryEntry;
  isPending: boolean;
  onSelect: (text: string) => void;
  generationStatus: "idle" | "matching" | "generating";
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
            placeholder="Type to act..."
            disabled={generationStatus !== "idle"}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                if (query.trim().length > 0) {
                  onSelect(query);
                }
              }
            }}
          />
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          <input value={entry.chosenOption || ""} disabled />
          {entry.selectionMeta && (
            <div className="text-xs text-gray-500">
              Using: {entry.selectionMeta.option}
              {entry.selectionMeta.generated
                ? " (generated)"
                : entry.selectionMeta.cached
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
