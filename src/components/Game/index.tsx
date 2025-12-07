"use client";

import { useEffect, useRef } from "react";
import { useGame } from "../../hooks/useGame";
import { LineType } from "@/types";
import { useGameContext } from "@/context/GameContext";
import Decision from "./Decision";

export default function Game() {
  const {
    gameStructure,
    appendOptionVariant,
    applyGeneratedBranch,
    appendLineToScene,
    registerSceneJumpHandler,
  } = useGameContext();

  const {
    history,
    currentLineType,
    advance,
    restart,
    generationStatus,
    jumpToScene,
  } = useGame(gameStructure, {
    onCacheOptionVariant: appendOptionVariant,
    onBranchGenerated: applyGeneratedBranch,
    onAppendSceneLine: (sceneLabel, line) =>
      appendLineToScene(sceneLabel, line.text, line.indent),
  });
  const bottomRef = useRef<HTMLDivElement>(null);
  const activeDecisionId =
    [...history]
      .reverse()
      .find((entry) => entry.type === LineType.DECISION && !entry.chosenOption)
      ?.lineId ?? null;

  const handleSelect = (text: string) => {
    void advance(text);
  };

  // Auto-advance narrative, jump, and prompt lines
  useEffect(() => {
    if (
      currentLineType === LineType.NARRATIVE ||
      currentLineType === LineType.JUMP ||
      currentLineType === LineType.PROMPT
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

  useEffect(() => {
    registerSceneJumpHandler(jumpToScene);
    return () => registerSceneJumpHandler(() => {});
  }, [registerSceneJumpHandler, jumpToScene]);

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
                generationStatus={generationStatus}
              />
            )}
          </div>
        );
      })}
      <p className="text-xs text-gray-500">
        {generationStatus === "idle"
          ? ""
          : generationStatus === "matching"
          ? "Finding the best path..."
          : "Generating the path..."}
      </p>
      <div ref={bottomRef} />
    </div>
  );
}
