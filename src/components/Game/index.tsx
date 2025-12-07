"use client";

import { useState, useEffect, useRef } from "react";
import { useGameContext } from "../../context/GameContext";
import { useGame } from "../../hooks/useGame";
import { LineType } from "@/types";
import Decision from "./Decision";

export default function Game() {
  const { gameStructure } = useGameContext();
  const { history, currentDecision, currentLineType, advance, restart } =
    useGame(gameStructure);
  const [query, setQuery] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const lastEntry = history[history.length - 1];
  const activeDecisionId =
    lastEntry?.type === LineType.DECISION && !lastEntry.chosenOption
      ? lastEntry.lineId
      : null;
  const isDecision = !!activeDecisionId;
  const decisionOptions =
    isDecision && currentDecision?.id === activeDecisionId
      ? currentDecision.options ?? []
      : [];
  const filteredOptions =
    query.trim().length > 0
      ? decisionOptions.filter((opt) =>
          opt.text.toLowerCase().includes(query.toLowerCase())
        )
      : decisionOptions;

  const handleSelect = (text: string) => {
    setQuery(text);
    advance(text);
  };

  // Auto-advance narrative and jump lines
  useEffect(() => {
    if (
      currentLineType === LineType.NARRATIVE ||
      currentLineType === LineType.JUMP
    ) {
      const timer = setTimeout(() => advance(), 100);
      return () => clearTimeout(timer);
    }
  }, [currentLineType, advance]);

  // Auto-scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [history]);

  return (
    <div className="flex flex-col gap-2 w-full p-2 overflow-auto bg-zinc-50 h-full relative">
      <div className="flex justify-between items-center">
        <div className="text-xs font-bold text-gray-500 uppercase">Game</div>
        <button onClick={restart}>Restart?</button>
      </div>

      {/* History */}
      {history.map((entry, i) => {
        const isPendingDecisionInput =
          entry.type === LineType.DECISION &&
          !entry.chosenOption &&
          activeDecisionId === entry.lineId;

        return (
          <div key={i} className="flex flex-col gap-1">
            {entry.type === LineType.NARRATIVE && <div>{entry.text}</div>}
            {entry.type === LineType.DECISION && (
              <Decision
                entry={entry}
                isPending={isPendingDecisionInput}
                query={query}
                onQueryChange={setQuery}
                filteredOptions={filteredOptions}
                onSelect={handleSelect}
              />
            )}
          </div>
        );
      })}
      <div ref={bottomRef} />
    </div>
  );
}
