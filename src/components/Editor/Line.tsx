"use client";

import { useRef, useState, useEffect, useMemo, KeyboardEvent } from "react";
import { useGameContext } from "../../context/GameContext";
import { EditorLine, detectPrefix } from "../../lib/notation";
import TypeIcon from "../Editor/TypeIcon";
import SlashMenu from "../Editor/SlashMenu";
import SceneMenu from "../Editor/SceneMenu";
import { twMerge } from "tailwind-merge";
import { getPrefix } from "./utils";
import { LineType } from "@/types";
import { formatOptionTexts, parseOptionTexts } from "@/lib/options";

export default function Line({
  line,
  isFocused,
  isSelected,
  focusLine,
}: {
  line: EditorLine;
  isFocused: boolean;
  isSelected: boolean;
  focusLine: (id: string) => void;
}) {
  const {
    updateLine,
    updateLineIndent,
    insertLineAfter,
    insertLineBefore,
    deleteLine,
    editorLines,
    gameStructure,
    triggerSceneJump,
  } = useGameContext();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [showSlash, setShowSlash] = useState(false);
  const [slashQuery, setSlashQuery] = useState("");
  const [selectedSceneIdx, setSelectedSceneIdx] = useState(0);
  const [optionDraft, setOptionDraft] = useState("");
  const cursorPositionRef = useRef<number | null>(null);

  const { type, content } = detectPrefix(line.text);
  const displayValue = type === LineType.OPTION ? optionDraft : content;
  const isJump = type === LineType.JUMP;

  const sceneNames = useMemo(
    () => gameStructure.scenes.map((s) => s.label),
    [gameStructure.scenes]
  );

  const filteredScenes = useMemo(() => {
    const q = content.trim().toLowerCase();
    if (!q) return sceneNames;
    return sceneNames.filter((name) => name.toLowerCase().includes(q));
  }, [sceneNames, content]);

  const hasExactScene = useMemo(() => {
    const q = content.trim().toLowerCase();
    if (!q) return true;
    return sceneNames.some((name) => name.toLowerCase() === q);
  }, [sceneNames, content]);

  useEffect(() => {
    if (isFocused && inputRef.current) {
      inputRef.current.focus();

      // Set cursor position if specified (e.g., after join operation)
      if (cursorPositionRef.current !== null) {
        const pos = cursorPositionRef.current;
        cursorPositionRef.current = null;
        setTimeout(() => {
          if (inputRef.current) {
            inputRef.current.setSelectionRange(pos, pos);
          }
        }, 0);
      }
    }
  }, [isFocused]);

  // Keep textarea height snug to its content so long lines stay visible
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [displayValue]);

  useEffect(() => {
    if (isJump) {
      setSelectedSceneIdx(0);
    }
  }, [content, isJump]);

  useEffect(() => {
    if (type === LineType.OPTION) {
      setOptionDraft(content);
    }
  }, [type, content]);

  // Handle content changes - preserve prefix, update content
  const handleContentChange = (newContent: string) => {
    // Check for slash command
    if (newContent.startsWith("/")) {
      setShowSlash(true);
      setSlashQuery(newContent);
      updateLine(line.id, getPrefix(type) + newContent);
      return;
    }

    setShowSlash(false);

    // Auto-parse if content starts with special characters
    if (newContent.length >= 2) {
      const prefix = newContent.slice(0, 2);
      if (
        prefix === "- " ||
        prefix === "? " ||
        prefix === "* " ||
        prefix === "! " ||
        prefix === "# " ||
        prefix === "↗ "
      ) {
        // User is typing a special prefix, update the whole line
        updateLine(line.id, newContent);
        return;
      }
    }

    if (type === LineType.OPTION) {
      setOptionDraft(newContent);
      updateLine(line.id, getPrefix(type) + newContent);
      return;
    }

    if (type === LineType.PROMPT) {
      updateLine(line.id, `! ${newContent}`);
      return;
    }

    updateLine(line.id, getPrefix(type) + newContent);
  };

  const handleBlur = () => {
    if (type !== LineType.OPTION) return;
    const parsed = parseOptionTexts(optionDraft || content);
    const formatted = formatOptionTexts(parsed);
    updateLine(line.id, `${getPrefix(LineType.OPTION)}${formatted}`);
    setOptionDraft(formatted);
  };

  const handleSceneSelect = (scene: string) => {
    updateLine(line.id, getPrefix(LineType.JUMP) + scene);
    setSelectedSceneIdx(0);
    inputRef.current?.focus();
  };

  const handleSlashSelect = (prefix: string) => {
    setShowSlash(false);
    if (prefix) {
      updateLine(line.id, prefix);
      inputRef.current?.focus();
    } else {
      // Cancelled - remove the slash
      updateLine(line.id, getPrefix(type));
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (
      showSlash &&
      ["ArrowUp", "ArrowDown", "Enter", "Escape"].includes(e.key)
    ) {
      return;
    }

    const navigationKeys = ["ArrowUp", "ArrowDown", "Enter", "Escape"];

    if (isJump && filteredScenes.length > 0 && navigationKeys.includes(e.key)) {
      e.preventDefault();
      if (e.key === "ArrowDown") {
        setSelectedSceneIdx((s) => Math.min(s + 1, filteredScenes.length - 1));
      } else if (e.key === "ArrowUp") {
        setSelectedSceneIdx((s) => Math.max(s - 1, 0));
      } else if (e.key === "Enter") {
        // Only select if user has actively picked an item; otherwise allow normal flow
        if (selectedSceneIdx >= 0 && selectedSceneIdx < filteredScenes.length) {
          handleSceneSelect(
            filteredScenes[selectedSceneIdx] ?? filteredScenes[0]
          );
          return;
        }
      } else if (e.key === "Escape") {
        setShowSlash(false);
      }
      // For Enter without a valid selection, fall through to default handling below
    }

    if (e.key === "Enter") {
      e.preventDefault();
      const cursorPosition = inputRef.current?.selectionStart ?? 0;

      if (cursorPosition === 0) {
        // At start of line: insert new line above current line
        const newId = insertLineBefore(line.id, "- ", line.indent);
        setTimeout(() => focusLine(newId), 0);
      } else if (cursorPosition < displayValue.length) {
        // In middle of text: split the text
        const beforeCursor = displayValue.slice(0, cursorPosition);
        const afterCursor = displayValue.slice(cursorPosition);

        // Update current line with text before cursor
        updateLine(line.id, getPrefix(type) + beforeCursor);

        // Create new line with text after cursor
        const newId = insertLineAfter(
          line.id,
          getPrefix(type) + afterCursor,
          line.indent
        );
        setTimeout(() => focusLine(newId), 0);
      } else {
        // At end of line: insert new line below
        const newId = insertLineAfter(line.id, "- ", line.indent);
        setTimeout(() => focusLine(newId), 0);
      }
    }

    if (e.key === "Tab") {
      e.preventDefault();
      if (e.shiftKey) {
        updateLineIndent(line.id, line.indent - 1);
      } else {
        updateLineIndent(line.id, line.indent + 1);
      }
    }

    if (e.key === "Backspace") {
      const cursorPosition = inputRef.current?.selectionStart ?? 0;

      if (cursorPosition === 0) {
        e.preventDefault();
        const idx = editorLines.findIndex((l) => l.id === line.id);

        if (idx > 0) {
          const prevLine = editorLines[idx - 1];
          const { type: prevType, content: prevContent } = detectPrefix(
            prevLine.text
          );

          if (content === "") {
            // Empty line: just delete it
            deleteLine(line.id);
            setTimeout(() => focusLine(prevLine.id), 0);
          } else {
            // Join current line's content with previous line
            // If previous line is empty, use current line's type instead
            const joinType = prevContent === "" ? type : prevType;
            const joinedContent = prevContent + content;
            updateLine(prevLine.id, getPrefix(joinType) + joinedContent);
            deleteLine(line.id);

            // Store cursor position at join point for the previous line
            const prevLineElement = editorLines[idx - 1];
            if (prevLineElement) {
              // We need to communicate the cursor position to the previous line
              // Use a temporary data attribute or event
              setTimeout(() => {
                focusLine(prevLine.id);
                // Set cursor position via DOM after focus
                setTimeout(() => {
                  const textarea = document.querySelector(
                    `textarea[data-line-id="${prevLine.id}"]`
                  ) as HTMLTextAreaElement;
                  if (textarea) {
                    textarea.setSelectionRange(
                      prevContent.length,
                      prevContent.length
                    );
                  }
                }, 0);
              }, 0);
            }
          }
        }
      }
    }

    if (e.key === "ArrowUp") {
      const idx = editorLines.findIndex((l) => l.id === line.id);
      if (idx > 0) {
        e.preventDefault();
        focusLine(editorLines[idx - 1].id);
      }
    }

    if (e.key === "ArrowDown") {
      const idx = editorLines.findIndex((l) => l.id === line.id);
      if (idx < editorLines.length - 1) {
        e.preventDefault();
        focusLine(editorLines[idx + 1].id);
      }
    }
  };

  return (
    <div className="group relative">
      <div
        className={twMerge(
          "flex items-center gap-1 py-0.5 hover:bg-gray-50",
          isSelected && "bg-blue-100"
        )}
        style={{ paddingLeft: line.indent * 20 }}
      >
        <TypeIcon
          type={type}
          onClick={
            type === LineType.SCENE
              ? () => triggerSceneJump(content)
              : type === LineType.PROMPT
              ? () => {
                  // Could add tooltip or highlight functionality here
                  console.log("Prompt:", content);
                }
              : undefined
          }
        />
        <textarea
          ref={inputRef}
          data-line-id={`${line.id}-${line.indent}`}
          value={displayValue}
          onChange={(e) => handleContentChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => focusLine(line.id)}
          placeholder={isFocused ? "Type / for commands..." : ""}
          className={twMerge(
            "flex-1 bg-transparent outline-none text-sm py-0.5 whitespace-pre-wrap break-words resize-none leading-relaxed",
            type === LineType.SCENE
              ? "font-semibold"
              : type === LineType.DECISION
              ? "italic"
              : type === LineType.PROMPT
              ? "text-purple-600 font-medium italic"
              : ""
          )}
          rows={1}
          spellCheck={false}
        />
      </div>
      {showSlash && (
        <SlashMenu query={slashQuery} onSelect={handleSlashSelect} />
      )}
      {isJump &&
        isFocused &&
        (content.trim().length === 0 || !hasExactScene) && (
          <SceneMenu
            scenes={filteredScenes}
            selectedIndex={selectedSceneIdx}
            onHover={setSelectedSceneIdx}
            onSelect={handleSceneSelect}
            leftOffset={line.indent * 20 + 24}
          />
        )}
    </div>
  );
}
