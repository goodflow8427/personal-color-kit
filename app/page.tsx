"use client";

import { useState, useRef, useEffect } from "react";

const SEASONS: Record<string, { bg: string; accent: string; label: string; avoidDesc: string }> = {
  "봄웜": { bg: "linear-gradient(135deg,#FFE0B2,#FFF3E0)", accent: "#E65100", label: "🌸 Spring Warm", avoidDesc: "어둡고 차가운 색은 피부를 칙칙하게 만들어요" },
  "여름쿨": { bg: "linear-gradient(135deg,#E3F2FD,#F3E5F5)", accent: "#5C6BC0", label: "🌊 Summer Cool", avoidDesc: "강한 웜톤이나 노란빛은 안색을 누렇게 보이게 해요" },
  "가을웜": { bg: "linear-gradient(135deg,#FFF8E1,#FBE9E7)", accent: "#BF360C", label: "🍂 Autumn Warm", avoidDesc: "차가운 파스텔이나 형광 색은 피부를 창백하게 보이게 해요" },
  "겨울쿨": { bg: "linear-gradient(135deg,#E8EAF6,#ECEFF1)", accent: "#1A237E", label: "❄️ Winter Cool", avoidDesc: "탁한 어스 톤은 피부를 피곤해 보이게 만들어요" },
};

const CATEGORIES = ["상의", "하의", "아우터", "원피스", "신발", "가방", "액세서리"];
const MOODS = ["캐주얼", "포멀", "스트릿", "러블리", "미니멀", "빈티지", "스포티"];

const isValidHex = (color: string) => /^#[0-9A-F]{6}$/i.test(color);

const isLightColor = (hex: string) => {
  if (!isValidHex(hex)) return false;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6;
};

const resizeImage = (file: File, maxWidth = 800): Promise<string> =>
  new Promise((res) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const scale = Math.min(1, maxWidth / img.width);
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      canvas.getContext("2d")?.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      res(canvas.toDataURL("image/jpeg", 0.85).split(",")[1]);
    };
    img.src = url;
  });

const resizeCanvas = (sourceCanvas: HTMLCanvasElement, maxWidth = 800): string => {
  const scale = Math.min(1, maxWidth / sourceCanvas.width);
  const canvas = document.createElement("canvas");
  canvas.width = sourceCanvas.width * scale;
  canvas.height = sourceCanvas.height * scale;
  canvas.getContext("2d")?.drawImage(sourceCanvas, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.85).split(",")[1];
};

function ColorCard({ color, onCopy, dim = false }: { color: any; onCopy: (c: string) => void; dim?: boolean }) {
  const hex = typeof color === "string" ? color : color.hex;
  const colorName = typeof color === "string" ? hex : color.name;
  if (!isValidHex(hex)) return null;
  const textColor = isLightColor(hex) ? "#333" : "#fff";

  return (
    <button onClick={() => onCopy(hex)} title={`${colorName} (${hex})`}
      style={{ background: hex, opacity: dim ? 0.55 : 1, border: "none", borderRadius: 14, padding: "20px 14px", cursor: "pointer", display: "flex", flexDirection: "column", justifyContent: "flex-end", minHeight: 100, boxShadow: "0 2px 12px rgba(0,0,0,0.06)", transition: "transform 0.2s, box-shadow 0.2s", textAlign: "left" }}
      onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-3px)"; e.currentTarget.style.boxShadow = "0 8px 24px rgba(0,0,0,0.12)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "0 2px 12px rgba(0,0,0,0.06)"; }}>
      <div style={{ color: textColor, fontSize: 13, fontWeight: 700, marginBottom: 2 }}>{colorName}</div>
      <div style={{ color: textColor, opacity: 0.7, fontSize: 10, fontFamily: "monospace" }}>{hex.toUpperCase()}</div>
    </button>
  );
}

type Phase = "guide" | "capture" | "wrist" | "analyzing" | "kit";
type ClothItem = { id: string; image: string; category: string; type: string; mainColor: string; colorName: string; mood: string; season: string[]; name: string; lastWornDate?: string };
type SavedOutfit = { id: string; title: string; mood: string; itemIds: string[]; reason: string; tip: string; savedAt: number; signature: string };

const makeOutfitSignature = (title: string, itemIds: string[]) => `${title}::${[...itemIds].sort().join(",")}`;

// 옷장에서 비슷한 옷 찾기 (영감 분석 결과 기반)
const findSimilarClothes = (clothes: ClothItem[], inspirationResult: any): ClothItem[] => {
  if (!inspirationResult || inspirationResult.type !== "fashion" || !inspirationResult.details) return [];
  const details = inspirationResult.details;
  const keywords: string[] = [];
  if (details.top) keywords.push(...details.top.split(" "));
  if (details.bottom) keywords.push(...details.bottom.split(" "));
  
  const matches = clothes.filter(c => {
    const searchText = `${c.name} ${c.colorName} ${c.type} ${c.mood}`.toLowerCase();
    return keywords.some(kw => kw.length >= 2 && searchText.includes(kw.toLowerCase()));
  });
  
  return matches.slice(0, 3);
};

export default function Home() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const wristFileRef = useRef<HTMLInputElement>(null);
  const shopFileRef = useRef<HTMLInputElement>(null);
  const clothFileRef = useRef<HTMLInputElement>(null);
  const inspirationFileRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const outfitResultRef = useRef<HTMLDivElement>(null);
  const inspirationResultRef = useRef<HTMLDivElement>(null);
  const isComposingRef = useRef(false);

  const [phase, setPhase] = useState<Phase>("guide");
  const [cameraOn, setCameraOn] = useState(false);
  const [photoB64, setPhotoB64] = useState<string | null>(null);
  const [wristB64, setWristB64] = useState<string | null>(null);
  const [kit, setKit] = useState<any>(null);
  const [activeTab, setActiveTab] = useState("palette");
  const [shopImg, setShopImg] = useState<string | null>(null);
  const [messages, setMessages] = useState<{ role: string; text: string }[]>([]);
  const [chatHistory, setChatHistory] = useState<any[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [qualityIssues, setQualityIssues] = useState<{ issues: string[]; advice: string } | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [mobileView, setMobileView] = useState<"kit" | "wardrobe" | "chat">("kit");
  const [analyzeStep, setAnalyzeStep] = useState(0);
  const [toast, setToast] = useState<string | null>(null);

  const [clothes, setClothes] = useState<ClothItem[]>([]);
  const [clothesLoaded, setClothesLoaded] = useState(false);
  const [isClothLoading, setIsClothLoading] = useState(false);
  const [clothProgress, setClothProgress] = useState<{ current: number; total: number } | null>(null);
  const [outfits, setOutfits] = useState<any[]>([]);
  const [outfitLoading, setOutfitLoading] = useState(false);
  const [situationInput, setSituationInput] = useState("");
  const [selectedBaseId, setSelectedBaseId] = useState<string | null>(null);
  const [editingCloth, setEditingCloth] = useState<ClothItem | null>(null);

  const [categoryFilter, setCategoryFilter] = useState<string>("전체");
  const [searchQuery, setSearchQuery] = useState("");
  const [savedOutfits, setSavedOutfits] = useState<SavedOutfit[]>([]);
  const [showSaved, setShowSaved] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [weather, setWeather] = useState<{ temp: number; desc: string; emoji: string } | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [zoomImage, setZoomImage] = useState<string | null>(null);

  const [inspirationImg, setInspirationImg] = useState<string | null>(null);
  const [inspirationResult, setInspirationResult] = useState<any>(null);
  const [inspirationLoading, setInspirationLoading] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("colorkit_clothes");
      if (saved) setClothes(JSON.parse(saved));
      const savedOut = localStorage.getItem("colorkit_saved_outfits");
      if (savedOut) setSavedOutfits(JSON.parse(savedOut));
      const savedWeather = localStorage.getItem("colorkit_weather");
      if (savedWeather) {
        const { weather: w, time } = JSON.parse(savedWeather);
        if (Date.now() - time < 30 * 60 * 1000) setWeather(w);
      }
    } catch {}
    setClothesLoaded(true);
  }, []);

  useEffect(() => {
    if (!clothesLoaded) return;
    try { localStorage.setItem("colorkit_clothes", JSON.stringify(clothes)); }
    catch { setToast("⚠️ 저장 공간 부족"); setTimeout(() => setToast(null), 3000); }
  }, [clothes, clothesLoaded]);

  useEffect(() => {
    if (!clothesLoaded) return;
    try { localStorage.setItem("colorkit_saved_outfits", JSON.stringify(savedOutfits)); } catch {}
  }, [savedOutfits, clothesLoaded]);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    if (!isAnalyzing) { setAnalyzeStep(0); return; }
    const interval = setInterval(() => { setAnalyzeStep(s => (s + 1) % 4); }, 1500);
    return () => clearInterval(interval);
  }, [isAnalyzing]);

  const fetchWeather = async () => {
    setWeatherLoading(true);
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 });
      });
      const { latitude, longitude } = pos.coords;
      const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weather_code&timezone=auto`);
      const data = await res.json();
      const temp = Math.round(data.current.temperature_2m);
      const code = data.current.weather_code;
      let desc = "맑음", emoji = "☀️";
      if (code >= 1 && code <= 3) { desc = "구름"; emoji = "⛅"; }
      else if (code >= 45 && code <= 48) { desc = "안개"; emoji = "🌫️"; }
      else if (code >= 51 && code <= 67) { desc = "비"; emoji = "🌧️"; }
      else if (code >= 71 && code <= 77) { desc = "눈"; emoji = "❄️"; }
      else if (code >= 80 && code <= 82) { desc = "소나기"; emoji = "🌦️"; }
      else if (code >= 95) { desc = "뇌우"; emoji = "⛈️"; }
      const newWeather = { temp, desc, emoji };
      setWeather(newWeather);
      try { localStorage.setItem("colorkit_weather", JSON.stringify({ weather: newWeather, time: Date.now() })); } catch {}
      setSituationInput(`오늘 날씨 ${temp}도 ${desc}`);
    } catch {
      setToast("⚠️ 위치 권한이 필요해요");
      setTimeout(() => setToast(null), 2000);
    }
    setWeatherLoading(false);
  };

  const copyHex = (hex: string) => {
    navigator.clipboard?.writeText(hex);
    setToast(`${hex} 복사됨 ✓`);
    setTimeout(() => setToast(null), 1800);
  };

  const startCam = async () => {
    if (videoRef.current) videoRef.current.srcObject = null;
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
      streamRef.current = s;
      if (videoRef.current) { videoRef.current.srcObject = s; videoRef.current.play(); }
      setCameraOn(true);
      setError(null);
    } catch { setError("카메라 권한을 허용해주세요."); }
  };

  const stopCam = () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setCameraOn(false);
  };

  const captureSnap = () => {
    const v = videoRef.current, c = canvasRef.current;
    if (!v || !c) return;
    c.width = v.videoWidth; c.height = v.videoHeight;
    c.getContext("2d")?.drawImage(v, 0, 0);
    setPhotoB64(resizeCanvas(c));
    setError(null);
    stopCam();
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return;
    setIsUploading(true);
    try { setPhotoB64(await resizeImage(f)); setError(null); }
    catch { setError("이미지 처리 중 오류가 발생했어요."); }
    setIsUploading(false);
  };

  const handleWristUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return;
    setIsUploading(true);
    try { setWristB64(await resizeImage(f)); }
    catch { setError("이미지 처리 중 오류가 발생했어요."); }
    setIsUploading(false);
  };

  const handleShopUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return;
    if (!kit) {
      setMessages(p => [...p, { role: "ai", text: "먼저 퍼스널 컬러 분석을 완료해주세요! 📷" }]);
      return;
    }
    const data = await resizeImage(f);
    setShopImg(data);
    if (isMobile) setMobileView("chat");
    await analyzeShopItem(data);
  };

  const handleClothUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files; if (!files || files.length === 0) return;
    setIsClothLoading(true);
    setClothProgress({ current: 0, total: files.length });
    let i = 0;
    for (const f of Array.from(files)) {
      i++;
      setClothProgress({ current: i, total: files.length });
      try {
        const analyzeData = await resizeImage(f, 800);
        const storeData = await resizeImage(f, 400);
        const res = await fetch("/api/clothes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageBase64: analyzeData }),
        });
        const result = await res.json();
        if (result.item) {
          setClothes(p => [{ id: Date.now().toString() + Math.random().toString(36).slice(2), image: storeData, ...result.item }, ...p]);
        }
      } catch { setToast(`옷 ${i} 분석 실패 😢`); }
    }
    setIsClothLoading(false);
    setClothProgress(null);
    if (e.target) e.target.value = "";
  };

  const removeCloth = (id: string) => {
    const affected = savedOutfits.filter(o => o.itemIds.includes(id)).length;
    setClothes(p => p.filter(c => c.id !== id));
    if (selectedBaseId === id) setSelectedBaseId(null);
    if (affected > 0) {
      setToast(`💕 즐겨찾기 ${affected}개에 영향 있어요`);
      setTimeout(() => setToast(null), 2500);
    }
  };

  const updateCloth = (updated: ClothItem) => {
    setClothes(p => p.map(c => c.id === updated.id ? updated : c));
    setEditingCloth(null);
    setToast("✓ 수정됐어요"); setTimeout(() => setToast(null), 1500);
  };

  const markAsWorn = (id: string) => {
    const today = new Date().toISOString().slice(0, 10);
    setClothes(p => p.map(c => c.id === id ? {...c, lastWornDate: today} : c));
    setToast("✓ 오늘 입었다고 기록했어요"); setTimeout(() => setToast(null), 1500);
  };

  const recommendOutfit = async () => {
    if (clothes.length < 2) {
      setToast("최소 2벌 이상 등록해주세요"); setTimeout(() => setToast(null), 2000); return;
    }
    setOutfitLoading(true);
    try {
      const baseItemIndex = selectedBaseId ? clothes.findIndex(c => c.id === selectedBaseId) : null;
      const res = await fetch("/api/outfit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clothes: clothes.map(c => ({ name: c.name, category: c.category, type: c.type, mainColor: c.mainColor, colorName: c.colorName, mood: c.mood, season: c.season })),
          kit, situation: situationInput || undefined,
          baseItem: baseItemIndex !== null && baseItemIndex >= 0 ? baseItemIndex : null,
        }),
      });
      const data = await res.json();
      if (data.outfits) {
        const validOutfits = data.outfits.map((o: any) => ({
          ...o,
          itemIds: (o.items || []).filter((i: number) => i >= 0 && i < clothes.length).map((i: number) => clothes[i].id),
        })).filter((o: any) => o.itemIds.length > 0);
        setOutfits(validOutfits);
        setTimeout(() => outfitResultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
      }
    } catch { setToast("코디 추천 실패 😢"); setTimeout(() => setToast(null), 2000); }
    setOutfitLoading(false);
  };

  const toggleSaveOutfit = (outfit: any) => {
    const signature = makeOutfitSignature(outfit.title, outfit.itemIds);
    const existing = savedOutfits.find(s => s.signature === signature);
    if (existing) {
      setSavedOutfits(p => p.filter(s => s.signature !== signature));
      setToast("💔 즐겨찾기에서 제거됐어요");
    } else {
      const saved: SavedOutfit = {
        id: Date.now().toString() + Math.random().toString(36).slice(2),
        title: outfit.title, mood: outfit.mood, itemIds: outfit.itemIds,
        reason: outfit.reason, tip: outfit.tip, savedAt: Date.now(), signature,
      };
      setSavedOutfits(p => [saved, ...p]);
      setToast("💕 즐겨찾기에 저장됐어요");
    }
    setTimeout(() => setToast(null), 1500);
  };

  const isOutfitSaved = (outfit: any) => {
    const signature = makeOutfitSignature(outfit.title, outfit.itemIds);
    return savedOutfits.some(s => s.signature === signature);
  };

  const removeSavedOutfit = (id: string) => setSavedOutfits(p => p.filter(o => o.id !== id));

  // 영감 분석 (이전 결과 유지하면서 새 분석)
  const analyzeInspiration = async (b64: string) => {
    setInspirationLoading(true);
    // 이전 결과 유지하면서 분석
    try {
      const res = await fetch("/api/inspiration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: b64, userKit: kit }),
      });
      const data = await res.json();
      if (data.analysis) {
        setInspirationResult(data.analysis);
        // 채팅 컨텍스트에 영감 분석 결과 자동 추가
        const summaryText = data.analysis.type === "makeup"
          ? `사용자가 영감으로 올린 메이크업 스타일: ${data.analysis.mood}. 립: ${data.analysis.details?.lip?.name || ""}, 블러셔: ${data.analysis.details?.blush?.name || ""}, 아이: ${data.analysis.details?.eye?.name || ""}. ${kit ? `매칭점수: ${data.analysis.matchScore}점` : ""}`
          : `사용자가 영감으로 올린 코디: ${data.analysis.mood}. 상의: ${data.analysis.details?.top || ""}, 하의: ${data.analysis.details?.bottom || ""}, 신발: ${data.analysis.details?.shoes || ""}. ${kit ? `매칭점수: ${data.analysis.matchScore}점` : ""}`;
        setChatHistory(p => [...p, { role: "user", content: `[영감 분석 완료] ${summaryText}` }, { role: "assistant", content: "영감 분석 결과를 봤어요. 이 스타일에 대해 궁금한 점 있으시면 물어보세요!" }]);
        // 자동 스크롤
        setTimeout(() => inspirationResultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
      } else {
        setToast("분석 실패 😢");
        setTimeout(() => setToast(null), 2000);
      }
    } catch {
      setToast("분석 중 오류가 발생했어요");
      setTimeout(() => setToast(null), 2000);
    }
    setInspirationLoading(false);
  };

  const handleInspirationUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return;
    const data = await resizeImage(f, 800);
    setInspirationImg(data);
    if (isMobile) setMobileView("chat");
    await analyzeInspiration(data);
    if (e.target) e.target.value = "";
  };

  const shareOutfit = async (outfit: any, items: ClothItem[]) => {
    const text = `🎨 ${outfit.title}\n${outfit.mood}\n\n구성: ${items.map(i => i.name).join(", ")}\n\n${outfit.reason}\n\n💡 ${outfit.tip}\n\n🌐 Personal Color Kit에서 추천받았어요!`;
    try {
      if (navigator.share) {
        await navigator.share({ title: outfit.title, text });
      } else {
        await navigator.clipboard.writeText(text);
        setToast("📋 코디가 복사됐어요!");
        setTimeout(() => setToast(null), 1800);
      }
    } catch {}
  };

  const analyzeColor = async () => {
    if (!photoB64 || isAnalyzing) return;
    setIsAnalyzing(true); setPhase("analyzing"); setError(null); setQualityIssues(null);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ faceImage: photoB64, wristImage: wristB64 }),
      });
      const data = await res.json();
      if (data.qualityFailed) {
        setQualityIssues({ issues: data.issues, advice: data.advice });
        setPhase("capture"); setIsAnalyzing(false); return;
      }
      if (data.error) throw new Error(data.error);
      setKit(data.kit); setPhase("kit");
      setMessages([{ role: "ai", text: `✨ ${data.kit.season} 분석 완료! 키트와 옷장도 활용해보세요 💕` }]);
      setChatHistory([
        { role: "user", content: `내 퍼스널 컬러: ${JSON.stringify(data.kit)}` },
        { role: "assistant", content: `${data.kit.season} 분석 완료! 도움 드릴게요 💕` },
      ]);
    } catch { setError("분석 오류가 발생했어요. 다시 시도해주세요."); setPhase("capture"); }
    setIsAnalyzing(false);
  };

  const analyzeShopItem = async (b64: string) => {
    setChatLoading(true);
    const userText = "이 상품이 내 퍼스널 컬러에 어울리나요?";
    setMessages(p => [...p, { role: "user", text: userText }]);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [...chatHistory, { role: "user", content: userText }], imageBase64: b64 }),
      });
      const data = await res.json();
      setMessages(p => [...p, { role: "ai", text: data.reply }]);
      setChatHistory(p => [...p, { role: "user", content: userText }, { role: "assistant", content: data.reply }]);
    } catch { setMessages(p => [...p, { role: "ai", text: "오류가 발생했어요." }]); }
    setChatLoading(false);
  };

  const sendChat = async (overrideText?: string) => {
    const txt = (overrideText ?? chatInput).trim();
    if (!txt || chatLoading) return;
    if (!overrideText) setChatInput("");
    setMessages(p => [...p, { role: "user", text: txt }]);
    setChatLoading(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [...chatHistory, { role: "user", content: txt }] }),
      });
      const data = await res.json();
      setMessages(p => [...p, { role: "ai", text: data.reply }]);
      setChatHistory(p => [...p, { role: "user", content: txt }, { role: "assistant", content: data.reply }]);
    } catch { setMessages(p => [...p, { role: "ai", text: "오류가 발생했어요." }]); }
    setChatLoading(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !isComposingRef.current && !e.nativeEvent.isComposing) {
      e.preventDefault(); sendChat();
    }
  };

  const resetAll = () => {
    setPhase("guide"); setKit(null); setPhotoB64(null); setWristB64(null);
    setMessages([]); setChatHistory([]); setShopImg(null); setQualityIssues(null); setError(null);
  };

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);
  useEffect(() => () => stopCam(), []);

  const acc = kit ? (SEASONS[kit.season]?.accent || "#C2185B") : "#C2185B";

  const filteredClothes = clothes.filter(c => {
    if (categoryFilter !== "전체" && c.category !== categoryFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return c.name.toLowerCase().includes(q) || c.colorName.toLowerCase().includes(q) || c.mood.toLowerCase().includes(q) || c.type.toLowerCase().includes(q);
    }
    return true;
  });

  const findClothById = (id: string) => clothes.find(c => c.id === id);

  // 영감 분석 결과 → 옷장 매칭
  const similarClothes = inspirationResult ? findSimilarClothes(clothes, inspirationResult) : [];

  const stats = {
    total: clothes.length,
    byCategory: CATEGORIES.map(cat => ({ cat, count: clothes.filter(c => c.category === cat).length })).filter(x => x.count > 0),
    byMood: MOODS.map(m => ({ mood: m, count: clothes.filter(c => c.mood === m).length })).filter(x => x.count > 0),
    topColors: Object.entries(clothes.reduce((acc: Record<string, number>, c) => { acc[c.colorName] = (acc[c.colorName] || 0) + 1; return acc; }, {})).sort((a, b) => b[1] - a[1]).slice(0, 5),
  };

  if (phase === "guide") return (
    <div style={{ minHeight: "100vh", background: "#FAFAF7", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: "'Noto Sans KR',sans-serif", padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 480, animation: "fadeIn 0.6s ease-out" }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ fontSize: 48, marginBottom: 8 }}>🎨</div>
          <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 14, color: "#C2185B", fontStyle: "italic", letterSpacing: 2, marginBottom: 8 }}>BEFORE WE START</p>
          <h1 style={{ fontSize: 26, fontWeight: 900, letterSpacing: "-1px", marginBottom: 10 }}>정확한 진단을 위해</h1>
          <p style={{ fontSize: 13, color: "#888", lineHeight: 1.7 }}>아래 가이드를 확인하면<br />훨씬 정확한 결과를 얻을 수 있어요</p>
        </div>
        <div style={{ background: "#fff", borderRadius: 20, padding: "20px 24px", border: "1px solid #EEE", boxShadow: "0 4px 24px rgba(0,0,0,0.04)", marginBottom: 16 }}>
          <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 16, fontWeight: 700, fontStyle: "italic", marginBottom: 14 }}>📸 사진 촬영 가이드</p>
          <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: 12 }}>
            {[
              { icon: "☀️", title: "자연광에서", desc: "오전 10시 ~ 오후 3시 햇빛이 가장 좋아요" },
              { icon: "💄", title: "메이크업 NO", desc: "민낯이거나 가벼운 베이스만" },
              { icon: "👕", title: "흰색 옷 / 배경", desc: "다른 색이 피부에 비치지 않도록" },
              { icon: "👀", title: "정면, 가까이", desc: "얼굴이 화면 절반 이상 차지하게" },
              { icon: "🤚", title: "손목 사진도 (선택)", desc: "정맥 색이 진단에 큰 도움이 돼요" },
            ].map(item => (
              <li key={item.title} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                <span style={{ fontSize: 22 }}>{item.icon}</span>
                <div><p style={{ fontSize: 13, fontWeight: 700 }}>{item.title}</p><p style={{ fontSize: 12, color: "#888", lineHeight: 1.6, marginTop: 2 }}>{item.desc}</p></div>
              </li>
            ))}
          </ul>
        </div>
        <button onClick={() => setPhase("capture")} style={{ width: "100%", padding: "16px", borderRadius: 16, border: "none", background: "linear-gradient(135deg,#C2185B,#880E4F)", color: "#fff", fontSize: 15, fontWeight: 800, cursor: "pointer", boxShadow: "0 8px 24px rgba(194,24,91,0.3)" }}>✨ 시작하기</button>
      </div>
      <style>{`@keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }`}</style>
    </div>
  );

  if (phase === "analyzing") {
    const steps = ["📸 사진 분석 중", "🎨 피부톤 측정 중", "✨ 컬러 매칭 중", "💄 키트 생성 중"];
    return (
      <div style={{ minHeight: "100vh", background: "linear-gradient(135deg, #FFF0F4 0%, #F5F0FF 50%, #FFF8F0 100%)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: "'Noto Sans KR',sans-serif", padding: 24 }}>
        <div style={{ width: 180, height: 180, position: "relative", marginBottom: 32 }}>
          <div style={{ width: "100%", height: "100%", borderRadius: "50%", background: "conic-gradient(from 0deg, #E65100, #BF360C, #1A237E, #5C6BC0, #E65100)", animation: "spin 3s linear infinite", boxShadow: "0 8px 40px rgba(194, 24, 91, 0.3)" }} />
          <div style={{ position: "absolute", inset: 30, borderRadius: "50%", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 42 }}>🎨</div>
        </div>
        <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 32, fontWeight: 700, marginBottom: 8, fontStyle: "italic" }}>Analyzing your colors</h2>
        <p style={{ fontSize: 13, color: "#888", marginBottom: 32 }}>잠시만 기다려주세요...</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "center" }}>
          {steps.map((s, i) => (<div key={s} style={{ fontSize: 13, color: i === analyzeStep ? "#C2185B" : i < analyzeStep ? "#999" : "#CCC", fontWeight: i === analyzeStep ? 700 : 500 }}>{i < analyzeStep ? "✓ " : ""}{s}{i === analyzeStep ? "..." : ""}</div>))}
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (phase === "capture") return (
    <div style={{ minHeight: "100vh", background: "#FAFAF7", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: "'Noto Sans KR',sans-serif", padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 440, animation: "fadeIn 0.6s ease-out" }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 13, color: "#C2185B", fontStyle: "italic", letterSpacing: 2, marginBottom: 6 }}>STEP 1 / 2</p>
          <h1 style={{ fontSize: 24, fontWeight: 900, letterSpacing: "-1px", marginBottom: 6 }}>얼굴 사진 📷</h1>
          <p style={{ fontSize: 13, color: "#888", lineHeight: 1.6 }}>자연광에서 메이크업 없이 정면으로</p>
        </div>
        {qualityIssues && (<div style={{ background: "#FFF8E1", border: "1px solid #FFD54F", borderRadius: 16, padding: "14px 18px", marginBottom: 16 }}><p style={{ fontSize: 13, fontWeight: 800, color: "#E65100", marginBottom: 8 }}>⚠️ 사진을 다시 찍어주세요</p><ul style={{ listStyle: "none", marginBottom: 8 }}>{qualityIssues.issues.map((iss, i) => (<li key={i} style={{ fontSize: 12, color: "#666", lineHeight: 1.7 }}>• {iss}</li>))}</ul><p style={{ fontSize: 12, color: "#444", lineHeight: 1.6, fontStyle: "italic" }}>💡 {qualityIssues.advice}</p></div>)}
        <div style={{ background: "#fff", borderRadius: 24, border: "1px solid #EEE", overflow: "hidden", marginBottom: 16, boxShadow: "0 4px 24px rgba(0,0,0,0.04)" }}>
          <div style={{ position: "relative", aspectRatio: "4/3", background: "#F8F6F3", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <video ref={videoRef} style={{ width: "100%", height: "100%", objectFit: "cover", transform: "scaleX(-1)", display: cameraOn ? "block" : "none" }} autoPlay muted playsInline />
            <canvas ref={canvasRef} style={{ display: "none" }} />
            {!cameraOn && !photoB64 && !isUploading && (<div style={{ textAlign: "center", color: "#CCC" }}><div style={{ fontSize: 40 }}>📷</div><div style={{ fontSize: 13, marginTop: 8 }}>카메라 또는 사진 업로드</div></div>)}
            {isUploading && (<div style={{ width: 32, height: 32, border: "3px solid #C2185B30", borderTop: "3px solid #C2185B", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />)}
            {photoB64 && !cameraOn && !isUploading && (<img src={`data:image/jpeg;base64,${photoB64}`} style={{ width: "100%", height: "100%", objectFit: "cover", transform: "scaleX(-1)" }} alt="" />)}
          </div>
          <div style={{ padding: 16, display: "flex", gap: 8 }}>
            {!cameraOn && !photoB64 && <>
              <button onClick={startCam} style={{ flex: 2, padding: "11px", borderRadius: 12, border: "none", background: "#C2185B", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>📷 카메라 켜기</button>
              <button onClick={() => fileRef.current?.click()} style={{ flex: 1, padding: "11px", borderRadius: 12, border: "1px solid #DDD", background: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>📁 업로드</button>
            </>}
            {cameraOn && (<button onClick={captureSnap} style={{ flex: 1, padding: "11px", borderRadius: 12, border: "none", background: "#C2185B", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>📸 촬영하기</button>)}
            {photoB64 && !cameraOn && (<button onClick={() => { setPhotoB64(null); setError(null); startCam(); }} style={{ flex: 1, padding: "11px", borderRadius: 12, border: "1px solid #DDD", background: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>🔄 다시 찍기</button>)}
          </div>
        </div>
        <input ref={fileRef} type="file" accept="image/*" onChange={handleUpload} style={{ display: "none" }} />
        {error && (<div style={{ background: "#FFF0F0", border: "1px solid #FFCCCC", borderRadius: 12, padding: "10px 16px", color: "#C00", fontSize: 13, textAlign: "center", marginBottom: 12 }}>{error}</div>)}
        <button onClick={() => setPhase("wrist")} disabled={!photoB64} style={{ width: "100%", padding: "16px", borderRadius: 16, border: "none", background: photoB64 ? "linear-gradient(135deg,#C2185B,#880E4F)" : "#E0DDD8", color: photoB64 ? "#fff" : "#AAA", fontSize: 15, fontWeight: 800, cursor: photoB64 ? "pointer" : "not-allowed" }}>다음 단계 → 손목 사진</button>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } } @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }`}</style>
    </div>
  );

  if (phase === "wrist") return (
    <div style={{ minHeight: "100vh", background: "#FAFAF7", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: "'Noto Sans KR',sans-serif", padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 440, animation: "fadeIn 0.6s ease-out" }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 13, color: "#C2185B", fontStyle: "italic", letterSpacing: 2, marginBottom: 6 }}>STEP 2 / 2</p>
          <h1 style={{ fontSize: 24, fontWeight: 900, letterSpacing: "-1px", marginBottom: 6 }}>손목 사진 🤚</h1>
          <p style={{ fontSize: 13, color: "#888", lineHeight: 1.6 }}>손목 안쪽 정맥 색이 진단의 핵심이에요<br /><span style={{ color: "#BBB" }}>(생략하셔도 됩니다)</span></p>
        </div>
        <div style={{ background: "#FFF8E1", border: "1px solid #FFE082", borderRadius: 16, padding: "14px 18px", marginBottom: 16 }}>
          <p style={{ fontSize: 12, color: "#666", lineHeight: 1.7 }}>💡 손목 안쪽이 위로 오게, 자연광에서 정맥이 잘 보이게 찍어주세요.<br />🌿 <strong>초록빛</strong> = 웜톤 / 💙 <strong>파란빛</strong> = 쿨톤</p>
        </div>
        <div style={{ background: "#fff", borderRadius: 24, border: "1px solid #EEE", overflow: "hidden", marginBottom: 16 }}>
          <div style={{ position: "relative", aspectRatio: "4/3", background: "#F8F6F3", display: "flex", alignItems: "center", justifyContent: "center" }}>
            {!wristB64 && !isUploading && (<div style={{ textAlign: "center", color: "#CCC" }}><div style={{ fontSize: 40 }}>🤚</div><div style={{ fontSize: 13, marginTop: 8 }}>손목 사진 업로드</div></div>)}
            {isUploading && (<div style={{ width: 32, height: 32, border: "3px solid #C2185B30", borderTop: "3px solid #C2185B", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />)}
            {wristB64 && !isUploading && (<img src={`data:image/jpeg;base64,${wristB64}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt="" />)}
          </div>
          <div style={{ padding: 16 }}>
            <button onClick={() => wristFileRef.current?.click()} style={{ width: "100%", padding: "11px", borderRadius: 12, border: "none", background: "#C2185B", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>{wristB64 ? "🔄 다시 업로드" : "📁 손목 사진 업로드"}</button>
          </div>
        </div>
        <input ref={wristFileRef} type="file" accept="image/*" onChange={handleWristUpload} style={{ display: "none" }} />
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => setPhase("capture")} style={{ flex: 1, padding: "16px", borderRadius: 16, border: "1px solid #DDD", background: "#fff", color: "#666", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>← 이전</button>
          <button onClick={analyzeColor} style={{ flex: 2, padding: "16px", borderRadius: 16, border: "none", background: "linear-gradient(135deg,#C2185B,#880E4F)", color: "#fff", fontSize: 15, fontWeight: 800, cursor: "pointer" }}>✨ 분석 시작 {!wristB64 && "(손목 없이)"}</button>
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } } @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }`}</style>
    </div>
  );

  // KIT CONTENT (생략 — 동일)
  const KitContent = (
    <div style={{ background: "#fff", display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <div style={{ background: SEASONS[kit?.season]?.bg || "#FFF0F4", padding: "14px 20px", borderBottom: "1px solid #EEE" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {photoB64 && <img src={`data:image/jpeg;base64,${photoB64}`} style={{ width: 42, height: 42, borderRadius: "50%", objectFit: "cover", transform: "scaleX(-1)", border: `2px solid ${acc}` }} alt="" />}
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <div style={{ fontSize: 15, fontWeight: 900, color: acc }}>{SEASONS[kit?.season]?.label}</div>
              {kit?.confidence && (<div style={{ display: "flex", alignItems: "center", gap: 4, background: "#fff", borderRadius: 12, padding: "2px 8px" }}><span style={{ fontSize: 9, color: "#888" }}>정확도</span><span style={{ fontSize: 11, fontWeight: 800, color: acc }}>{kit.confidence}%</span></div>)}
            </div>
            <div style={{ fontSize: 12, color: "#777", marginTop: 2 }}>{kit?.summary}</div>
          </div>
        </div>
      </div>
      <div style={{ display: "flex", borderBottom: "1px solid #EEE" }}>
        {["palette","makeup","fashion","layering"].map(t => (
          <button key={t} onClick={() => setActiveTab(t)} style={{ flex: 1, padding: "10px 4px", border: "none", background: "none", fontSize: 11, fontWeight: activeTab === t ? 800 : 500, color: activeTab === t ? acc : "#999", borderBottom: activeTab === t ? `2px solid ${acc}` : "2px solid transparent", cursor: "pointer" }}>
            {t === "palette" ? "🎨 팔레트" : t === "makeup" ? "💄 메이크업" : t === "fashion" ? "👗 패션" : "🧥 레이어링"}
          </button>
        ))}
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "20px" }}>
        {activeTab === "palette" && (
          <div>
            <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 22, fontWeight: 700, fontStyle: "italic" }}>Best Colors ✨</p>
            <p style={{ fontSize: 12, color: "#888", marginBottom: 16, marginTop: 4 }}>이 색들은 내 피부톤을 가장 화사하게 빛나게 해줘요</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10, marginBottom: 28 }}>
              {kit?.palette?.best?.map((c: any, i: number) => <ColorCard key={i} color={c} onCopy={copyHex} />)}
            </div>
            <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 22, fontWeight: 700, fontStyle: "italic" }}>Avoid Colors 🚫</p>
            <p style={{ fontSize: 12, color: "#888", marginBottom: 16, marginTop: 4 }}>{SEASONS[kit?.season]?.avoidDesc}</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}>
              {kit?.palette?.avoid?.map((c: any, i: number) => <ColorCard key={i} color={c} onCopy={copyHex} dim />)}
            </div>
          </div>
        )}
        {activeTab === "makeup" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            <div><p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 18, fontWeight: 700, marginBottom: 8, fontStyle: "italic" }}>🫧 Foundation</p><div style={{ background: "#FAF8F5", borderRadius: 14, padding: "14px 18px", fontSize: 13, color: "#444", lineHeight: 1.7 }}>{kit?.makeup?.foundation}</div></div>
            {[{ key: "blush", label: "🌸 Blush" }, { key: "eye", label: "👁 Eye" }, { key: "lip", label: "💋 Lip" }].map(({ key, label }) => (
              <div key={key}>
                <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 18, fontWeight: 700, marginBottom: 8, fontStyle: "italic" }}>{label}</p>
                <p style={{ fontSize: 12, color: "#666", lineHeight: 1.7, marginBottom: 12 }}>{kit?.makeup?.[key]?.desc}</p>
                <div style={{ display: "grid", gridTemplateColumns: `repeat(${kit?.makeup?.[key]?.colors?.length || 2}, 1fr)`, gap: 10 }}>
                  {kit?.makeup?.[key]?.colors?.map((c: any, i: number) => <ColorCard key={i} color={c} onCopy={copyHex} />)}
                </div>
              </div>
            ))}
          </div>
        )}
        {activeTab === "fashion" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {[{ key: "tops", label: "👕 Tops" }, { key: "bottoms", label: "👖 Bottoms" }, { key: "outwear", label: "🧥 Outerwear" }, { key: "avoid", label: "⚠️ Avoid" }].map(({ key, label }) => (
              <div key={key}>
                <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 17, fontWeight: 700, marginBottom: 10, fontStyle: "italic" }}>{label}</p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {kit?.fashion?.[key]?.map((item: string) => (<span key={item} style={{ background: key === "avoid" ? "#F5F5F5" : `${acc}12`, color: key === "avoid" ? "#999" : acc, fontSize: 12, fontWeight: 600, padding: "6px 14px", borderRadius: 20 }}>{item}</span>))}
                </div>
              </div>
            ))}
          </div>
        )}
        {activeTab === "layering" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            {kit?.layering?.map((look: any, idx: number) => (
              <div key={idx} style={{ background: "#FAF8F5", borderRadius: 18, padding: 18, border: "1px solid #F0EDE8" }}>
                <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 19, fontWeight: 700, fontStyle: "italic" }}>{look.name}</p>
                <p style={{ fontSize: 12, color: "#999", marginTop: 2, marginBottom: 12 }}>{look.mood}</p>
                {look.colors?.length > 0 && (<div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(look.colors.length, 3)}, 1fr)`, gap: 8, marginBottom: 14 }}>{look.colors.map((c: any, ci: number) => <ColorCard key={ci} color={c} onCopy={copyHex} />)}</div>)}
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>{look.items?.map((item: string) => (<span key={item} style={{ background: `${acc}15`, color: acc, fontSize: 12, fontWeight: 600, padding: "4px 12px", borderRadius: 20 }}>{item}</span>))}</div>
                <div style={{ background: "#fff", borderRadius: "0 8px 8px 0", padding: "10px 14px", borderLeft: `3px solid ${acc}` }}><p style={{ fontSize: 12, color: "#555", lineHeight: 1.7 }}>💡 {look.tip}</p></div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  const WardrobeContent = (
    <div style={{ background: "#fff", display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <div style={{ padding: "14px 20px", borderBottom: "1px solid #EEE", background: "#FAFAF7" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <div>
            <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 18, fontWeight: 700, fontStyle: "italic" }}>My Wardrobe</p>
            <p style={{ fontSize: 11, color: "#888", marginTop: 2 }}>{clothes.length}벌 {clothProgress && `· ${clothProgress.current}/${clothProgress.total}`}</p>
          </div>
          {!isMobile && (
            <div style={{ display: "flex", gap: 6 }}>
              <button onClick={() => { setShowStats(!showStats); setShowSaved(false); }} title="통계" style={{ background: showStats ? acc : "#fff", color: showStats ? "#fff" : "#666", border: "1px solid #DDD", borderRadius: 20, padding: "6px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>📊 통계</button>
              <button onClick={() => { setShowSaved(!showSaved); setShowStats(false); }} title="즐겨찾기" style={{ background: showSaved ? acc : "#fff", color: showSaved ? "#fff" : "#666", border: "1px solid #DDD", borderRadius: 20, padding: "6px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>💕 {savedOutfits.length}</button>
              <button onClick={() => clothFileRef.current?.click()} disabled={isClothLoading} style={{ background: acc, color: "#fff", border: "none", borderRadius: 20, padding: "6px 12px", fontSize: 11, fontWeight: 700, cursor: isClothLoading ? "not-allowed" : "pointer", opacity: isClothLoading ? 0.6 : 1 }}>+ 추가</button>
            </div>
          )}
        </div>

        {isMobile && (
          <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
            <button onClick={() => { setShowStats(!showStats); setShowSaved(false); }} style={{ flex: 1, background: showStats ? acc : "#fff", color: showStats ? "#fff" : "#666", border: "1px solid #DDD", borderRadius: 10, padding: "8px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>📊 통계</button>
            <button onClick={() => { setShowSaved(!showSaved); setShowStats(false); }} style={{ flex: 1, background: showSaved ? acc : "#fff", color: showSaved ? "#fff" : "#666", border: "1px solid #DDD", borderRadius: 10, padding: "8px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>💕 즐겨찾기 {savedOutfits.length}</button>
            <button onClick={() => clothFileRef.current?.click()} disabled={isClothLoading} style={{ flex: 1, background: acc, color: "#fff", border: "none", borderRadius: 10, padding: "8px", fontSize: 12, fontWeight: 700, cursor: "pointer", opacity: isClothLoading ? 0.6 : 1 }}>+ 옷 추가</button>
          </div>
        )}

        <input ref={clothFileRef} type="file" accept="image/*" multiple onChange={handleClothUpload} style={{ display: "none" }} />

        {weather && !showSaved && !showStats && clothes.length > 0 && (
          <div style={{ background: "#fff", borderRadius: 12, padding: "8px 12px", marginBottom: 8, display: "flex", alignItems: "center", gap: 8, border: "1px solid #EEE" }}>
            <span style={{ fontSize: 24 }}>{weather.emoji}</span>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 13, fontWeight: 800, color: "#333", lineHeight: 1.2 }}>{weather.temp}°C · {weather.desc}</p>
              <p style={{ fontSize: 10, color: "#999" }}>오늘 날씨</p>
            </div>
          </div>
        )}

        {clothes.length > 0 && !showSaved && !showStats && stats.byCategory.length > 1 && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", paddingBottom: 4 }}>
            {["전체", ...stats.byCategory.map(s => s.cat)].map(cat => (
              <button key={cat} onClick={() => setCategoryFilter(cat)} style={{ background: categoryFilter === cat ? acc : "#fff", color: categoryFilter === cat ? "#fff" : "#666", border: "1px solid #DDD", borderRadius: 20, padding: "5px 12px", fontSize: 11, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>
                {cat}{cat !== "전체" && ` ${clothes.filter(c => c.category === cat).length}`}
              </button>
            ))}
          </div>
        )}

        {clothes.length >= 5 && !showSaved && !showStats && (
          <div style={{ marginTop: 8 }}>
            <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="🔍 옷 검색 (이름·색·무드)" style={{ width: "100%", padding: "8px 12px", borderRadius: 10, border: "1px solid #DDD", fontSize: 12, outline: "none", fontFamily: "inherit" }} />
            {searchQuery && (
              <p style={{ fontSize: 10, color: "#999", marginTop: 4, textAlign: "right" }}>
                <button onClick={() => setSearchQuery("")} style={{ background: "none", border: "none", color: acc, cursor: "pointer", fontWeight: 600 }}>✕ 검색 지우기</button>
              </p>
            )}
          </div>
        )}
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>
        {showStats && (
          <div style={{ animation: "fadeIn 0.3s" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 20, fontWeight: 700, fontStyle: "italic" }}>📊 Stats</p>
              <button onClick={() => setShowStats(false)} style={{ background: "#fff", border: "1px solid #DDD", borderRadius: 20, padding: "5px 12px", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>← 옷장</button>
            </div>
            {clothes.length < 5 ? (
              <div style={{ textAlign: "center", padding: "30px 20px", background: "#FAF8F5", borderRadius: 16 }}>
                <div style={{ fontSize: 36, marginBottom: 12 }}>📊</div>
                <p style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>옷이 5벌 이상이면<br />의미 있는 통계가 보여요</p>
                <p style={{ fontSize: 11, color: "#999" }}>현재 {clothes.length}벌 · {5 - clothes.length}벌 더 필요</p>
              </div>
            ) : (
              <>
                <div style={{ background: "#FAF8F5", borderRadius: 16, padding: 16, marginBottom: 14 }}>
                  <p style={{ fontSize: 12, fontWeight: 700, color: "#666", marginBottom: 10 }}>📦 총 {stats.total}벌</p>
                  <p style={{ fontSize: 11, fontWeight: 700, color: "#888", marginBottom: 6 }}>카테고리별</p>
                  {stats.byCategory.map(s => (
                    <div key={s.cat} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 11, width: 70, color: "#666" }}>{s.cat}</span>
                      <div style={{ flex: 1, height: 8, background: "#EEE", borderRadius: 4, overflow: "hidden" }}><div style={{ width: `${(s.count / stats.total) * 100}%`, height: "100%", background: acc, borderRadius: 4 }} /></div>
                      <span style={{ fontSize: 11, color: "#888", width: 24, textAlign: "right" }}>{s.count}</span>
                    </div>
                  ))}
                </div>
                <div style={{ background: "#FAF8F5", borderRadius: 16, padding: 16, marginBottom: 14 }}>
                  <p style={{ fontSize: 11, fontWeight: 700, color: "#888", marginBottom: 10 }}>🎨 보유한 색상 TOP 5</p>
                  {stats.topColors.map(([name, count], i) => (
                    <div key={name} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 11, width: 20, color: "#999" }}>{i + 1}</span>
                      <span style={{ fontSize: 12, flex: 1, color: "#333", fontWeight: 600 }}>{name}</span>
                      <span style={{ fontSize: 11, color: "#888" }}>{count}벌</span>
                    </div>
                  ))}
                </div>
                <div style={{ background: "#FAF8F5", borderRadius: 16, padding: 16 }}>
                  <p style={{ fontSize: 11, fontWeight: 700, color: "#888", marginBottom: 10 }}>💫 무드별</p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {stats.byMood.map(s => (<span key={s.mood} style={{ background: `${acc}12`, color: acc, fontSize: 11, fontWeight: 600, padding: "4px 12px", borderRadius: 20 }}>{s.mood} {s.count}</span>))}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {showSaved && (
          <div style={{ animation: "fadeIn 0.3s" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 20, fontWeight: 700, fontStyle: "italic" }}>💕 Saved</p>
              <button onClick={() => setShowSaved(false)} style={{ background: "#fff", border: "1px solid #DDD", borderRadius: 20, padding: "5px 12px", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>← 옷장</button>
            </div>
            {savedOutfits.length === 0 ? (
              <div style={{ textAlign: "center", padding: "30px 20px" }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>💝</div>
                <p style={{ fontSize: 13, color: "#888", lineHeight: 1.7 }}>아직 저장된 코디가 없어요<br />추천 받은 코디의 ♡를 눌러보세요</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {savedOutfits.map(out => {
                  const items = out.itemIds.map(id => findClothById(id)).filter(Boolean) as ClothItem[];
                  return (
                    <div key={out.id} style={{ background: "#fff", border: `2px solid ${acc}20`, borderRadius: 16, padding: 14 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
                        <p style={{ fontSize: 14, fontWeight: 800, color: acc }}>{out.title}</p>
                        <div style={{ display: "flex", gap: 4 }}>
                          {items.length > 0 && (<button onClick={() => shareOutfit(out, items)} title="공유" style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14 }}>📤</button>)}
                          <button onClick={() => removeSavedOutfit(out.id)} title="삭제" style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14 }}>🗑️</button>
                        </div>
                      </div>
                      <p style={{ fontSize: 11, color: "#888", marginBottom: 10 }}>{out.mood}</p>
                      {items.length > 0 ? (
                        <div style={{ display: "flex", gap: 6, marginBottom: 10, overflowX: "auto" }}>
                          {items.map((item, i) => (<img key={i} onClick={() => setZoomImage(item.image)} src={`data:image/jpeg;base64,${item.image}`} style={{ width: 100, height: 130, borderRadius: 12, objectFit: "cover", flexShrink: 0, border: "1px solid #EEE", cursor: "pointer" }} alt="" />))}
                        </div>
                      ) : (
                        <div style={{ background: "#FFF8E1", border: "1px solid #FFE082", borderRadius: 8, padding: "8px 12px", marginBottom: 10 }}>
                          <p style={{ fontSize: 11, color: "#E65100" }}>⚠️ 일부 옷이 옷장에서 삭제됐어요</p>
                        </div>
                      )}
                      <p style={{ fontSize: 12, color: "#555", lineHeight: 1.6, marginBottom: 8 }}>{out.reason}</p>
                      <div style={{ background: `${acc}10`, borderRadius: 8, padding: "8px 12px" }}><p style={{ fontSize: 11, color: acc, lineHeight: 1.6, fontWeight: 600 }}>💡 {out.tip}</p></div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {!showSaved && !showStats && (
          <>
            {clothes.length === 0 ? (
              <div style={{ textAlign: "center", padding: "30px 20px" }}>
                <div style={{ fontSize: 56, marginBottom: 16 }}>👗</div>
                <p style={{ fontSize: 16, fontWeight: 800, marginBottom: 8 }}>옷장이 비어있어요</p>
                <p style={{ fontSize: 12, color: "#888", lineHeight: 1.7, marginBottom: 20 }}>가지고 있는 옷을 등록하면<br />AI가 매일 어울리는 코디를<br />추천해줄 거예요 ✨</p>
                <button onClick={() => clothFileRef.current?.click()} style={{ background: `linear-gradient(135deg,${acc},${acc}AA)`, color: "#fff", border: "none", borderRadius: 24, padding: "12px 24px", fontSize: 13, fontWeight: 800, cursor: "pointer", boxShadow: `0 8px 24px ${acc}40` }}>+ 첫 옷 등록하기</button>
                <p style={{ fontSize: 10, color: "#BBB", marginTop: 14 }}>💡 여러 장 한꺼번에 올릴 수 있어요</p>
              </div>
            ) : (
              <>
                {searchQuery && filteredClothes.length === 0 && (
                  <div style={{ background: "#FFF8E1", border: "1px solid #FFE082", borderRadius: 12, padding: "12px 16px", marginBottom: 16, textAlign: "center" }}>
                    <p style={{ fontSize: 12, color: "#666" }}>"{searchQuery}" 검색 결과가 없어요<br /><span style={{ fontSize: 10, color: "#999" }}>아래 코디 추천은 전체 옷장 기준이에요</span></p>
                  </div>
                )}

                {filteredClothes.length > 0 && (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10, marginBottom: 20 }}>
                    {filteredClothes.map((c) => (
                      <div key={c.id} style={{ background: "#fff", borderRadius: 14, overflow: "hidden", border: selectedBaseId === c.id ? `2px solid ${acc}` : "1px solid #EEE", position: "relative", transition: "all 0.15s" }}>
                        <div onClick={() => setSelectedBaseId(selectedBaseId === c.id ? null : c.id)} style={{ aspectRatio: "3/4", overflow: "hidden", position: "relative", cursor: "pointer" }}>
                          <img src={`data:image/jpeg;base64,${c.image}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt={c.name} />
                          <div style={{ position: "absolute", top: 6, right: 6, display: "flex", gap: 4 }}>
                            <button onClick={(e) => { e.stopPropagation(); markAsWorn(c.id); }} title="오늘 입었어요" style={{ width: 24, height: 24, borderRadius: "50%", background: "rgba(0,0,0,0.5)", color: "#fff", border: "none", cursor: "pointer", fontSize: 11 }}>👕</button>
                            <button onClick={(e) => { e.stopPropagation(); setEditingCloth(c); }} style={{ width: 24, height: 24, borderRadius: "50%", background: "rgba(0,0,0,0.5)", color: "#fff", border: "none", cursor: "pointer", fontSize: 11 }}>✏️</button>
                            <button onClick={(e) => { e.stopPropagation(); removeCloth(c.id); }} style={{ width: 24, height: 24, borderRadius: "50%", background: "rgba(0,0,0,0.5)", color: "#fff", border: "none", cursor: "pointer", fontSize: 11 }}>✕</button>
                          </div>
                          {selectedBaseId === c.id && (<div style={{ position: "absolute", bottom: 6, left: 6, background: acc, color: "#fff", borderRadius: 10, padding: "2px 8px", fontSize: 10, fontWeight: 700 }}>✓ 기준</div>)}
                          {c.lastWornDate && (<div style={{ position: "absolute", bottom: 6, right: 6, background: "rgba(0,0,0,0.6)", color: "#fff", borderRadius: 10, padding: "2px 6px", fontSize: 9, fontWeight: 600 }}>📅 {c.lastWornDate.slice(5)}</div>)}
                        </div>
                        <div style={{ padding: 10 }}>
                          <p style={{ fontSize: 12, fontWeight: 700, marginBottom: 4, lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</p>
                          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                            <div style={{ width: 12, height: 12, borderRadius: "50%", background: c.mainColor, border: "1px solid #EEE", flexShrink: 0 }} />
                            <span style={{ fontSize: 10, color: "#888", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.colorName}</span>
                          </div>
                          <p style={{ fontSize: 9, color: "#AAA", marginTop: 3 }}>{c.category} · {c.mood}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div style={{ background: "#FAF8F5", borderRadius: 16, padding: 16, marginBottom: 16 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                    <p style={{ fontSize: 13, fontWeight: 800 }}>✨ 코디 추천 받기</p>
                    <button onClick={fetchWeather} disabled={weatherLoading} style={{ background: weather ? acc : "#fff", color: weather ? "#fff" : "#666", border: "1px solid #DDD", borderRadius: 20, padding: "4px 10px", fontSize: 10, fontWeight: 700, cursor: "pointer" }}>
                      {weatherLoading ? "..." : weather ? `${weather.emoji} ${weather.temp}°` : "🌤️ 오늘 날씨"}
                    </button>
                  </div>
                  <input value={situationInput} onChange={e => setSituationInput(e.target.value)} placeholder="예: 데이트, 출근 등 (선택)" style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: "1px solid #DDD", fontSize: 12, outline: "none", marginBottom: 10, fontFamily: "inherit" }} />
                  {selectedBaseId && findClothById(selectedBaseId) && (<p style={{ fontSize: 11, color: acc, marginBottom: 8, fontWeight: 600 }}>📌 기준: {findClothById(selectedBaseId)?.name}</p>)}
                  <button onClick={recommendOutfit} disabled={outfitLoading || clothes.length < 2} style={{ width: "100%", padding: "12px", borderRadius: 10, border: "none", background: clothes.length < 2 ? "#DDD" : `linear-gradient(135deg,${acc},${acc}AA)`, color: "#fff", fontSize: 13, fontWeight: 800, cursor: clothes.length < 2 ? "not-allowed" : "pointer" }}>
                    {outfitLoading ? "AI가 코디 짜는 중..." : "🎨 코디 추천 받기"}
                  </button>
                  {clothes.length < 2 && (<p style={{ fontSize: 10, color: "#999", marginTop: 6, textAlign: "center" }}>최소 2벌 이상 등록 필요</p>)}
                </div>

                {outfits.length > 0 && (
                  <div ref={outfitResultRef} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 18, fontWeight: 700, fontStyle: "italic" }}>Recommended 💕</p>
                    {outfits.map((out, idx) => {
                      const saved = isOutfitSaved(out);
                      const items = out.itemIds.map((id: string) => findClothById(id)).filter(Boolean) as ClothItem[];
                      return (
                        <div key={idx} style={{ background: "#fff", border: `2px solid ${acc}20`, borderRadius: 16, padding: 14 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
                            <p style={{ fontSize: 14, fontWeight: 800, color: acc }}>{out.title}</p>
                            <div style={{ display: "flex", gap: 6 }}>
                              <button onClick={() => shareOutfit(out, items)} title="공유" style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14 }}>📤</button>
                              <button onClick={() => toggleSaveOutfit(out)} title={saved ? "즐겨찾기 해제" : "즐겨찾기 저장"} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: saved ? acc : "#CCC" }}>
                                {saved ? "♥" : "♡"}
                              </button>
                            </div>
                          </div>
                          <p style={{ fontSize: 11, color: "#888", marginBottom: 10 }}>{out.mood}</p>
                          <div style={{ display: "flex", gap: 6, marginBottom: 10, overflowX: "auto" }}>
                            {items.map((item, i) => (<img key={i} onClick={() => setZoomImage(item.image)} src={`data:image/jpeg;base64,${item.image}`} style={{ width: 100, height: 130, borderRadius: 12, objectFit: "cover", flexShrink: 0, border: "1px solid #EEE", cursor: "pointer" }} alt="" />))}
                          </div>
                          <p style={{ fontSize: 12, color: "#555", lineHeight: 1.6, marginBottom: 8 }}>{out.reason}</p>
                          <div style={{ background: `${acc}10`, borderRadius: 8, padding: "8px 12px" }}><p style={{ fontSize: 11, color: acc, lineHeight: 1.6, fontWeight: 600 }}>💡 {out.tip}</p></div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );

  // SHOP CONTENT (영감 분석 + 옷장 매칭 + 키트 안내)
  const ShopContent = (
    <div style={{ display: "flex", flexDirection: "column", background: "#FAFAF7", height: "100%", overflow: "hidden" }}>
      <div style={{ padding: "12px 16px", borderBottom: "1px solid #E8E4DE", background: "#fff" }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: "#888", marginBottom: 8 }}>🛍️ 쇼핑 도움 — 상품 올리면 분석해줘요</p>
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10 }}>
          <div onClick={() => shopFileRef.current?.click()} style={{ width: 72, height: 72, borderRadius: 14, border: shopImg ? "none" : "2px dashed #DDD", background: "#F7F5F2", overflow: "hidden", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            {shopImg ? <img src={`data:image/jpeg;base64,${shopImg}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt="" /> : <span style={{ fontSize: 22, color: "#CCC" }}>+</span>}
          </div>
          <input ref={shopFileRef} type="file" accept="image/*" onChange={handleShopUpload} style={{ display: "none" }} />
          <p style={{ fontSize: 12, color: "#888", lineHeight: 1.6 }}>상품 이미지를 올리면<br />어울림을 분석해요</p>
        </div>

        <div style={{ borderTop: "1px solid #EEE", paddingTop: 10 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: "#888", marginBottom: 8 }}>📌 영감 분석 — 따라하고 싶은 메이크업/코디 사진 올리기</p>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <div onClick={() => inspirationFileRef.current?.click()} style={{ width: 72, height: 72, borderRadius: 14, border: inspirationImg ? "none" : "2px dashed #C2185B60", background: "#FFF0F4", overflow: "hidden", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
              {inspirationImg ? <img src={`data:image/jpeg;base64,${inspirationImg}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt="" /> : <span style={{ fontSize: 22, color: "#C2185B" }}>📌</span>}
            </div>
            <input ref={inspirationFileRef} type="file" accept="image/*" onChange={handleInspirationUpload} style={{ display: "none" }} />
            <p style={{ fontSize: 12, color: "#888", lineHeight: 1.6 }}>핀터레스트·인스타 등에서<br />캡처한 사진 올려보세요 ✨</p>
          </div>
        </div>
      </div>

      {(inspirationLoading || inspirationResult) && (
        <div ref={inspirationResultRef} style={{ padding: "14px 16px", borderBottom: "1px solid #EEE", background: "#FFF8FA" }}>
          {inspirationLoading && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0" }}>
              <div style={{ width: 24, height: 24, border: "3px solid #C2185B30", borderTop: "3px solid #C2185B", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
              <p style={{ fontSize: 12, color: "#666" }}>AI가 분석 중...</p>
            </div>
          )}
          {inspirationResult && (
            <div style={{ animation: "fadeIn 0.4s" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 16, fontWeight: 700, fontStyle: "italic", color: acc }}>
                  ✨ {inspirationResult.type === "makeup" ? "메이크업 분석" : "코디 분석"}
                </p>
                <button onClick={() => { setInspirationResult(null); setInspirationImg(null); }} style={{ background: "none", border: "none", color: "#999", cursor: "pointer", fontSize: 14 }}>✕</button>
              </div>

              <div style={{ background: "#fff", borderRadius: 12, padding: 12, marginBottom: 8 }}>
                <p style={{ fontSize: 13, fontWeight: 800, color: "#333", marginBottom: 4 }}>{inspirationResult.mood}</p>
                <p style={{ fontSize: 10, color: "#999", fontStyle: "italic" }}>{inspirationResult.moodEn}</p>

                {/* 키트 있으면 매칭 점수, 없으면 안내 */}
                {kit && inspirationResult.matchScore ? (
                  <div style={{ marginTop: 10, padding: "10px 12px", background: inspirationResult.matchScore >= 80 ? "#E8F5E9" : inspirationResult.matchScore >= 60 ? "#FFF8E1" : "#FFEBEE", borderRadius: 8 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: "#333" }}>당신({kit.season})과의 매칭</span>
                      <span style={{ fontSize: 16, fontWeight: 900, color: inspirationResult.matchScore >= 80 ? "#2E7D32" : inspirationResult.matchScore >= 60 ? "#E65100" : "#C62828" }}>
                        {inspirationResult.matchScore}점
                      </span>
                    </div>
                    <p style={{ fontSize: 11, color: "#555", lineHeight: 1.5 }}>{inspirationResult.matchComment}</p>
                  </div>
                ) : !kit && (
                  <div style={{ marginTop: 10, padding: "10px 12px", background: "#F0EDE8", borderRadius: 8, border: "1px dashed #BBB" }}>
                    <p style={{ fontSize: 11, color: "#666", lineHeight: 1.5 }}>💡 퍼스널 컬러 분석을 받으면<br /><strong>매칭 점수</strong>와 <strong>맞춤 추천</strong>을 받을 수 있어요!</p>
                  </div>
                )}
              </div>

              {inspirationResult.type === "makeup" && inspirationResult.details && (
                <div style={{ background: "#fff", borderRadius: 12, padding: 12, marginBottom: 8 }}>
                  <p style={{ fontSize: 11, fontWeight: 700, color: "#666", marginBottom: 8 }}>💄 디테일</p>
                  {[
                    { key: "lip", label: "립", icon: "💋" },
                    { key: "blush", label: "블러셔", icon: "🌸" },
                    { key: "eye", label: "아이", icon: "👁" },
                  ].filter(({key}) => inspirationResult.details[key]).map(({ key, label, icon }) => {
                    const item = inspirationResult.details[key];
                    return (
                      <div key={key} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                        <span style={{ fontSize: 14 }}>{icon}</span>
                        {item.color && isValidHex(item.color) && (
                          <button onClick={() => copyHex(item.color)} style={{ width: 28, height: 28, borderRadius: "50%", background: item.color, border: "2px solid #fff", boxShadow: `0 0 0 1px ${item.color}`, cursor: "pointer" }} />
                        )}
                        <div style={{ flex: 1 }}>
                          <p style={{ fontSize: 11, fontWeight: 700, color: "#333" }}>{label}: {item.name}</p>
                          {item.desc && <p style={{ fontSize: 10, color: "#888" }}>{item.desc}</p>}
                        </div>
                      </div>
                    );
                  })}
                  {inspirationResult.details.base && (
                    <p style={{ fontSize: 11, color: "#666", marginTop: 6, paddingTop: 6, borderTop: "1px solid #EEE" }}>🫧 베이스: {inspirationResult.details.base}</p>
                  )}
                </div>
              )}

              {inspirationResult.type === "fashion" && inspirationResult.details && (
                <div style={{ background: "#fff", borderRadius: 12, padding: 12, marginBottom: 8 }}>
                  <p style={{ fontSize: 11, fontWeight: 700, color: "#666", marginBottom: 8 }}>👗 구성</p>
                  {[
                    { key: "top", label: "상의", icon: "👕" },
                    { key: "bottom", label: "하의", icon: "👖" },
                    { key: "shoes", label: "신발", icon: "👟" },
                    { key: "accessory", label: "기타", icon: "💼" },
                  ].filter(({key}) => inspirationResult.details[key]).map(({ key, label, icon }) => (
                    <div key={key} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 14 }}>{icon}</span>
                      <p style={{ fontSize: 11, color: "#555" }}><strong>{label}:</strong> {inspirationResult.details[key]}</p>
                    </div>
                  ))}
                  {inspirationResult.colors && inspirationResult.colors.length > 0 && (
                    <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid #EEE" }}>
                      <p style={{ fontSize: 10, color: "#888", marginBottom: 4 }}>컬러 팔레트</p>
                      <div style={{ display: "flex", gap: 4 }}>
                        {inspirationResult.colors.filter((c: any) => isValidHex(c.hex)).map((c: any, i: number) => (
                          <button key={i} onClick={() => copyHex(c.hex)} title={c.name} style={{ width: 24, height: 24, borderRadius: "50%", background: c.hex, border: "2px solid #fff", boxShadow: `0 0 0 1px ${c.hex}`, cursor: "pointer" }} />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 옷장 매칭 (코디일 때만) */}
              {inspirationResult.type === "fashion" && similarClothes.length > 0 && (
                <div style={{ background: `${acc}10`, borderRadius: 12, padding: 12, marginBottom: 8 }}>
                  <p style={{ fontSize: 11, fontWeight: 700, color: acc, marginBottom: 8 }}>👗 옷장에 비슷한 옷이 {similarClothes.length}벌 있어요!</p>
                  <div style={{ display: "flex", gap: 6, overflowX: "auto" }}>
                    {similarClothes.map((c) => (
                      <div key={c.id} onClick={() => setZoomImage(c.image)} style={{ flexShrink: 0, cursor: "pointer", textAlign: "center" }}>
                        <img src={`data:image/jpeg;base64,${c.image}`} style={{ width: 60, height: 80, borderRadius: 8, objectFit: "cover", border: "1px solid #EEE" }} alt={c.name} />
                        <p style={{ fontSize: 9, color: "#666", marginTop: 4, maxWidth: 60, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {inspirationResult.tips && inspirationResult.tips.length > 0 && (
                <div style={{ background: "#fff", borderRadius: 12, padding: 12, marginBottom: 8 }}>
                  <p style={{ fontSize: 11, fontWeight: 700, color: "#666", marginBottom: 6 }}>💡 따라하는 팁</p>
                  {inspirationResult.tips.map((tip: string, i: number) => (
                    <p key={i} style={{ fontSize: 11, color: "#555", lineHeight: 1.6, marginBottom: 3 }}>• {tip}</p>
                  ))}
                </div>
              )}

              {inspirationResult.alternative && (
                <div style={{ background: `${acc}10`, borderRadius: 8, padding: "8px 12px" }}>
                  <p style={{ fontSize: 11, color: acc, lineHeight: 1.6, fontWeight: 600 }}>🎯 {inspirationResult.alternative}</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div style={{ flex: 1, overflowY: "auto", padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
        {messages.map((m, i) => (
          <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start", gap: 8 }}>
            {m.role === "ai" && (<div style={{ width: 26, height: 26, borderRadius: "50%", background: `linear-gradient(135deg,${acc},${acc}88)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, flexShrink: 0 }}>🎨</div>)}
            <div style={{ maxWidth: "80%", padding: "10px 14px", borderRadius: m.role === "user" ? "18px 18px 4px 18px" : "18px 18px 18px 4px", background: m.role === "user" ? `${acc}18` : "#fff", border: m.role === "user" ? `1px solid ${acc}30` : "1px solid #EEE", color: m.role === "user" ? acc : "#333", fontSize: 13, lineHeight: 1.7, whiteSpace: "pre-wrap", wordBreak: "keep-all" }}>{m.text}</div>
          </div>
        ))}
        {chatLoading && (<div style={{ display: "flex", gap: 8 }}><div style={{ width: 26, height: 26, borderRadius: "50%", background: `linear-gradient(135deg,${acc},${acc}88)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12 }}>🎨</div><div style={{ background: "#fff", border: "1px solid #EEE", borderRadius: "18px 18px 18px 4px", padding: "12px 16px", display: "flex", gap: 5 }}>{[0,1,2].map(i => <span key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: acc, display: "inline-block", animation: `bounce 1.2s ${i*0.2}s infinite` }} />)}</div></div>)}
        <div ref={chatEndRef} />
      </div>
      <div style={{ padding: "6px 16px", display: "flex", gap: 6, flexWrap: "wrap" }}>
        {["이 색 어울려?","대안 추천해줘","코디 어떻게?"].map(s => (<button key={s} onClick={() => sendChat(s)} disabled={chatLoading} style={{ background: "#F0EDE8", border: "none", borderRadius: 20, padding: "5px 11px", color: "#777", fontSize: 10, cursor: "pointer", fontWeight: 600 }}>{s}</button>))}
      </div>
      <div style={{ padding: "10px 16px", borderTop: "1px solid #E8E4DE", display: "flex", gap: 8, background: "#fff" }}>
        <input value={chatInput} onChange={e => setChatInput(e.target.value)} onCompositionStart={() => { isComposingRef.current = true; }} onCompositionEnd={() => { isComposingRef.current = false; }} onKeyDown={handleKeyDown} placeholder="궁금한 점을 물어보세요..." style={{ flex: 1, background: "#FAF8F5", border: "1px solid #E8E4DE", borderRadius: 22, padding: "9px 16px", color: "#333", fontSize: 13, outline: "none" }} />
        <button onClick={() => sendChat()} disabled={!chatInput.trim() || chatLoading} style={{ width: 38, height: 38, borderRadius: "50%", background: chatInput.trim() ? `linear-gradient(135deg,${acc},${acc}AA)` : "#EEE", border: "none", color: "#fff", cursor: chatInput.trim() ? "pointer" : "default", fontSize: 15 }}>↑</button>
      </div>
    </div>
  );

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", fontFamily: "'Noto Sans KR',sans-serif" }}>
      <header style={{ background: "#fff", borderBottom: "1px solid #EEE", padding: "0 20px", height: 56, display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 22 }}>🎨</span>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <strong style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 18, fontWeight: 700, fontStyle: "italic", lineHeight: 1 }}>Color Kit</strong>
            <span style={{ fontSize: 9, color: "#999", letterSpacing: 1.5 }}>YOUR PERSONAL PALETTE</span>
          </div>
          {kit && <span style={{ fontSize: 10, background: acc, color: "#fff", padding: "3px 10px", borderRadius: 20, fontWeight: 700, marginLeft: 4 }}>{kit.season}</span>}
        </div>
        <button onClick={resetAll} style={{ fontSize: 11, color: "#999", background: "none", border: "1px solid #DDD", borderRadius: 20, padding: "5px 14px", cursor: "pointer", fontWeight: 600 }}>🔄 키트 재분석</button>
      </header>

      {isMobile ? (
        <>
          <div style={{ display: "flex", borderBottom: "1px solid #EEE", background: "#fff" }}>
            <button onClick={() => setMobileView("kit")} style={{ flex: 1, padding: "12px 4px", border: "none", background: "none", fontSize: 12, fontWeight: mobileView === "kit" ? 800 : 500, color: mobileView === "kit" ? acc : "#999", borderBottom: mobileView === "kit" ? `2px solid ${acc}` : "2px solid transparent", cursor: "pointer" }}>🎨 키트</button>
            <button onClick={() => setMobileView("wardrobe")} style={{ flex: 1, padding: "12px 4px", border: "none", background: "none", fontSize: 12, fontWeight: mobileView === "wardrobe" ? 800 : 500, color: mobileView === "wardrobe" ? acc : "#999", borderBottom: mobileView === "wardrobe" ? `2px solid ${acc}` : "2px solid transparent", cursor: "pointer" }}>👗 옷장</button>
            <button onClick={() => setMobileView("chat")} style={{ flex: 1, padding: "12px 4px", border: "none", background: "none", fontSize: 12, fontWeight: mobileView === "chat" ? 800 : 500, color: mobileView === "chat" ? acc : "#999", borderBottom: mobileView === "chat" ? `2px solid ${acc}` : "2px solid transparent", cursor: "pointer" }}>🛍️ 쇼핑</button>
          </div>
          <div style={{ flex: 1, overflow: "hidden" }}>{mobileView === "kit" ? KitContent : mobileView === "wardrobe" ? WardrobeContent : ShopContent}</div>
        </>
      ) : (
        <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
          <div style={{ width: "33%", borderRight: "1px solid #EEE", overflow: "hidden" }}>{KitContent}</div>
          <div style={{ width: "34%", borderRight: "1px solid #EEE", overflow: "hidden" }}>{WardrobeContent}</div>
          <div style={{ flex: 1, overflow: "hidden" }}>{ShopContent}</div>
        </div>
      )}

      {editingCloth && (
        <div onClick={() => setEditingCloth(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2000, padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 20, padding: 24, width: "100%", maxWidth: 380, maxHeight: "90vh", overflowY: "auto" }}>
            <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 20, fontWeight: 700, fontStyle: "italic", marginBottom: 16 }}>옷 정보 수정</p>
            <img src={`data:image/jpeg;base64,${editingCloth.image}`} style={{ width: "100%", aspectRatio: "3/4", objectFit: "cover", borderRadius: 12, marginBottom: 16 }} alt="" />
            <label style={{ fontSize: 12, fontWeight: 700, color: "#666", marginBottom: 4, display: "block" }}>이름</label>
            <input value={editingCloth.name} onChange={e => setEditingCloth({...editingCloth, name: e.target.value})} style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: "1px solid #DDD", fontSize: 13, outline: "none", marginBottom: 12, fontFamily: "inherit" }} />
            <label style={{ fontSize: 12, fontWeight: 700, color: "#666", marginBottom: 4, display: "block" }}>카테고리</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
              {CATEGORIES.map(cat => (<button key={cat} onClick={() => setEditingCloth({...editingCloth, category: cat})} style={{ padding: "6px 12px", borderRadius: 20, border: "1px solid #DDD", background: editingCloth.category === cat ? acc : "#fff", color: editingCloth.category === cat ? "#fff" : "#666", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>{cat}</button>))}
            </div>
            <label style={{ fontSize: 12, fontWeight: 700, color: "#666", marginBottom: 4, display: "block" }}>무드</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
              {MOODS.map(m => (<button key={m} onClick={() => setEditingCloth({...editingCloth, mood: m})} style={{ padding: "6px 12px", borderRadius: 20, border: "1px solid #DDD", background: editingCloth.mood === m ? acc : "#fff", color: editingCloth.mood === m ? "#fff" : "#666", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>{m}</button>))}
            </div>
            <label style={{ fontSize: 12, fontWeight: 700, color: "#666", marginBottom: 4, display: "block" }}>색상 이름</label>
            <input value={editingCloth.colorName} onChange={e => setEditingCloth({...editingCloth, colorName: e.target.value})} style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: "1px solid #DDD", fontSize: 13, outline: "none", marginBottom: 16, fontFamily: "inherit" }} />
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setEditingCloth(null)} style={{ flex: 1, padding: "12px", borderRadius: 12, border: "1px solid #DDD", background: "#fff", color: "#666", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>취소</button>
              <button onClick={() => updateCloth(editingCloth)} style={{ flex: 2, padding: "12px", borderRadius: 12, border: "none", background: acc, color: "#fff", fontSize: 13, fontWeight: 800, cursor: "pointer" }}>✓ 저장</button>
            </div>
          </div>
        </div>
      )}

      {zoomImage && (
        <div onClick={() => setZoomImage(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 3000, padding: 20, cursor: "pointer" }}>
          <button onClick={(e) => { e.stopPropagation(); setZoomImage(null); }} style={{ position: "absolute", top: 20, right: 20, width: 40, height: 40, borderRadius: "50%", background: "rgba(255,255,255,0.2)", color: "#fff", border: "none", fontSize: 20, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
          <img src={`data:image/jpeg;base64,${zoomImage}`} style={{ maxWidth: "90vw", maxHeight: "90vh", objectFit: "contain", borderRadius: 12 }} alt="" />
        </div>
      )}

      {toast && (<div style={{ position: "fixed", bottom: 80, left: "50%", transform: "translateX(-50%)", background: "#1A1A1A", color: "#fff", padding: "10px 20px", borderRadius: 24, fontSize: 13, fontWeight: 600, zIndex: 1000, boxShadow: "0 8px 24px rgba(0,0,0,0.2)" }}>{toast}</div>)}

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;600;700;800;900&family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;0,700;1,400;1,600;1,700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        @keyframes bounce { 0%,60%,100%{transform:translateY(0)} 30%{transform:translateY(-5px)} }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
}