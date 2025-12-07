"use client";

import { useEffect, useRef } from "react";
import { useGame } from "../../hooks/useGame";
import { LineType } from "@/types";
import { useGameContext } from "@/context/GameContext";
import Decision from "./Decision";

export default function Game() {
  const { gameStructure, appendOptionVariant } = useGameContext();
  const { history, currentLineType, advance, restart, isGenerating } = useGame(
    gameStructure,
    { onCacheOptionVariant: appendOptionVariant }
  );
  const bottomRef = useRef<HTMLDivElement>(null);
  const lastEntry = history[history.length - 1];
  const activeDecisionId =
    lastEntry?.type === LineType.DECISION && !lastEntry.chosenOption
      ? lastEntry.lineId
      : null;

  const handleSelect = (text: string) => {
    void advance(text);
  };

  // Auto-advance narrative and jump lines
  useEffect(() => {
    if (
      currentLineType === LineType.NARRATIVE ||
      currentLineType === LineType.JUMP
    ) {
      const timer = setTimeout(() => {
        void advance();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [currentLineType, advance]);

  // Auto-scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [history]);

  return (
    <div className="flex flex-col gap-2 w-full p-2 overflow-auto bg-zinc-100 h-full relative">
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
            {entry.type === LineType.NARRATIVE && (
              <div className={entry.meta ? "text-gray-400 text-sm" : undefined}>
                {entry.text}
              </div>
            )}
            {entry.type === LineType.DECISION && (
              <Decision
                entry={entry}
                isPending={isPendingDecisionInput}
                onSelect={handleSelect}
                isGenerating={isGenerating}
              />
            )}
          </div>
        );
      })}
      <div ref={bottomRef} />
    </div>
  );
}
