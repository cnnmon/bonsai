"use client";

import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import {
  GameStructure,
  Scene,
  Line,
  Option,
  HistoryEntry,
  LineType,
  DecisionLine,
} from "../types/game";
import {
  ensureOptionHasVariant,
  getOptionPrimaryText,
  normalizeText,
} from "../lib/options";
import { fetchGrokMatch } from "../lib/fuzzyMatch";

const GROK_CONFIDENCE_THRESHOLD = 0.45;

interface GamePosition {
  sceneLabel: string;
  lineIndex: number;
  optionPath?: { optionId: string; lineIndex: number };
}

// Find best matching option for user input (case-insensitive across variants)
function findMatchingOption(options: Option[], input: string): Option | null {
  const normalized = normalizeText(input);
  if (!normalized) return null;

  // Exact match across variants
  const exact = options.find((o) =>
    o.texts.some((text) => normalizeText(text) === normalized)
  );
  if (exact) return exact;

  // Substring match across variants
  const partial = options.filter((o) =>
    o.texts.some((text) => normalizeText(text).includes(normalized))
  );
  if (partial.length === 1) return partial[0];

  return null;
}

// Locate a decision line by id in the current game structure
function findDecisionById(structure: GameStructure, decisionId: string): DecisionLine | null {
  for (const scene of structure.scenes) {
    for (const line of scene.lines) {
      if (line.type === "decision" && line.id === decisionId) {
        return line;
      }
      if (line.type === "decision") {
        for (const opt of line.options) {
          for (const optLine of opt.lines) {
            if (optLine.type === "decision" && optLine.id === decisionId) {
              return optLine;
            }
          }
        }
      }
    }
  }
  return null;
}

export function useGame(
  gameStructure: GameStructure,
  opts?: { onCacheOptionVariant?: (optionId: string, variant: string) => void }
): {
  history: HistoryEntry[];
  currentLine: Line | null;
  currentScene: Scene | null;
  currentLineType: LineType | null;
  advance: (input?: string) => Promise<void>;
  restart: () => void;
  isGenerating: boolean;
} {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [position, setPosition] = useState<GamePosition>({
    sceneLabel: gameStructure.startScene,
    lineIndex: 0,
  });
  const [isEnded, setIsEnded] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  // Track jumps so we can return to the originating scene after visiting another
  const returnStack = useRef<GamePosition[]>([]);
  // Track which line ids have already been appended to history so edits don't replay them
  const seenLineIds = useRef<Set<string>>(new Set());
  // Track the active decision awaiting input (by id) so prompt stays frozen while options stay live
  const [pendingDecisionId, setPendingDecisionId] = useState<string | null>(null);
  const cacheVariant = opts?.onCacheOptionVariant;

  // Find current scene
  const currentScene = useMemo(() => {
    return gameStructure.scenes.find((s) => s.label === position.sceneLabel) ?? null;
  }, [gameStructure.scenes, position.sceneLabel]);

  // Get current line (considering option path)
  const currentLine = useMemo((): Line | null => {
    if (!currentScene || isEnded) return null;

    if (position.optionPath) {
      // Find the decision that contains this option
      for (const line of currentScene.lines) {
        if (line.type === 'decision') {
          const opt = line.options.find((o) => o.id === position.optionPath!.optionId);
          if (opt) {
            return opt.lines[position.optionPath.lineIndex] ?? null;
          }
        }
      }
      return null;
    }

    return currentScene.lines[position.lineIndex] ?? null;
  }, [currentScene, position, isEnded]);

  // Handle jump to scene
  const handleJump = useCallback((target: string) => {
    setPosition({ sceneLabel: target, lineIndex: 0 });
    // Clear seen line IDs to allow lines to be replayed when cycling back to a scene
    seenLineIds.current.clear();
  }, []);

  // Ensure decision prompt is appended as soon as we reach a decision line
  useEffect(() => {
    const decisionId =
      pendingDecisionId ?? (currentLine?.type === LineType.DECISION ? currentLine.id : null);
    if (!decisionId) return;
    const decisionLine = findDecisionById(gameStructure, decisionId);
    if (!decisionLine) return;

    if (!seenLineIds.current.has(decisionId)) {
      seenLineIds.current.add(decisionId);
      setHistory((prev) => [
        ...prev,
        { lineId: decisionId, type: LineType.DECISION, text: decisionLine.prompt },
      ]);
    }
    setPendingDecisionId(decisionId);
  }, [pendingDecisionId, currentLine, gameStructure]);

  const currentLineType = useMemo(() => currentLine?.type ?? null, [currentLine]);

  const findDecisionForOptionPath = useCallback(
    (scene: Scene | null, optionPath: GamePosition["optionPath"]) => {
      if (!scene || !optionPath) return null;
      const decision = scene.lines.find(
        (l) => l.type === "decision" && l.options.some((o) => o.id === optionPath.optionId)
      );
      if (!decision || decision.type !== "decision") return null;
      const decisionIndex = scene.lines.indexOf(decision);
      return { decision, decisionIndex };
    },
    []
  );

  const pushReturnAfterCurrent = useCallback(() => {
    if (!currentScene) return;
    if (position.optionPath) {
      const decisionInfo = findDecisionForOptionPath(currentScene, position.optionPath);
      if (decisionInfo) {
        returnStack.current.push({
          sceneLabel: position.sceneLabel,
          lineIndex: decisionInfo.decisionIndex + 1,
        });
      }
    } else {
      returnStack.current.push({
        sceneLabel: position.sceneLabel,
        lineIndex: position.lineIndex + 1,
      });
    }
  }, [currentScene, position, findDecisionForOptionPath]);

  const popReturnOrEnd = useCallback(() => {
    const next = returnStack.current.pop();
    if (next) {
      setPosition(next);
    } else {
      setIsEnded(true);
    }
  }, []);

  const cacheVariantIfNeeded = useCallback(
    (option: Option, variant?: string | null) => {
      if (!variant) return;
      ensureOptionHasVariant(option, variant);
      cacheVariant?.(option.id, variant);
    },
    [cacheVariant]
  );

  const appendNoSimilar = useCallback(() => {
    const entryId = `no-similar-${Date.now()}`;
    setHistory((prev) => [
      ...prev,
      { lineId: entryId, type: LineType.NARRATIVE, text: "No similar option." },
    ]);
    setIsEnded(true);
    setPendingDecisionId(null);
    setIsGenerating(false);
  }, []);

  // Select an option at a decision point (updates existing decision entry)
  const selectOption = useCallback(
    (
      option: Option,
      decisionId: string,
      prompt: string,
      selectionMeta?: { option: string; confidence?: number; cached?: boolean }
    ) => {
      const chosen = getOptionPrimaryText(option);
      setHistory((prev) => {
        const withoutMeta = prev.filter((entry) => entry.lineId !== `${decisionId}-using`);
        let updated = false;
        const next = withoutMeta.map((entry) => {
          if (entry.lineId === decisionId) {
            updated = true;
            return {
              ...entry,
              chosenOption: chosen,
              selectionMeta: selectionMeta ?? { option: chosen },
            };
          }
          return entry;
        });
        if (!updated) {
          next.push({
            lineId: decisionId,
            type: LineType.DECISION,
            text: prompt,
            chosenOption: chosen,
            selectionMeta: selectionMeta ?? { option: chosen },
          });
        }
        return next;
      });

      if (option.lines.length > 0) {
        // Enter the option's lines
        setPosition((prev) => ({
          ...prev,
          optionPath: { optionId: option.id, lineIndex: 0 },
        }));
      } else {
        // No lines in option, move past the decision
        setPosition((prev) => ({ ...prev, lineIndex: prev.lineIndex + 1 }));
      }
      setPendingDecisionId(null);
    },
    []
  );

  const processDecisionInput = useCallback(
    async (decisionLine: DecisionLine, input: string) => {
      const decisionId = decisionLine.id;
      const localMatch = findMatchingOption(decisionLine.options, input);
      if (localMatch) {
        cacheVariantIfNeeded(localMatch, input);
        selectOption(localMatch, decisionId, decisionLine.prompt, {
          option: getOptionPrimaryText(localMatch),
          cached: true,
        });
        return;
      }

      try {
        const grokMatch = await fetchGrokMatch(input, decisionLine.options);
        if (
          !grokMatch.optionId ||
          grokMatch.confidence < GROK_CONFIDENCE_THRESHOLD
        ) {
          appendNoSimilar();
          return;
        }

        const matched = decisionLine.options.find(
          (o) => o.id === grokMatch.optionId
        );
        if (!matched) {
          appendNoSimilar();
          return;
        }

        cacheVariantIfNeeded(matched, input);
        selectOption(
          matched,
          decisionId,
          decisionLine.prompt,
          {
            option: getOptionPrimaryText(matched),
            confidence: grokMatch.confidence,
          }
        );
      } catch (error) {
        if (
          typeof window !== "undefined" &&
          window.confirm("Matching failed. Try again?")
        ) {
          return processDecisionInput(decisionLine, input);
        }
        appendNoSimilar();
      }
      setIsGenerating(false);
    },
    [appendNoSimilar, cacheVariantIfNeeded, selectOption]
  );

  // Advance through the game
  // - For narrative/jump lines: auto-advances (no input needed)
  // - For decision lines: requires input to match against options (local or Grok)
  const advance = useCallback(
    async (input?: string) => {
      if (!currentScene || isEnded) return;

      if (!currentLine) {
        popReturnOrEnd();
        return;
      }

      // Handle decisions using the stored decision id so prompt stays frozen while options stay live
      if (pendingDecisionId || currentLine?.type === "decision") {
        const decisionId = pendingDecisionId ?? currentLine?.id;
        if (!decisionId) return;
        const decisionLine = findDecisionById(gameStructure, decisionId);
        if (!decisionLine) return;

        if (input) {
          setIsGenerating(true);
          await processDecisionInput(decisionLine, input);
          setIsGenerating(false);
        }
        return;
      }

      if (!currentLine) return;

      // Don't reprocess non-decision lines already in history
      if (seenLineIds.current.has(currentLine.id)) return;

      if (currentLine.type === "narrative") {
        seenLineIds.current.add(currentLine.id);
        setHistory((prev) => [
          ...prev,
          { lineId: currentLine.id, type: LineType.NARRATIVE, text: currentLine.text },
        ]);

        // Move to next line
        if (position.optionPath) {
          // Inside an option's lines
          const decision = currentScene.lines.find(
            (l) => l.type === "decision" && l.options.some((o) => o.id === position.optionPath!.optionId)
          );
          if (decision?.type === "decision") {
            const opt = decision.options.find((o) => o.id === position.optionPath!.optionId);
            if (opt && position.optionPath.lineIndex + 1 < opt.lines.length) {
              setPosition((prev) => ({
                ...prev,
                optionPath: { ...prev.optionPath!, lineIndex: prev.optionPath!.lineIndex + 1 },
              }));
            } else {
              // Done with option lines, move to next scene line after the decision
              const decisionIndex = currentScene.lines.indexOf(decision);
              setPosition((prev) => ({
                ...prev,
                lineIndex: decisionIndex + 1,
                optionPath: undefined,
              }));
            }
          }
        } else {
          setPosition((prev) => ({ ...prev, lineIndex: prev.lineIndex + 1 }));
        }
      } else if (currentLine.type === LineType.JUMP) {
        seenLineIds.current.add(currentLine.id);
        pushReturnAfterCurrent();

        if (currentLine.target === "END") {
          popReturnOrEnd();
        } else {
          handleJump(currentLine.target);
        }
      }
    },
    [
      currentLine,
      currentScene,
      isEnded,
      position,
      handleJump,
      processDecisionInput,
      popReturnOrEnd,
      pushReturnAfterCurrent,
    ]
  );

  const restart = useCallback(() => {
    setHistory([]);
    setPosition({ sceneLabel: gameStructure.startScene, lineIndex: 0 });
    setIsEnded(false);
    returnStack.current = [];
    seenLineIds.current = new Set();
    setPendingDecisionId(null);
  }, [gameStructure.startScene]);

  return {
    history,
    currentLine,
    currentScene,
    currentLineType,
    advance,
    restart,
    isGenerating,
  };
}

