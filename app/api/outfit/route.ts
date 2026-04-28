import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

const client = new Anthropic();

export async function POST(req: NextRequest) {
  try {
    const { clothes, kit, situation, baseItem } = await req.json();

    if (!clothes || clothes.length === 0) {
      return NextResponse.json({ error: "옷장에 옷이 없어요." }, { status: 400 });
    }

    // 옷장 정보를 텍스트로 정리
    const wardrobeText = clothes.map((c: any, i: number) =>
      `[${i}] ${c.name} (${c.category}, ${c.type}, 색상: ${c.colorName} ${c.mainColor}, 무드: ${c.mood}, 계절: ${c.season?.join(",")})`
    ).join("\n");

    let userMsg = `# 내 옷장\n${wardrobeText}\n\n`;

    if (kit) {
      userMsg += `# 내 퍼스널 컬러: ${kit.season} (${kit.tone})\n`;
      userMsg += `추천 색상: ${kit.palette?.best?.map((c: any) => c.name || c.hex).join(", ")}\n\n`;
    }

    if (baseItem !== undefined && baseItem !== null) {
      userMsg += `# 기준 아이템: [${baseItem}] ${clothes[baseItem]?.name}\n이 옷에 어울리는 다른 아이템들과 함께 코디를 짜주세요.\n\n`;
    }

    if (situation) {
      userMsg += `# 상황: ${situation}\n\n`;
    }

    userMsg += `# 요청
위 옷장에서 어울리는 아이템들을 골라 코디 3가지를 추천해주세요. 반드시 옷장에 있는 아이템 번호 [숫자]를 사용하세요. 없는 옷은 추천하면 안 됩니다.

응답 형식 (JSON만, 다른 텍스트 금지):
{
  "outfits": [
    {
      "title": "코디 이름 (예: 데일리 캐주얼)",
      "mood": "무드 설명",
      "items": [0, 2, 5],
      "reason": "왜 이 조합이 어울리는지 (퍼스널 컬러 + 분위기 고려)",
      "tip": "스타일링 팁"
    }
  ]
}`;

    const response = await client.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 1500,
      temperature: 0.3,
      messages: [{ role: "user", content: userMsg }],
    });

    const raw = response.content
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("");

    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("JSON을 찾을 수 없어요");

    let result;
    try {
      result = JSON.parse(jsonMatch[0]);
    } catch {
      const cleaned = jsonMatch[0].replace(/,(\s*[}\]])/g, "$1");
      result = JSON.parse(cleaned);
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Outfit recommend error:", error);
    return NextResponse.json(
      { error: "코디 추천 중 오류가 발생했어요." },
      { status: 500 }
    );
  }
}