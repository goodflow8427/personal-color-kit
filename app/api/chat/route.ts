import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { CHAT_SYSTEM } from "@/lib/prompts";

const client = new Anthropic();

export async function POST(req: NextRequest) {
  try {
    const { messages, imageBase64 } = await req.json();

    const lastMsg = messages[messages.length - 1];

    const apiMessages: Anthropic.MessageParam[] = imageBase64
      ? [
          ...messages.slice(0, -1).map((m: { role: string; content: string }) => ({
            role: m.role as "user" | "assistant",
            content: m.content as string,
          })),
          {
            role: "user" as const,
            content: [
              {
                type: "image" as const,
                source: {
                  type: "base64" as const,
                  media_type: "image/jpeg" as const,
                  data: imageBase64,
                },
              },
              {
                type: "text" as const,
                text: typeof lastMsg.content === "string" ? lastMsg.content : "",
              },
            ],
          },
        ]
      : messages.map((m: { role: string; content: string }) => ({
          role: m.role as "user" | "assistant",
          content: m.content as string,
        }));

    const response = await client.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 600,
      system: CHAT_SYSTEM,
      messages: apiMessages,
    });

    const reply = response.content
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("");

    return NextResponse.json({ reply });
  } catch (error) {
    console.error("Chat error:", error);
    return NextResponse.json(
      { error: "오류가 발생했어요." },
      { status: 500 }
    );
  }
}