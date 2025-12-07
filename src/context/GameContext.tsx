"use client";

import {
  createContext,
  useContext,
  useState,
  ReactNode,
  useCallback,
  useMemo,
  useEffect,
  useRef,
} from "react";
import { GameStructure, Scene, Line, Option, LineType } from "../types/game";
import { initialGame } from "../data/initialGame";
import {
  EditorLine,
  structureToLines,
  linesToStructure,
  detectPrefix,
} from "../lib/notation";
import { generateId } from "../components/Editor/utils";
import { formatOptionTexts, parseOptionTexts } from "../lib/options";

interface GameContextValue {
  gameStructure: GameStructure;
  editorLines: EditorLine[];
  versionLog: VersionEntry[];
  updateLine: (id: string, text: string) => void;
  updateLineIndent: (id: string, indent: number) => void;
  insertLineAfter: (afterId: string, text: string, indent: number) => string;
  insertLineBefore: (beforeId: string, text: string, indent: number) => string;
  deleteLine: (id: string) => void;
  appendOptionVariant: (optionId: string, variant: string) => void;
  saveVersion: (label?: string, snapshot?: EditorLine[]) => void;
  revertVersion: (versionId: string) => boolean;
  deleteVersion: (versionId: string) => void;
  applyGeneratedBranch: (payload: {
    decisionId: string;
    option: Option;
    newScene?: Scene;
    userInput: string;
  }) => void;
  appendLineToScene: (
    sceneLabel: string,
    lineText: string,
    indent: number
  ) => void;
  registerSceneJumpHandler: (fn: (sceneLabel: string) => void) => void;
  triggerSceneJump: (sceneLabel: string) => void;
  replaceAllLines: (lines: EditorLine[]) => void;
}

interface VersionEntry {
  id: string;
  label: string;
  createdAt: number;
  snapshot: EditorLine[];
}

const GameContext = createContext<GameContextValue | null>(null);

export function GameProvider({ children }: { children: ReactNode }) {
  // Deterministic initial snapshot to avoid hydration drift
  const initialSnapshot = structureToLines(initialGame);
  const defaultVersion: VersionEntry = {
    id: "initial-version",
    label: "Initial",
    createdAt: 0,
    snapshot: initialSnapshot,
  };

  // Store editor lines as source of truth
  const [editorLines, setEditorLines] = useState<EditorLine[]>(() => {
    if (typeof window !== "undefined") {
      const saved = window.localStorage.getItem("bonsai.versions");
      if (saved) {
        try {
          const parsed: VersionEntry[] = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            const latest = parsed.reduce((prev, current) =>
              current.createdAt > prev.createdAt ? current : prev
            );
            return latest.snapshot.map((l) => ({ ...l }));
          }
        } catch {
          // ignore broken storage
        }
      }
    }
    // Fall back to deterministic initial snapshot
    return initialSnapshot;
  });

  const [versions, setVersions] = useState<VersionEntry[]>(() => {
    if (typeof window !== "undefined") {
      const saved = window.localStorage.getItem("bonsai.versions");
      if (saved) {
        try {
          const parsed: VersionEntry[] = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed;
          }
        } catch {
          // ignore broken storage
        }
      }
    }
    return [defaultVersion];
  });

  const sceneJumpHandlerRef = useRef<((sceneLabel: string) => void) | null>(
    null
  );

  // Derive game structure from editor lines
  const gameStructure = useMemo(() => {
    return linesToStructure(editorLines);
  }, [editorLines]);

  // Persist versions to localStorage whenever they change
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("bonsai.versions", JSON.stringify(versions));
  }, [versions]);

  const saveVersion = useCallback(
    (label?: string, snapshot?: EditorLine[]) => {
      const base = snapshot ?? editorLines;
      const entry: VersionEntry = {
        id: generateId(),
        label: label?.trim() || `Snapshot ${new Date().toLocaleTimeString()}`,
        createdAt: Date.now(),
        snapshot: base.map((l) => ({ ...l })),
      };
      setVersions((prev) => [...prev, entry]);
    },
    [editorLines]
  );

  const revertVersion = useCallback(
    (versionId: string) => {
      const entry = versions.find((v) => v.id === versionId);
      if (!entry) return false;
      setEditorLines(entry.snapshot.map((l) => ({ ...l })));
      return true;
    },
    [versions]
  );

  const deleteVersion = useCallback((versionId: string) => {
    setVersions((prev) => prev.filter((v) => v.id !== versionId));
  }, []);

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

  const insertLineBefore = useCallback(
    (beforeId: string, text: string, indent: number): string => {
      const newId = generateId();
      setEditorLines((prev) => {
        const idx = prev.findIndex((l) => l.id === beforeId);
        if (idx === -1) return [{ id: newId, text, indent }, ...prev];
        const newLines = [...prev];
        newLines.splice(idx, 0, { id: newId, text, indent });
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

  const appendOptionVariant = useCallback(
    (optionId: string, variant: string) => {
      setEditorLines((prev) =>
        prev.map((line) => {
          if (line.id !== optionId) return line;
          const { type, content } = detectPrefix(line.text);
          if (type !== LineType.OPTION) return line;
          const existing = parseOptionTexts(content);
          const normalized = new Set(
            existing.map((v) => v.trim().toLowerCase())
          );
          const trimmed = variant.trim();
          if (!trimmed || normalized.has(trimmed.toLowerCase())) {
            return line;
          }
          const nextTexts = [...existing, trimmed];
          return {
            ...line,
            text: `* ${formatOptionTexts(nextTexts)}`,
          };
        })
      );
    },
    []
  );

  const appendLineToScene = useCallback(
    (sceneLabel: string, lineText: string, indent: number) => {
      setEditorLines((prev) => {
        const sceneIdx = prev.findIndex((l) => {
          const { type, content } = detectPrefix(l.text);
          return type === LineType.SCENE && content === sceneLabel;
        });
        if (sceneIdx === -1) return prev;

        // Place new generated lines at the end of the scene so indentation can
        // correctly nest under the latest decision/option context.
        const nextSceneIdx = prev.findIndex((l, idx) => {
          if (idx <= sceneIdx) return false;
          const { type } = detectPrefix(l.text);
          return type === LineType.SCENE;
        });

        const insertIdx = nextSceneIdx === -1 ? prev.length : nextSceneIdx;

        const newLine: EditorLine = {
          id: generateId(),
          text: lineText,
          indent,
        };

        const nextLines = [
          ...prev.slice(0, insertIdx),
          newLine,
          ...prev.slice(insertIdx),
        ];
        return nextLines;
      });
    },
    []
  );

  const registerSceneJumpHandler = useCallback(
    (fn: (sceneLabel: string) => void) => {
      sceneJumpHandlerRef.current = fn;
    },
    []
  );

  const triggerSceneJump = useCallback((sceneLabel: string) => {
    sceneJumpHandlerRef.current?.(sceneLabel);
  }, []);

  const replaceAllLines = useCallback(
    (lines: EditorLine[]) => {
      setEditorLines(lines);
      saveVersion("Pasted from clipboard", lines);
    },
    [saveVersion]
  );

  const lineToEditorLines = useCallback(
    (line: Line, indent: number): EditorLine[] => {
      if (line.type === LineType.NARRATIVE) {
        return [{ id: line.id, text: `- ${line.text}`, indent }];
      }
      if (line.type === LineType.JUMP) {
        return [{ id: line.id, text: `↗ ${line.target}`, indent }];
      }
      if (line.type === LineType.PROMPT) {
        return [{ id: line.id, text: `! ${line.text}`, indent }];
      }
      if (line.type === LineType.DECISION) {
        const lines: EditorLine[] = [
          { id: line.id, text: `? ${line.prompt}`, indent },
        ];
        for (const opt of line.options) {
          lines.push({
            id: opt.id,
            text: `* ${formatOptionTexts(opt.texts)}`,
            indent: indent + 1,
          });
          for (const optLine of opt.lines) {
            lines.push(...lineToEditorLines(optLine, indent + 2));
          }
        }
        return lines;
      }
      return [];
    },
    []
  );

  const applyGeneratedBranch = useCallback(
    ({
      decisionId,
      option,
      newScene,
      userInput,
    }: {
      decisionId: string;
      option: Option;
      newScene?: Scene;
      userInput: string;
    }) => {
      let updatedLines: EditorLine[] | null = null;
      setEditorLines((prev) => {
        const decisionIndex = prev.findIndex((l) => l.id === decisionId);
        if (decisionIndex === -1) return prev;

        const decisionIndent = prev[decisionIndex].indent;
        const optionIndent = decisionIndent + 1;
        const optionContentIndent = optionIndent + 1;

        const optionLines: EditorLine[] = [
          {
            id: option.id,
            text: `* ${formatOptionTexts(option.texts)}`,
            indent: optionIndent,
          },
        ];
        for (const optLine of option.lines) {
          optionLines.push(...lineToEditorLines(optLine, optionContentIndent));
        }

        let insertIndex = decisionIndex + 1;
        while (
          insertIndex < prev.length &&
          prev[insertIndex].indent > decisionIndent
        ) {
          insertIndex++;
        }

        const nextLines = [
          ...prev.slice(0, insertIndex),
          ...optionLines,
          ...prev.slice(insertIndex),
        ];

        if (newScene) {
          // Add scene label only (streaming will populate the rest)
          const sceneHeader: EditorLine = {
            id: `scene-${newScene.label}`,
            text: `# ${newScene.label}`,
            indent: 0,
          };
          updatedLines = [...nextLines, sceneHeader];
          return updatedLines;
        }
        updatedLines = nextLines;
        return updatedLines;
      });

      if (updatedLines) {
        saveVersion(`Auto branch: ${userInput}`, updatedLines);
      }
    },
    [lineToEditorLines, saveVersion]
  );

  return (
    <GameContext.Provider
      value={{
        gameStructure,
        editorLines,
        versionLog: versions,
        updateLine,
        updateLineIndent,
        insertLineAfter,
        insertLineBefore,
        deleteLine,
        appendOptionVariant,
        saveVersion,
        revertVersion,
        deleteVersion,
        applyGeneratedBranch,
        appendLineToScene,
        registerSceneJumpHandler,
        triggerSceneJump,
        replaceAllLines,
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
