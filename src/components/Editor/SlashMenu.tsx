"use client";

import { useState, useEffect } from "react";
import { SLASH_COMMANDS } from "../../lib/notation";
import TypeIcon from "../Editor/TypeIcon";
import { LineType } from "@/types";

export default function SlashMenu({
  query,
  onSelect,
}: {
  query: string;
  onSelect: (prefix: string) => void;
}) {
  const filtered = SLASH_COMMANDS.filter(
    (cmd) =>
      cmd.trigger.toLowerCase().includes(query.toLowerCase()) ||
      cmd.label.toLowerCase().includes(query.toLowerCase())
  );
  const [selected, setSelected] = useState(0);

  useEffect(() => {
    setSelected(0);
  }, [query]);

  useEffect(() => {
    const handleKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelected((s) => Math.min(s + 1, filtered.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelected((s) => Math.max(s - 1, 0));
      } else if (e.key === "Enter" && filtered[selected]) {
        e.preventDefault();
        onSelect(filtered[selected].prefix);
      } else if (e.key === "Escape") {
        onSelect("");
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [filtered, selected, onSelect]);

  if (filtered.length === 0) return null;

  return (
    <div className="absolute left-4 top-6 z-[1] bg-white border border-gray-200 shadow-lg text-sm rounded">
      {filtered.map((cmd, i) => (
        <div
          key={cmd.trigger}
          className={`px-3 py-1.5 cursor-pointer flex items-center gap-2 ${
            i === selected ? "bg-gray-100" : "hover:bg-gray-50"
          }`}
          onClick={() => onSelect(cmd.prefix)}
        >
          <TypeIcon type={cmd.trigger.slice(1) as LineType} />
          <span>{cmd.label}</span>
          <span className="text-gray-400 text-xs ml-auto">
            {cmd.description}
          </span>
        </div>
      ))}
    </div>
  );
}
