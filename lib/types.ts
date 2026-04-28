export interface Kit {
  season: "봄웜" | "여름쿨" | "가을웜" | "겨울쿨";
  seasonEn: string;
  tone: string;
  summary: string;
  palette: {
    best: string[];
    avoid: string[];
  };
  makeup: {
    foundation: string;
    blush: { colors: string[]; desc: string };
    eye: { colors: string[]; desc: string };
    lip: { colors: string[]; desc: string };
  };
  fashion: {
    tops: string[];
    bottoms: string[];
    outwear: string[];
    avoid: string[];
  };
  layering: Array<{
    name: string;
    mood: string;
    colors: string[];
    items: string[];
    tip: string;
  }>;
}

export interface Message {
  role: "user" | "ai";
  text: string;
}

export interface ApiMessage {
  role: "user" | "assistant";
  content: string | Array<{ type: string; [key: string]: unknown }>;
}
