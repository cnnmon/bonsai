"use client";

import {
  createContext,
  useContext,
  useState,
  ReactNode,
  useCallback,
  useMemo,
} from "react";
import { GameStructure } from "../types/game";
import { initialGame } from "../data/initialGame";
import {
  EditorLine,
  structureToLines,
  linesToStructure,
  detectPrefix,
} from "../lib/notation";
import { generateId } from "../components/Editor/utils";
import { formatOptionTexts, parseOptionTexts } from "../lib/options";
import { LineType } from "@/types";

interface GameContextValue {
  gameStructure: GameStructure;
  editorLines: EditorLine[];
  updateLine: (id: string, text: string) => void;
  updateLineIndent: (id: string, indent: number) => void;
  insertLineAfter: (afterId: string, text: string, indent: number) => string;
  deleteLine: (id: string) => void;
  appendOptionVariant: (optionId: string, variant: string) => void;
}

const GameContext = createContext<GameContextValue | null>(null);

export function GameProvider({ children }: { children: ReactNode }) {
  // Store editor lines as source of truth
  const [editorLines, setEditorLines] = useState<EditorLine[]>(() =>
    structureToLines(initialGame)
  );

  // Derive game structure from editor lines
  const gameStructure = useMemo(() => {
    return linesToStructure(editorLines);
  }, [editorLines]);

  const updateLine = useCallback((id: string, text: string) => {
    setEditorLines((prev) =>
      prev.map((line) => (line.id === id ? { ...line, text } : line))
    );
  }, []);

  const updateLineIndent = useCallback((id: string, indent: number) => {
    setEditorLines((prev) =>
      prev.map((line) =>
        line.id === id ? { ...line, indent: Math.max(0, indent) } : line
      )
    );
  }, []);

  const insertLineAfter = useCallback(
    (afterId: string, text: string, indent: number): string => {
      const newId = generateId();
      setEditorLines((prev) => {
        const idx = prev.findIndex((l) => l.id === afterId);
        if (idx === -1) return [...prev, { id: newId, text, indent }];
        const newLines = [...prev];
        newLines.splice(idx + 1, 0, { id: newId, text, indent });
        return newLines;
      });
      return newId;
    },
    []
  );

  const deleteLine = useCallback((id: string) => {
    setEditorLines((prev) => {
      // Don't delete if it's the last line
      if (prev.length <= 1) return prev;
      return prev.filter((l) => l.id !== id);
    });
  }, []);

  const appendOptionVariant = useCallback((optionId: string, variant: string) => {
    setEditorLines((prev) =>
      prev.map((line) => {
        if (line.id !== optionId) return line;
        const { type, content } = detectPrefix(line.text);
        if (type !== LineType.OPTION) return line;
        const existing = parseOptionTexts(content);
        const normalized = new Set(existing.map((v) => v.trim().toLowerCase()));
        const trimmed = variant.trim();
        if (!trimmed || normalized.has(trimmed.toLowerCase())) {
          return line;
        }
        const nextTexts = [...existing, trimmed];
        return {
          ...line,
          text: `~ ${formatOptionTexts(nextTexts)}`,
        };
      })
    );
  }, []);

  return (
    <GameContext.Provider
      value={{
        gameStructure,
        editorLines,
        updateLine,
        updateLineIndent,
        insertLineAfter,
        deleteLine,
        appendOptionVariant,
      }}
    >
      {children}
    </GameContext.Provider>
  );
}

export function useGameContext() {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error("useGameContext must be used within GameProvider");
  return ctx;
}
