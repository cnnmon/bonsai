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
import { fetchBranchGeneration } from "../lib/branchGeneration";
import {
  createJumpLine,
  createOption,
  createNarrativeLine,
  generateId,
} from "../components/Editor/utils";
import { detectPrefix } from "@/lib/notation";
function makeSceneLabel(input: string, prompt: string): string {
  const base = `${input} ${prompt}`.trim() || "branch";
  const cleaned = base
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_")
    .slice(0, 24);
  const candidate = cleaned && cleaned !== "END" ? cleaned : "";
  return candidate || `BRANCH_${generateId().toUpperCase()}`;
}


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

type GenerationStatus = "idle" | "matching" | "generating";

export function useGame(
  gameStructure: GameStructure,
  opts?: {
    onCacheOptionVariant?: (optionId: string, variant: string) => void;
    onBranchGenerated?: (payload: {
      decisionId: string;
      option: Option;
      newScene?: Scene;
      userInput: string;
    }) => void;
    onAppendSceneLine?: (sceneLabel: string, line: { text: string; indent: number }) => void;
  }
): {
  history: HistoryEntry[];
  currentLine: Line | null;
  currentScene: Scene | null;
  currentLineType: LineType | null;
  advance: (input?: string) => Promise<void>;
  restart: () => void;
  generationStatus: GenerationStatus;
  jumpToScene: (sceneLabel: string) => void;
  parseErrorDecisionId: string | null;
  retryParseError: () => Promise<void>;
} {
  // Find the first non-prompt line index in the start scene
  const getStartLineIndex = useCallback((structure: GameStructure) => {
    const startScene = structure.scenes.find(s => s.label === structure.startScene);
    if (!startScene) return 0;
    
    // Skip over global prompts at the beginning
    let index = 0;
    while (index < startScene.lines.length && startScene.lines[index].type === LineType.PROMPT) {
      index++;
    }
    return index;
  }, []);

  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [position, setPosition] = useState<GamePosition>(() => ({
    sceneLabel: gameStructure.startScene,
    lineIndex: getStartLineIndex(gameStructure),
  }));
  const [isEnded, setIsEnded] = useState(false);
  const [generationStatus, setGenerationStatus] = useState<GenerationStatus>("idle");
  // Track jumps so we can return to the originating scene after visiting another
  const returnStack = useRef<GamePosition[]>([]);
  // Track which line ids have already been appended to history so edits don't replay them
  const seenLineIds = useRef<Set<string>>(new Set());
  // Track the active decision awaiting input (by id) so prompt stays frozen while options stay live
  const [pendingDecisionId, setPendingDecisionId] = useState<string | null>(null);
  const [branchParseError, setBranchParseError] = useState<{
    decisionId: string;
    input: string;
  } | null>(null);
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

  // Get global prompts (those before any scene)
  const globalPrompts = useMemo(() => {
    const prompts: string[] = [];
    for (const scene of gameStructure.scenes) {
      if (scene.label === gameStructure.startScene) {
        for (const line of scene.lines) {
          if (line.type === LineType.PROMPT) {
            prompts.push(line.text);
          } else {
            break;
          }
        }
        break;
      }
    }
    console.log("[useGame] Global prompts extracted:", prompts);
    return prompts;
  }, [gameStructure]);

  // Track accumulated prompts (global + current scene path)
  const [accumulatedPrompts, setAccumulatedPrompts] = useState<string[]>(globalPrompts);

  // Initialize accumulated prompts with global prompts on mount/structure change
  useEffect(() => {
    console.log("[useGame] Initializing accumulated prompts with global:", globalPrompts);
    setAccumulatedPrompts(globalPrompts);
  }, [globalPrompts]);

  // Handle jump to scene
  const handleJump = useCallback((target: string) => {
    setPosition({ sceneLabel: target, lineIndex: 0 });
    // Clear seen line IDs to allow lines to be replayed when cycling back to a scene
    seenLineIds.current.clear();
    // Reset to global prompts when leaving scene
    setAccumulatedPrompts(globalPrompts);
  }, [globalPrompts]);

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
    setGenerationStatus("idle");
  }, []);

  // Select an option at a decision point (updates existing decision entry)
  const selectOption = useCallback(
    (
      option: Option,
      decisionId: string,
      prompt: string,
      selectionMeta?: {
        option: string;
        confidence?: number;
        cached?: boolean;
        generated?: boolean;
      }
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

  const toEditorLine = useCallback((raw: string): { indent: number; text: string } => {
    const match = raw.match(/^(\s*)(.*)$/);
    const leading = match?.[1] ?? "";
    const content = match?.[2] ?? "";
    const indent = Math.floor(leading.replace(/\t/g, "  ").length / 2);
    return { indent, text: content };
  }, []);

  const generateBranch = useCallback(
    async (decisionLine: DecisionLine, input: string) => {
      setGenerationStatus("generating");
      try {
        const trimmedInput = input.trim();
        if (!trimmedInput || !decisionLine.prompt.trim()) {
          console.warn("[grok] Missing required fields for branch generation", {
            hasInput: Boolean(trimmedInput),
            hasPrompt: Boolean(decisionLine.prompt.trim()),
            optionsCount: decisionLine.options.length,
          });
          appendNoSimilar();
          return;
        }

        const customPrompt = accumulatedPrompts.length > 0 
          ? accumulatedPrompts.join("\n") 
          : undefined;

        console.log("[useGame] Accumulated prompts:", accumulatedPrompts);
        console.log("[useGame] Sending customPrompt:", customPrompt);

        const content = await fetchBranchGeneration({
          input: trimmedInput,
          decisionPrompt: decisionLine.prompt,
          options: decisionLine.options.map((o) => ({ id: o.id, texts: o.texts })),
          sceneLabel: currentScene?.label ?? "",
          existingScenes: gameStructure.scenes.map((s) => s.label),
          history: history.map((h) => h.text),
          newSceneLabel: makeSceneLabel(trimmedInput, decisionLine.prompt),
          customPrompt,
        });
        setBranchParseError(null);

        const parsedJson =
          content &&
          (content.type === "paragraph" ||
            content.type === "new_scene" ||
            content.type === "existing_scene" ||
            content.type === "parse_error")
            ? content
            : null;

        const optionText = trimmedInput || "New path";
        let targetSceneLabel =
          currentScene?.label || makeSceneLabel(trimmedInput, decisionLine.prompt);

        if (!parsedJson || parsedJson.type === "parse_error") {
          setBranchParseError({ decisionId: decisionLine.id, input });
          // Legacy path: parse notation text
          const lines = content
            .toString()
            .split(/\r?\n/)
            .map((ln: string) => ln.replace(/\s+$/, ""));

          const parsed = lines
            .map((line: string) => {
              const { indent, text } = toEditorLine(line);
              const detected = detectPrefix(text);
              return { raw: line, indent, text, ...detected };
            })
            .filter((p: any) => p.text.trim().length > 0);

          for (let i = 1; i < parsed.length; i++) {
            const current = parsed[i];
            const prev = parsed[i - 1];
            const prevIsOption = prev?.type === LineType.OPTION;
            const needsNesting =
              prevIsOption &&
              (current.type === LineType.NARRATIVE || current.type === LineType.PROMPT) &&
              current.indent <= prev.indent;
            if (needsNesting) {
              parsed[i] = { ...current, indent: prev.indent + 1 };
            }
          }

          const sceneLine = parsed.find(
            (p: any) => p.type === LineType.SCENE && p.content
          );
          const jumpLine = parsed.find(
            (p: any) => p.type === LineType.JUMP && p.content
          );

          targetSceneLabel =
            sceneLine?.content ||
            jumpLine?.content ||
            currentScene?.label ||
            makeSceneLabel(trimmedInput, decisionLine.prompt);

          const option = sceneLine
            ? createOption([optionText], [createJumpLine(sceneLine.content)])
            : jumpLine
            ? createOption([optionText], [createJumpLine(jumpLine.content)])
            : createOption([optionText], []);

          opts?.onBranchGenerated?.({
            decisionId: decisionLine.id,
            option,
            newScene: sceneLine ? { label: sceneLine.content, lines: [] } : undefined,
            userInput: input,
          });

          selectOption(option, decisionLine.id, decisionLine.prompt, {
            option: getOptionPrimaryText(option),
            generated: true,
          });

          for (const parsedLine of parsed) {
            const { indent, text, type, content } = parsedLine;
            if (type === LineType.SCENE) continue;
            if (type === LineType.JUMP && jumpLine && content === jumpLine.content)
              continue;
            opts?.onAppendSceneLine?.(targetSceneLabel, { text, indent });
          }
          return;
        }

        // JSON path
        if (parsedJson.type === "paragraph") {
          const text = parsedJson.text?.toString().trim();
          const question = parsedJson.question?.toString().trim();
          const optionLines = text ? [createNarrativeLine(text)] : [];
          const option = createOption([optionText], optionLines);
          opts?.onBranchGenerated?.({
            decisionId: decisionLine.id,
            option,
            userInput: input,
          });
          selectOption(option, decisionLine.id, decisionLine.prompt, {
            option: getOptionPrimaryText(option),
            generated: true,
          });
          if (question) {
            opts?.onAppendSceneLine?.(targetSceneLabel, { text: `? ${question}`, indent: 0 });
          }
          return;
        }

        if (parsedJson.type === "existing_scene") {
          const sceneLabel = parsedJson.sceneLabel?.toString().trim();
          if (!sceneLabel) {
            appendNoSimilar();
            return;
          }
          targetSceneLabel = sceneLabel;
          const option = createOption([optionText], [createJumpLine(sceneLabel)]);
          opts?.onBranchGenerated?.({
            decisionId: decisionLine.id,
            option,
            userInput: input,
          });
          selectOption(option, decisionLine.id, decisionLine.prompt, {
            option: getOptionPrimaryText(option),
            generated: true,
          });
          const paragraphs: string[] = Array.isArray(parsedJson.paragraphs)
            ? parsedJson.paragraphs
            : [];
          for (const p of paragraphs) {
            const t = p?.toString().trim();
            if (t) opts?.onAppendSceneLine?.(targetSceneLabel, { text: `- ${t}`, indent: 0 });
          }
          return;
        }

        if (parsedJson.type === "new_scene") {
          const sceneLabel = parsedJson.sceneLabel?.toString().trim();
          if (!sceneLabel) {
            appendNoSimilar();
            return;
          }
          targetSceneLabel = sceneLabel;
          const question = parsedJson.question?.toString().trim();
          const option = createOption([optionText], [createJumpLine(sceneLabel)]);
          opts?.onBranchGenerated?.({
            decisionId: decisionLine.id,
            option,
            newScene: { label: sceneLabel, lines: [] },
            userInput: input,
          });
          selectOption(option, decisionLine.id, decisionLine.prompt, {
            option: getOptionPrimaryText(option),
            generated: true,
          });
          const paragraphs: string[] = Array.isArray(parsedJson.paragraphs)
            ? parsedJson.paragraphs
            : [];
          for (const p of paragraphs) {
            const t = p?.toString().trim();
            if (t) opts?.onAppendSceneLine?.(targetSceneLabel, { text: `- ${t}`, indent: 0 });
          }
          if (question) {
            opts?.onAppendSceneLine?.(targetSceneLabel, { text: `? ${question}`, indent: 0 });
          }
          return;
        }

        // Unknown JSON shape fallback
        appendNoSimilar();
      } catch (error) {
        console.error("Branch generation failed", error);
        appendNoSimilar();
      } finally {
        setGenerationStatus("idle");
      }
    },
    [
      appendNoSimilar,
      cacheVariantIfNeeded,
      currentScene?.label,
      gameStructure.scenes,
      history,
      opts,
      selectOption,
      accumulatedPrompts,
      toEditorLine,
    ]
  );

  const processDecisionInput = useCallback(
    async (decisionLine: DecisionLine, input: string) => {
      const decisionId = decisionLine.id;
      setGenerationStatus("matching");
      const localMatch = findMatchingOption(decisionLine.options, input);
      if (localMatch) {
        cacheVariantIfNeeded(localMatch, input);
        selectOption(localMatch, decisionId, decisionLine.prompt, {
          option: getOptionPrimaryText(localMatch),
          cached: true,
        });
        setGenerationStatus("idle");
        return;
      }

      try {
        const grokMatch = await fetchGrokMatch(input, decisionLine.options);
        if (
          !grokMatch.optionId ||
          grokMatch.confidence < GROK_CONFIDENCE_THRESHOLD
        ) {
          await generateBranch(decisionLine, input);
          setGenerationStatus("idle");
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
        setGenerationStatus("idle");
      } catch (error) {
        await generateBranch(decisionLine, input);
      }
    },
    [appendNoSimilar, cacheVariantIfNeeded, generateBranch, selectOption]
  );

  // Advance through the game
  // - For narrative/jump lines: auto-advances (no input needed)
  // - For decision lines: requires input to match against options (local or Grok)
  const advance = useCallback(
    async (input?: string) => {
      if (!currentScene || isEnded) {
        console.log("No current scene or ended, popping return or ending");
        return;
      };

      if (!currentLine) {
        // Check if we're at the end of an option's lines
        if (position.optionPath) {
          const decision = currentScene.lines.find(
            (l) => l.type === "decision" && l.options.some((o) => o.id === position.optionPath!.optionId)
          );
          if (decision?.type === "decision") {
            // Exit the option and continue with the line after the decision
            const decisionIndex = currentScene.lines.indexOf(decision);
            setPosition({
              sceneLabel: position.sceneLabel,
              lineIndex: decisionIndex + 1,
              optionPath: undefined,
            });
            return;
          }
        }
        console.log("No current line, popping return or ending");
        popReturnOrEnd();
        return;
      }

      // Handle decisions using the stored decision id so prompt stays frozen while options stay live
      if (pendingDecisionId || currentLine?.type === "decision") {
        const decisionId = pendingDecisionId ?? currentLine?.id;
        if (!decisionId) {
          console.log("No decision id, returning");
          return;
        }
        const decisionLine = findDecisionById(gameStructure, decisionId);
        if (!decisionLine) return;

        if (input) {
          await processDecisionInput(decisionLine, input);
        }

        console.log("Processed decision input, returning");
        return;
      }

      // Don't reprocess non-decision lines already in history
      if (seenLineIds.current.has(currentLine.id)) {
        console.log("Already seen line, returning");
        return;
      }

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
      } else if (currentLine.type === LineType.PROMPT) {
        // Accumulate prompt and auto-advance
        seenLineIds.current.add(currentLine.id);
        setAccumulatedPrompts((prev) => [...prev, currentLine.text]);

        // Move to next line
        if (position.optionPath) {
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

        if (currentLine.target === "END") {
          setHistory((prev) => [
            ...prev,
            { lineId: `end-${Date.now()}`, type: LineType.NARRATIVE, text: "END" },
          ]);
          setIsEnded(true);
        } else {
          pushReturnAfterCurrent();
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
    setPosition({ 
      sceneLabel: gameStructure.startScene, 
      lineIndex: getStartLineIndex(gameStructure) 
    });
    setIsEnded(false);
    returnStack.current = [];
    seenLineIds.current = new Set();
    setPendingDecisionId(null);
    setGenerationStatus("idle");
    setAccumulatedPrompts(globalPrompts);
    setBranchParseError(null);
  }, [gameStructure, globalPrompts, getStartLineIndex]);

  const jumpToScene = useCallback(
    (sceneLabel: string) => {
      setHistory([]);
      // When jumping to a scene, start at line 0 (we only skip prompts on game start)
      setPosition({ sceneLabel, lineIndex: 0 });
      setIsEnded(false);
      returnStack.current = [];
      seenLineIds.current = new Set();
      setPendingDecisionId(null);
      setGenerationStatus("idle");
      setAccumulatedPrompts(globalPrompts);
      setBranchParseError(null);
    },
    [globalPrompts]
  );

  const retryParseError = useCallback(async () => {
    if (!branchParseError) return;
    const decision = findDecisionById(gameStructure, branchParseError.decisionId);
    if (!decision) {
      setBranchParseError(null);
      return;
    }
    await generateBranch(decision, branchParseError.input);
  }, [branchParseError, gameStructure, generateBranch]);

  return {
    history,
    currentLine,
    currentScene,
    currentLineType,
    advance,
    restart,
    generationStatus,
    jumpToScene,
    parseErrorDecisionId: branchParseError?.decisionId ?? null,
    retryParseError,
  };
}

