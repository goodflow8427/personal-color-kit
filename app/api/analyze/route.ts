import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { ANALYSIS_PROMPT } from "@/lib/prompts";

const client = new Anthropic();

export async function POST(req: NextRequest) {
  try {
    const { imageBase64 } = await req.json();

    if (!imageBase64) {
      return NextResponse.json({ error: "이미지가 없어요." }, { status: 400 });
    }

    const response = await client.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 1500,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: "image/jpeg",
                data: imageBase64,
              },
            },
            {
              type: "text",
              text: ANALYSIS_PROMPT,
            },
          ],
        },
      ],
    });

    const raw = response.content
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("");

    // JSON 추출 — AI가 앞뒤에 텍스트를 붙여도 안전하게 파싱
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("JSON을 찾을 수 없어요");
    const kit = JSON.parse(jsonMatch[0]);

    return NextResponse.json({ kit });
  } catch (error) {
    console.error("Analyze error:", error);
    return NextResponse.json(
      { error: "분석 중 오류가 발생했어요." },
      { status: 500 }
    );
  }
}