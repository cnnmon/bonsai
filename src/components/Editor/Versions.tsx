"use client";

import { useState } from "react";
import { useGameContext } from "../../context/GameContext";

interface VersionsProps {
  onClose: () => void;
}

export default function Versions({ onClose }: VersionsProps) {
  const { versionLog, saveVersion, revertVersion, deleteVersion, editorLines } =
    useGameContext();
  const [versionLabel, setVersionLabel] = useState("");

  const sortedVersions = [...versionLog].sort(
    (a, b) => b.createdAt - a.createdAt
  );

  const handleSaveVersion = () => {
    saveVersion(versionLabel);
    setVersionLabel("");
  };

  const handleRevert = (id: string) => {
    revertVersion(id);
    onClose();
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("Delete this version?")) {
      deleteVersion(id);
    }
  };

  const copyToClipboard = () => {
    const text = JSON.stringify(editorLines);
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="absolute inset-0 bg-black/30 flex items-start justify-center p-4 z-10">
      <div className="bg-white border-2 border-gray-800 w-full max-w-2xl flex flex-col max-h-[80vh] shadow-[4px_4px_0px_0px_rgba(0,0,0,0.25)]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2 bg-gray-200 border-b-2 border-gray-800">
          <div className="text-sm font-bold text-gray-900">Version History</div>
          <button
            onClick={onClose}
            className="w-6 h-6 flex items-center justify-center border-2 border-gray-800 bg-white hover:bg-gray-100 font-bold text-gray-800"
          >
            ×
          </button>
        </div>

        {/* Save new version */}
        <div className="px-4 py-3 border-b border-gray-300 bg-gray-50">
          <div className="flex gap-2">
            <input
              value={versionLabel}
              onChange={(e) => setVersionLabel(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSaveVersion()}
              placeholder="Enter version name..."
              className="flex-1 border-2 border-gray-800 px-3 py-1.5 text-sm focus:outline-none"
            />
            <button
              onClick={copyToClipboard}
              className="px-3 py-1.5 text-sm border-2 border-gray-800 bg-white hover:bg-gray-100"
            >
              Copy JSON
            </button>
            <button
              onClick={handleSaveVersion}
              className="px-4 py-1.5 text-sm border-2 border-gray-800 bg-gray-800 text-white hover:bg-gray-700"
            >
              Save
            </button>
          </div>
        </div>

        {/* Version list */}
        <div className="flex-1 overflow-auto bg-white">
          {sortedVersions.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-gray-500">
              No versions saved yet
            </div>
          ) : (
            <div>
              {sortedVersions.map((version) => (
                <div
                  key={version.id}
                  className="px-4 py-2.5 hover:bg-gray-100 group cursor-pointer border-b border-gray-200"
                  onClick={() => handleRevert(version.id)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900 truncate">
                        {version.label}
                      </div>
                      <div className="text-xs text-gray-600 mt-0.5">
                        {new Date(version.createdAt).toLocaleString()}
                      </div>
                    </div>
                    <div className="flex gap-1.5 opacity-0 group-hover:opacity-100">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRevert(version.id);
                        }}
                        className="px-2 py-1 text-xs border border-gray-800 bg-white hover:bg-gray-100"
                      >
                        Restore
                      </button>
                      <button
                        onClick={(e) => handleDelete(version.id, e)}
                        className="px-2 py-1 text-xs border border-gray-800 bg-white hover:bg-gray-100"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
