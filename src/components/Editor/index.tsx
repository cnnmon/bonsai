"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import { useGameContext } from "../../context/GameContext";
import Line from "./Line";

export default function Editor() {
  const {
    editorLines,
    versionLog,
    saveVersion,
    revertVersion,
    deleteLine,
    updateLine,
  } = useGameContext();

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [showVersions, setShowVersions] = useState(false);
  const [versionLabel, setVersionLabel] = useState("");
  const [selectedLineIds, setSelectedLineIds] = useState<Set<string>>(
    new Set()
  );

  const focusLine = useCallback((id: string) => {
    setFocusedId(id);
    setSelectedLineIds(new Set()); // Clear selection when focusing a line
  }, []);

  const sortedVersions = useMemo(
    () => [...versionLog].sort((a, b) => b.createdAt - a.createdAt),
    [versionLog]
  );

  const handleSaveVersion = useCallback(() => {
    saveVersion(versionLabel);
    setVersionLabel("");
  }, [saveVersion, versionLabel]);

  const handleRevert = useCallback(
    (id: string) => {
      revertVersion(id);
      setShowVersions(false);
    },
    [revertVersion]
  );

  const copyToClipboard = useCallback(() => {
    const text = JSON.stringify(editorLines);
    navigator.clipboard.writeText(text);
  }, [versionLog]);

  // Handle Ctrl+A / Cmd+A to select all lines
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check for Ctrl+A (Windows/Linux) or Cmd+A (Mac)
      if ((e.ctrlKey || e.metaKey) && e.key === "a") {
        const target = e.target as HTMLElement;
        // Only intercept if not inside a textarea
        if (target.tagName !== "TEXTAREA" && target.tagName !== "INPUT") {
          e.preventDefault();
          const allIds = new Set(editorLines.map((line) => line.id));
          setSelectedLineIds(allIds);
        }
      }

      // Handle Delete or Backspace to delete selected lines
      if (
        (e.key === "Delete" || e.key === "Backspace") &&
        selectedLineIds.size > 0
      ) {
        const target = e.target as HTMLElement;
        if (target.tagName !== "TEXTAREA" && target.tagName !== "INPUT") {
          e.preventDefault();

          // If deleting all lines, leave one narrative line
          if (selectedLineIds.size === editorLines.length) {
            // Delete all but the first
            const firstLineId = editorLines[0]?.id;
            selectedLineIds.forEach((id) => {
              if (id !== firstLineId) {
                deleteLine(id);
              }
            });
            // Update the first line to be an empty narrative
            if (firstLineId) {
              updateLine(firstLineId, "- ");
            }
          } else {
            selectedLineIds.forEach((id) => deleteLine(id));
          }
          setSelectedLineIds(new Set());
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [editorLines, selectedLineIds, deleteLine, updateLine]);

  if (!mounted) {
    return null;
  }

  return (
    <div className="flex flex-col w-full p-2 overflow-auto min-h-[300px] relative">
      <div className="flex justify-between items-center">
        <div className="text-xs font-bold text-gray-500 uppercase mb-2">
          Editor
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowVersions(true)}>Versions</button>
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
            isSelected={selectedLineIds.has(line.id)}
            focusLine={focusLine}
          />
        ))}
      </div>

      {showVersions && (
        <div className="absolute inset-0 bg-black/30 flex items-start justify-center p-2">
          <div className="bg-white shadow-md rounded w-full max-w-lg p-3 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="font-semibold text-sm">Versions</div>
              <button onClick={() => setShowVersions(false)}>Close</button>
            </div>

            <div className="flex gap-2">
              <input
                value={versionLabel}
                onChange={(e) => setVersionLabel(e.target.value)}
                placeholder="Label (optional)"
                className="w-full border px-2 py-1 text-sm"
              />
              <button onClick={copyToClipboard}>Copy</button>
              <button onClick={handleSaveVersion}>Save</button>
            </div>

            <div className="flex flex-col gap-2 max-h-64 overflow-auto">
              {sortedVersions.length === 0 && (
                <div className="text-xs text-gray-500">
                  No versions saved yet.
                </div>
              )}
              {sortedVersions.map((version) => (
                <div
                  key={version.id}
                  className="border rounded px-2 py-2 flex items-center justify-between"
                >
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold">
                      {version.label}
                    </span>
                    <span className="text-xs text-gray-500">
                      {new Date(version.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => handleRevert(version.id)}>
                      Revert
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
