import { BranchGenerationResultPayload } from "@/types/branching";
import { NextRequest, NextResponse } from "next/server";

const DEFAULT_SYSTEM_PROMPT = `You continue a branching story. Reply with JSON only.
Return exactly one:
- paragraph: { "type":"paragraph","text":"...", "question":"..." } (stay in scene, MUST include question)
- new_scene: { "type":"new_scene","sceneLabel":"SCENE","paragraphs":["..."], "question":"..." } (MUST include question)
- existing_scene: { "type":"existing_scene","sceneLabel":"SCENE","paragraphs":["..."] } (no question for existing scenes)

Rules: keep under 320 characters total; 1-2 sentences per paragraph. Always end with a question to continue the story unless jumping to existing_scene. Use AVAILABLE SCENES only when linking with existing_scene. Prefer reusing scenes; keep narration brief.`.trim();

const MAX_USER_PROMPT_CHARS = 1200;

const clampLength = (text: string, max: number) =>
  text.length > max ? text.slice(0, max) : text;

export async function POST(req: NextRequest) {
  const apiKey = process.env.GROK_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "GROK_API_KEY is not configured" },
      { status: 500 }
    );
  }

  let body: BranchGenerationResultPayload;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const input = (body.input ?? "").toString().trim();
  const decisionPrompt = (body.decisionPrompt ?? "").toString().trim();
  const existingScenes = Array.isArray(body.existingScenes) ? body.existingScenes : [];
  const sceneLabel = (body.sceneLabel ?? "").toString().trim();
  const history = Array.isArray(body.history) ? body.history : [];
  const newSceneLabel = (body.newSceneLabel ?? "").toString().trim();
  const customPrompt = (body.customPrompt ?? "").toString().trim();

  console.log("[grok-branch] Received customPrompt:", customPrompt || "empty");

  if (!input || !decisionPrompt) {
    return NextResponse.json(
      { error: "input and decisionPrompt are required" },
      { status: 400 }
    );
  }

  const sceneList =
    existingScenes.length > 0
      ? existingScenes.map((s) => `- ${s}`).join("\n")
      : "- None provided";

  const recentHistory = history.slice(-10);
  const historyList =
    recentHistory.length > 0
      ? recentHistory.map((h, i) => `${i + 1}. ${h}`).join("\n")
      : "None provided";

  const clampedCustomPrompt = customPrompt ? clampLength(customPrompt, 400) : "";
  const systemPrompt = clampedCustomPrompt
    ? `${DEFAULT_SYSTEM_PROMPT}\n\nIMPORTANT:\n${clampedCustomPrompt}`
    : DEFAULT_SYSTEM_PROMPT;

  console.log("[grok-branch] Custom prompt:", clampedCustomPrompt || "none");
  console.log("[grok-branch] System prompt length:", systemPrompt.length);

  const baseUserPrompt = `\nCURRENT CONTEXT:
Scene: ${sceneLabel || "START"}
Decision: "${decisionPrompt}"
Player: "${input}"

STORY SO FAR:
${historyList}

AVAILABLE SCENES:
${sceneList}

Respond with one JSON object only. If creating a new scene, use: ${newSceneLabel || "AUTO_SCENE"}. Include a short paragraph only if needed.`;

  const userPrompt = clampLength(
    clampedCustomPrompt 
      ? `${baseUserPrompt}\n\nIMPORTANT: ${clampedCustomPrompt}`
      : baseUserPrompt,
    MAX_USER_PROMPT_CHARS
  );

  const messages = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ];

  console.log("[grok-branch] Sending to Grok:");
  console.log("  System prompt:", systemPrompt);
  console.log("  User prompt:", userPrompt);

  const grokResponse = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "grok-4-latest",
      stream: false,
      temperature: 0.3,
      messages,
    }),
  });

  if (!grokResponse.ok) {
    const message = await grokResponse.text();
    return NextResponse.json(
      { error: "Grok request failed", detail: message },
      { status: grokResponse.status }
    );
  }

  const data = await grokResponse.json();
  const content = data?.choices?.[0]?.message?.content ?? "";

  console.log("[grok-branch] Response from Grok:", content.substring(0, 200) + (content.length > 200 ? "..." : ""));

  return NextResponse.json({ content }, { status: 200 });
}

