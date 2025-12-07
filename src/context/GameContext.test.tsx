import React, { useEffect } from "react";
import { describe, it, expect } from "vitest";
import { act, render, waitFor } from "@testing-library/react";
import { GameProvider, useGameContext } from "./GameContext";
import { createOption } from "../components/Editor/utils";

function Harness({
  onReady,
  onUpdate,
}: {
  onReady: (ctx: ReturnType<typeof useGameContext>) => void;
  onUpdate: (ctx: ReturnType<typeof useGameContext>) => void;
}) {
  const ctx = useGameContext();

  useEffect(() => {
    onReady(ctx);
  }, [ctx, onReady]);

  useEffect(() => {
    onUpdate(ctx);
  }, [ctx, ctx.editorLines, onUpdate]);

  return null;
}

describe("GameContext - generated scene append", () => {
  it("adds a hash scene header so generated content can append to the new scene", async () => {
    let ctx: ReturnType<typeof useGameContext> | null = null;
    const updates: ReturnType<typeof useGameContext>["editorLines"][] = [];

    render(
      <GameProvider>
        <Harness
          onReady={(c) => {
            ctx = c;
          }}
          onUpdate={(c) => {
            updates.push(c.editorLines);
          }}
        />
      </GameProvider>
    );

    await waitFor(() => expect(ctx).not.toBeNull());
    if (!ctx) throw new Error("context not ready");

    const option = createOption(["Look around"], []);

    await act(async () => {
      ctx?.applyGeneratedBranch({
        decisionId: "pa9S6u-ZYh", // decision id from initialGame
        option,
        newScene: { label: "LOOK_AROUND", lines: [] },
        userInput: "look around",
      });
    });

    await act(async () => {
      ctx?.appendLineToScene(
        "LOOK_AROUND",
        "- You open your tiny eyes for the first time.",
        0
      );
    });

    const latest = updates.at(-1) ?? ctx.editorLines;
    const hasSceneHeader = latest.some(
      (l) => l.text === "# LOOK_AROUND" && l.indent === 0
    );
    const hasNarrative = latest.some(
      (l) =>
        l.text === "- You open your tiny eyes for the first time." &&
        l.indent === 0
    );

    expect(hasSceneHeader).toBe(true);
    expect(hasNarrative).toBe(true);
  });
});

