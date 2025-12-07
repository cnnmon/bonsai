"use client";
import { useEffect, useState } from "react";
import Editor from "../components/Editor";
import Game from "../components/Game";
import { GameProvider } from "../context/GameContext";

function Container({ children }: { children: React.ReactElement }) {
  return (
    <div
      className="flex w-full p-2 bg-zinc-100 h-full"
      style={{
        border: "2.5px solid #c0c0c0",
        borderRight: "2.5px solid #fff",
        borderBottom: "2.5px solid #fff",
        borderLeft: "2.5px solid #808080",
        borderTop: "2.5px solid #808080",
      }}
    >
      {children}
    </div>
  );
}

export default function Home() {
  const [borderLocation, setBorderLocation] = useState(50); // percentage
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    if (!dragging) return;
    const handleMove = (e: MouseEvent) => {
      const pct = (e.clientX / window.innerWidth) * 100;
      if (pct < 5) {
        setBorderLocation(0);
      } else if (pct > 95) {
        setBorderLocation(100);
      } else {
        setBorderLocation(pct);
      }
    };
    const stop = () => setDragging(false);
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", stop);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", stop);
    };
  }, [dragging]);

  const leftStyle = { width: `${borderLocation}%` };
  const rightStyle = { width: `${100 - borderLocation}%` };
  return (
    <GameProvider>
      <div className="flex min-h-screen h-full w-full relative">
        <div style={leftStyle}>
          <Container>
            <Editor />
          </Container>
        </div>

        <div
          className="w-1 flex-shrink-0 bg-gray-300 hover:bg-gray-400 cursor-col-resize select-none"
          onMouseDown={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          role="separator"
          aria-label="Resize panels"
        />

        <div style={rightStyle}>
          <Container>
            <Game />
          </Container>
        </div>
      </div>
    </GameProvider>
  );
}
