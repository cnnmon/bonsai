import { NextRequest, NextResponse } from "next/server";

const SYSTEM_PROMPT = `Given a player input and a list of existing options, decide if any option is a valid match. Respond with ONLY JSON in this shape:
{"optionId": "<id or null>", "confidence": <0-1 number>}
- optionId must be one of the provided ids or null when no good fit exists.
- confidence closer to 1 means very strong match.
Do not add extra text.`.trim();

interface GrokOptionPayload {
  id: string;
  texts: string[];
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.GROK_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "GROK_API_KEY is not configured" },
      { status: 500 }
    );
  }

  let body: { input?: string; options?: GrokOptionPayload[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const input = (body.input ?? "").toString();
  const options = Array.isArray(body.options) ? body.options : [];

  if (!input.trim() || options.length === 0) {
    return NextResponse.json(
      { error: "Both input and options are required" },
      { status: 400 }
    );
  }

  const optionList = options
    .map((o) => `- ${o.id}: ${o.texts.join(" | ")}`)
    .join("\n");

  const userPrompt = `
Player input: "${input}"
Options (id: variants):
${optionList}
Return only JSON in the requested shape.
  `.trim();

  const grokResponse = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "grok-4-latest",
      stream: false,
      temperature: 0,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
    }),
  });

  if (!grokResponse.ok) {
    const message = await grokResponse.text();
    return NextResponse.json(
      { error: "Grok request failed", detail: message },
      { status: grokResponse.status }
    );
  }

  const grokJson = await grokResponse.json();
  const content =
    grokJson?.choices?.[0]?.message?.content ??
    grokJson?.message?.content ??
    "";

  try {
    const parsed = JSON.parse(content);
    return NextResponse.json({
      match: {
        optionId: parsed.optionId ?? null,
        confidence: Number(parsed.confidence ?? 0),
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to parse Grok response", detail: String(err) },
      { status: 502 }
    );
  }
}

