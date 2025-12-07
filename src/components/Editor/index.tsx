"use client";

import { useState, useCallback } from "react";
import { useGameContext } from "../../context/GameContext";
import Line from "./Line";

export default function Editor() {
  const { editorLines } = useGameContext();
  const [focusedId, setFocusedId] = useState<string | null>(null);

  const focusLine = useCallback((id: string) => {
    setFocusedId(id);
  }, []);

  const copyToClipboard = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(editorLines, null, 2));
    } catch (err) {
      console.error("Copy failed", err);
    }
  }, [editorLines]);

  return (
    <div className="flex flex-col w-full p-2 overflow-auto min-h-[300px]">
      <div className="flex justify-between items-center">
        <div className="text-xs font-bold text-gray-500 uppercase mb-2">
          Editor
        </div>
        <div className="flex gap-2">
          <button onClick={copyToClipboard}>Copy</button>
        </div>
      </div>

      <div className="text-xs text-gray-400 mb-3">
        <code className="bg-gray-100 px-1 rounded">/</code> commands
        <span className="mx-2">•</span>
        <code className="bg-gray-100 px-1 rounded">Tab</code> indent
        <span className="mx-2">•</span>
        <code className="bg-gray-100 px-1 rounded">Enter</code> new line
      </div>

      <div className="flex flex-col">
        {editorLines.map((line) => (
          <Line
            key={line.id}
            line={line}
            isFocused={focusedId === line.id}
            focusLine={focusLine}
          />
        ))}
      </div>
    </div>
  );
}
