import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { ANALYSIS_PROMPT } from "@/lib/prompts";

const client = new Anthropic();

export async function POST(req: NextRequest) {
  try {
    const { faceImage, wristImage } = await req.json();

    if (!faceImage) {
      return NextResponse.json({ error: "얼굴 사진이 없어요." }, { status: 400 });
    }

    const content: any[] = [
      {
        type: "image",
        source: {
          type: "base64",
          media_type: "image/jpeg",
          data: faceImage,
        },
      },
    ];

    if (wristImage) {
      content.push({
        type: "image",
        source: {
          type: "base64",
          media_type: "image/jpeg",
          data: wristImage,
        },
      });
      content.push({
        type: "text",
        text: "첫 번째 사진은 얼굴, 두 번째 사진은 손목이에요. " + ANALYSIS_PROMPT,
      });
    } else {
      content.push({
        type: "text",
        text: "얼굴 사진만 있어요 (손목 사진은 없음). " + ANALYSIS_PROMPT,
      });
    }

    const response = await client.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 2500,
      temperature: 0,
      messages: [{ role: "user", content }],
    });

    const raw = response.content
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("");

    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("JSON을 찾을 수 없어요");

    let result;
    try {
      result = JSON.parse(jsonMatch[0]);
    } catch (parseErr) {
      // JSON 파싱 실패 시 자동 복구 시도
      console.error("JSON 파싱 실패, 복구 시도:", parseErr);
      let cleaned = jsonMatch[0]
        .replace(/,(\s*[}\]])/g, "$1") // 끝에 콤마 제거
        .replace(/([{,]\s*)([a-zA-Z_]\w*)\s*:/g, '$1"$2":') // 키에 따옴표 추가
        .replace(/'/g, '"'); // 작은따옴표 → 큰따옴표
      try {
        result = JSON.parse(cleaned);
      } catch {
        throw new Error("AI 응답을 처리할 수 없어요. 다시 시도해주세요.");
      }
    }

    if (result.quality_check && !result.quality_check.ok) {
      return NextResponse.json({
        qualityFailed: true,
        issues: result.quality_check.issues || [],
        advice: result.quality_check.advice || "사진을 다시 찍어주세요.",
      });
    }

    return NextResponse.json({ kit: result });
  } catch (error) {
    console.error("Analyze error:", error);
    return NextResponse.json(
      { error: "분석 중 오류가 발생했어요." },
      { status: 500 }
    );
  }
}