import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

const client = new Anthropic();

const INSPIRATION_PROMPT = `당신은 K-뷰티/패션 분석 전문가입니다. 사용자가 영감으로 올린 사진(핀터레스트, 인스타 등)을 분석하세요.

먼저 사진이 메이크업인지 코디(패션)인지 판단하세요.

## 메이크업 사진이면:
다음을 분석:
- 전체 무드 (예: "글로우 데일리", "스모키 시크", "내추럴 청순")
- 립 컬러 (예: "코랄 누드", hex 코드)
- 블러셔 (예: "피치 핑크", hex 코드)
- 아이 메이크업 (예: "골드 새틴", hex 코드)
- 베이스 (예: "글로우 윤기", "매트")
- 어울리는 퍼스널 컬러 (봄웜/여름쿨/가을웜/겨울쿨)

## 코디(패션) 사진이면:
다음을 분석:
- 전체 무드 (예: "가을 데일리", "오피스 룩", "스트릿 캐주얼")
- 상의 (예: "베이지 오버사이즈 니트")
- 하의 (예: "다크블루 와이드 데님")
- 신발 (있으면)
- 가방/액세서리 (있으면)
- 메인 컬러 팔레트 (hex 코드)
- 어울리는 퍼스널 컬러 (봄웜/여름쿨/가을웜/겨울쿨)

# 사용자 정보 활용
사용자의 퍼스널 컬러가 제공되면, 매칭 점수(0-100)를 계산하고:
- 80점 이상: "완벽하게 어울려요!"
- 60-80점: "잘 어울리지만 약간 조정하면 더 좋아요"
- 60점 미만: "당신에게는 살짝 안 맞아요. 비슷한 무드의 대안 추천"

# 출력 형식 (JSON만, 다른 텍스트 금지)

메이크업 응답:
{
  "type": "makeup",
  "mood": "글로우 데일리",
  "moodEn": "Glow Daily",
  "details": {
    "lip": { "color": "#FFB5A0", "name": "코랄 누드", "desc": "촉촉한 윤기 립" },
    "blush": { "color": "#FFC1B0", "name": "피치 핑크", "desc": "은은한 발색" },
    "eye": { "color": "#D4A574", "name": "골드 새틴", "desc": "글리터리한 펄" },
    "base": "윤기 있는 글로우 베이스, 자연스러운 톤"
  },
  "matchingSeason": "봄웜",
  "matchScore": 92,
  "matchComment": "당신의 봄웜과 완벽하게 어울려요! 화사한 코랄톤이 피부톤과 잘 맞아요.",
  "tips": [
    "립은 입술 안쪽부터 그라데이션으로",
    "블러셔는 광대뼈 위쪽에 살짝",
    "아이는 눈꺼풀 중앙에 포인트"
  ],
  "alternative": "만약 가을웜이라면 코랄 대신 테라코타 톤으로 조정하면 좋아요"
}

코디 응답:
{
  "type": "fashion",
  "mood": "가을 데일리 캐주얼",
  "moodEn": "Autumn Daily Casual",
  "details": {
    "top": "베이지 오버사이즈 니트",
    "bottom": "다크블루 와이드 데님",
    "shoes": "화이트 스니커즈",
    "accessory": "브라운 토트백, 골드 귀걸이"
  },
  "colors": [
    { "hex": "#D2B48C", "name": "베이지" },
    { "hex": "#1A2B4A", "name": "다크 데님" },
    { "hex": "#FFFFFF", "name": "화이트" }
  ],
  "matchingSeason": "가을웜",
  "matchScore": 88,
  "matchComment": "베이지+데님 조합은 가을웜에 정말 잘 어울려요!",
  "tips": [
    "오버사이즈 니트는 어깨 라인을 살짝 떨어뜨려 입기",
    "데님은 발목이 살짝 보이는 길이가 베스트",
    "토트백은 살구색이나 카라멜 브라운 추천"
  ],
  "alternative": "봄웜이라면 베이지 대신 코랄 핑크 니트로 바꾸면 더 화사해요"
}`;

export async function POST(req: NextRequest) {
  try {
    const { imageBase64, userKit } = await req.json();

    if (!imageBase64) {
      return NextResponse.json({ error: "이미지가 없어요." }, { status: 400 });
    }

    // 사용자 퍼스널 컬러 정보 추가
    let userInfo = "";
    if (userKit) {
      userInfo = `\n\n# 사용자 퍼스널 컬러: ${userKit.season} (${userKit.tone})\n베스트 색상: ${userKit.palette?.best?.map((c: any) => c.name || c.hex).join(", ")}\n이 정보를 바탕으로 매칭 점수와 코멘트를 작성하세요.`;
    }

    const response = await client.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 1500,
      temperature: 0.3,
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
            { type: "text", text: INSPIRATION_PROMPT + userInfo },
          ],
        },
      ],
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

    return NextResponse.json({ analysis: result });
  } catch (error) {
    console.error("Inspiration analysis error:", error);
    return NextResponse.json(
      { error: "분석 중 오류가 발생했어요." },
      { status: 500 }
    );
  }
}