import { useRef, useState, useEffect, useMemo, KeyboardEvent } from "react";
import { useGameContext } from "../../context/GameContext";
import { EditorLine, detectPrefix } from "../../lib/notation";
import TypeIcon from "../Editor/TypeIcon";
import SlashMenu from "../Editor/SlashMenu";
import SceneMenu from "../Editor/SceneMenu";
import { twMerge } from "tailwind-merge";
import { getPrefix } from "./utils";
import { LineType } from "@/types";

export default function Line({
  line,
  isFocused,
  focusLine,
}: {
  line: EditorLine;
  isFocused: boolean;
  focusLine: (id: string) => void;
}) {
  const {
    updateLine,
    updateLineIndent,
    insertLineAfter,
    deleteLine,
    editorLines,
    gameStructure,
  } = useGameContext();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [showSlash, setShowSlash] = useState(false);
  const [slashQuery, setSlashQuery] = useState("");
  const [selectedSceneIdx, setSelectedSceneIdx] = useState(0);

  const { type, content } = detectPrefix(line.text);
  const displayValue = type === "scene" ? content.replace(/:$/, "") : content;
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

  // Handle content changes - preserve prefix, update content
  const handleContentChange = (newContent: string) => {
    // Check for slash command
    if (newContent.startsWith("/")) {
      setShowSlash(true);
      setSlashQuery(newContent);
      updateLine(line.id, getPrefix(type) + newContent);
    } else {
      setShowSlash(false);
      // Scene labels need special handling (no prefix, ends with :)
      if (type === "scene") {
        updateLine(line.id, newContent + (newContent.endsWith(":") ? "" : ":"));
      } else {
        updateLine(line.id, getPrefix(type) + newContent);
      }
    }
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
        handleSceneSelect(
          filteredScenes[selectedSceneIdx] ?? filteredScenes[0]
        );
      }
      return;
    }

    if (e.key === "Enter") {
      e.preventDefault();
      const newId = insertLineAfter(line.id, "- ", line.indent);
      setTimeout(() => focusLine(newId), 0);
    }

    if (e.key === "Tab") {
      e.preventDefault();
      if (e.shiftKey) {
        updateLineIndent(line.id, line.indent - 1);
      } else {
        updateLineIndent(line.id, line.indent + 1);
      }
    }

    if (e.key === "Backspace" && content === "") {
      e.preventDefault();
      const idx = editorLines.findIndex((l) => l.id === line.id);
      if (idx > 0) {
        const prevLine = editorLines[idx - 1];
        deleteLine(line.id);
        setTimeout(() => focusLine(prevLine.id), 0);
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
        className="flex items-center gap-1 py-0.5 hover:bg-gray-50"
        style={{ paddingLeft: line.indent * 20 }}
      >
        <TypeIcon type={type} />
        <textarea
          ref={inputRef}
          value={displayValue}
          onChange={(e) => handleContentChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => focusLine(line.id)}
          placeholder={isFocused ? "Type / for commands..." : ""}
          className={twMerge(
            "flex-1 bg-transparent outline-none text-sm py-0.5 whitespace-pre-wrap break-words resize-none leading-relaxed",
            type === "scene"
              ? "font-semibold"
              : type === "decision"
              ? "italic"
              : "",
            isJump && !hasExactScene && content.trim().length > 0
              ? "text-red-500"
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
