import { Option, HistoryEntry } from "@/types";

export default function Decision({
  entry,
  isPending,
  query,
  onQueryChange,
  filteredOptions,
  onSelect,
}: {
  entry: HistoryEntry;
  isPending: boolean;
  query: string;
  onQueryChange: (value: string) => void;
  filteredOptions: Option[];
  onSelect: (text: string) => void;
}) {
  const showOptions = query.trim().length > 0 && filteredOptions.length > 0;
  return (
    <>
      <p>{entry.text}</p>
      {isPending ? (
        <div className="flex flex-col gap-2">
          <input
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Type to decide..."
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                if (query.trim().length > 0) {
                  onSelect(query);
                  onQueryChange("");
                }
              }
            }}
          />
          {showOptions && (
            <div className="border border-gray-200 rounded-sm overflow-hidden divide-y divide-gray-200">
              {filteredOptions.map((opt) => (
                <button
                  key={opt.id}
                  className="w-full text-left px-2 py-2 text-sm hover:bg-gray-100"
                  onClick={() => onSelect(opt.text)}
                >
                  {opt.text}
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <input value={entry.chosenOption || ""} disabled />
      )}
    </>
  );
}
