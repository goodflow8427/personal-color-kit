import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

const client = new Anthropic();

const CLOTHES_PROMPT = `당신은 패션 분석 전문가입니다. 사진 속 옷을 분석해서 아래 JSON 형식으로만 응답하세요. 다른 텍스트 절대 추가 금지.

분석할 항목:
1. category: "상의" | "하의" | "아우터" | "원피스" | "신발" | "가방" | "액세서리" 중 하나
2. type: 구체적인 종류 (예: 니트, 셔츠, 청바지, 트렌치코트)
3. mainColor: 주요 색상 hex 코드 (예: "#8B4513")
4. colorName: 색상의 감성적인 한글 이름 (예: "초콜릿 브라운")
5. mood: "캐주얼" | "포멀" | "스트릿" | "러블리" | "미니멀" | "빈티지" | "스포티" 중 하나
6. season: ["봄", "여름", "가을", "겨울"] 중 어울리는 계절들 (배열)
7. name: 짧은 별명 (예: "베이지 니트", "와인 청바지")

응답 형식:
{
  "category": "상의",
  "type": "니트",
  "mainColor": "#8B4513",
  "colorName": "초콜릿 브라운",
  "mood": "캐주얼",
  "season": ["가을", "겨울"],
  "name": "초콜릿 니트"
}`;

export async function POST(req: NextRequest) {
  try {
    const { imageBase64 } = await req.json();

    if (!imageBase64) {
      return NextResponse.json({ error: "이미지가 없어요." }, { status: 400 });
    }

    const response = await client.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 500,
      temperature: 0,
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
            { type: "text", text: CLOTHES_PROMPT },
          ],
        },
      ],
    });

    const raw = response.content
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("");

    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("JSON을 찾을 수 없어요");

    let item;
    try {
      item = JSON.parse(jsonMatch[0]);
    } catch {
      const cleaned = jsonMatch[0].replace(/,(\s*[}\]])/g, "$1");
      item = JSON.parse(cleaned);
    }

    return NextResponse.json({ item });
  } catch (error) {
    console.error("Clothes analysis error:", error);
    return NextResponse.json(
      { error: "옷 분석 중 오류가 발생했어요." },
      { status: 500 }
    );
  }
}