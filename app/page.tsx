"use client";

import { useState, useRef, useEffect } from "react";

const SEASONS: Record<string, { bg: string; accent: string; label: string; avoidDesc: string }> = {
  "봄웜": { bg: "linear-gradient(135deg,#FFE0B2,#FFF3E0)", accent: "#E65100", label: "🌸 Spring Warm", avoidDesc: "어둡고 차가운 색은 피부를 칙칙하게 만들어요" },
  "여름쿨": { bg: "linear-gradient(135deg,#E3F2FD,#F3E5F5)", accent: "#5C6BC0", label: "🌊 Summer Cool", avoidDesc: "강한 웜톤이나 노란빛은 안색을 누렇게 보이게 해요" },
  "가을웜": { bg: "linear-gradient(135deg,#FFF8E1,#FBE9E7)", accent: "#BF360C", label: "🍂 Autumn Warm", avoidDesc: "차가운 파스텔이나 형광 색은 피부를 창백하게 보이게 해요" },
  "겨울쿨": { bg: "linear-gradient(135deg,#E8EAF6,#ECEFF1)", accent: "#1A237E", label: "❄️ Winter Cool", avoidDesc: "탁한 어스 톤은 피부를 피곤해 보이게 만들어요" },
};

const isValidHex = (color: string) => /^#[0-9A-F]{6}$/i.test(color);

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

function ColorSwatch({ color, size = 40, onCopy, dim = false }: { color: string; size?: number; onCopy: (c: string) => void; dim?: boolean }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
      <button
        onClick={() => onCopy(color)}
        title="클릭하면 색상 코드가 복사돼요"
        style={{
          width: size, height: size, borderRadius: "50%", background: color,
          boxShadow: dim ? "none" : `0 0 0 3px #fff, 0 0 0 5px ${color}`,
          opacity: dim ? 0.5 : 1, border: "none", cursor: "pointer",
          transition: "transform 0.2s",
        }}
        onMouseEnter={(e) => e.currentTarget.style.transform = "scale(1.1)"}
        onMouseLeave={(e) => e.currentTarget.style.transform = "scale(1)"}
      />
      <span style={{ fontSize: 9, color: "#888", fontFamily: "'Cormorant Garamond', serif", fontWeight: 600, letterSpacing: 0.3 }}>{color}</span>
    </div>
  );
}

type Phase = "guide" | "capture" | "wrist" | "analyzing" | "kit";

export default function Home() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const wristFileRef = useRef<HTMLInputElement>(null);
  const shopFileRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
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
  const [mobileView, setMobileView] = useState<"kit" | "chat">("kit");
  const [analyzeStep, setAnalyzeStep] = useState(0);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    if (!isAnalyzing) { setAnalyzeStep(0); return; }
    const interval = setInterval(() => {
      setAnalyzeStep(s => (s + 1) % 4);
    }, 1500);
    return () => clearInterval(interval);
  }, [isAnalyzing]);

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
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    c.getContext("2d")?.drawImage(v, 0, 0);
    const resized = resizeCanvas(c);
    setPhotoB64(resized);
    setError(null);
    stopCam();
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return;
    setIsUploading(true);
    try {
      const data = await resizeImage(f);
      setPhotoB64(data);
      setError(null);
    } catch { setError("이미지 처리 중 오류가 발생했어요."); }
    setIsUploading(false);
  };

  const handleWristUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return;
    setIsUploading(true);
    try {
      const data = await resizeImage(f);
      setWristB64(data);
    } catch { setError("이미지 처리 중 오류가 발생했어요."); }
    setIsUploading(false);
  };

  const handleShopUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return;
    if (!kit) {
      setMessages(p => [...p, { role: "ai", text: "먼저 왼쪽에서 퍼스널 컬러 분석을 완료해주세요! 📷" }]);
      return;
    }
    const data = await resizeImage(f);
    setShopImg(data);
    if (isMobile) setMobileView("chat");
    await analyzeShopItem(data);
  };

  const analyzeColor = async () => {
    if (!photoB64 || isAnalyzing) return;
    setIsAnalyzing(true);
    setPhase("analyzing");
    setError(null);
    setQualityIssues(null);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ faceImage: photoB64, wristImage: wristB64 }),
      });
      const data = await res.json();

      if (data.qualityFailed) {
        setQualityIssues({ issues: data.issues, advice: data.advice });
        setPhase("capture");
        setIsAnalyzing(false);
        return;
      }

      if (data.error) throw new Error(data.error);
      setKit(data.kit);
      setPhase("kit");
      setMessages([{ role: "ai", text: `✨ ${data.kit.season} 분석 완료! 키트를 확인해보세요. 쇼핑 중 궁금한 점은 언제든 물어봐요 💕` }]);
      setChatHistory([
        { role: "user", content: `내 퍼스널 컬러: ${JSON.stringify(data.kit)}` },
        { role: "assistant", content: `${data.kit.season} 분석 완료! 쇼핑 도움 드릴게요 💕` },
      ]);
    } catch {
      setError("분석 오류가 발생했어요. 다시 시도해주세요.");
      setPhase("capture");
    }
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
        body: JSON.stringify({
          messages: [...chatHistory, { role: "user", content: userText }],
          imageBase64: b64
        }),
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
      e.preventDefault();
      sendChat();
    }
  };

  const resetAll = () => {
    setPhase("guide");
    setKit(null);
    setPhotoB64(null);
    setWristB64(null);
    setMessages([]);
    setChatHistory([]);
    setShopImg(null);
    setQualityIssues(null);
    setError(null);
  };

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);
  useEffect(() => () => stopCam(), []);

  const acc = kit ? (SEASONS[kit.season]?.accent || "#C2185B") : "#C2185B";

  // ── GUIDE PHASE (체크리스트) ──
  if (phase === "guide") return (
    <div style={{ minHeight: "100vh", background: "#FAFAF7", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: "'Noto Sans KR',sans-serif", padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 480, animation: "fadeIn 0.6s ease-out" }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ fontSize: 48, marginBottom: 8 }}>🎨</div>
          <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 14, color: "#C2185B", fontStyle: "italic", letterSpacing: 2, marginBottom: 8 }}>BEFORE WE START</p>
          <h1 style={{ fontSize: 26, fontWeight: 900, letterSpacing: "-1px", marginBottom: 10, color: "#1A1A1A" }}>정확한 진단을 위해</h1>
          <p style={{ fontSize: 13, color: "#888", lineHeight: 1.7 }}>아래 가이드를 확인하면<br />훨씬 정확한 결과를 얻을 수 있어요</p>
        </div>

        <div style={{ background: "#fff", borderRadius: 20, padding: "20px 24px", border: "1px solid #EEE", boxShadow: "0 4px 24px rgba(0,0,0,0.04)", marginBottom: 16 }}>
          <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 16, fontWeight: 700, fontStyle: "italic", marginBottom: 14, color: "#1A1A1A" }}>📸 사진 촬영 가이드</p>
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
                <div>
                  <p style={{ fontSize: 13, fontWeight: 700, color: "#1A1A1A" }}>{item.title}</p>
                  <p style={{ fontSize: 12, color: "#888", lineHeight: 1.6, marginTop: 2 }}>{item.desc}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <button
          onClick={() => setPhase("capture")}
          style={{ width: "100%", padding: "16px", borderRadius: 16, border: "none", background: "linear-gradient(135deg,#C2185B,#880E4F)", color: "#fff", fontSize: 15, fontWeight: 800, cursor: "pointer", boxShadow: "0 8px 24px rgba(194,24,91,0.3)" }}
        >
          ✨ 시작하기
        </button>
        <p style={{ fontSize: 11, color: "#BBB", textAlign: "center", marginTop: 12 }}>약 30초 ~ 1분 소요</p>
      </div>
      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );

  // ── ANALYZING ──
  if (phase === "analyzing") {
    const steps = ["📸 사진 분석 중", "🎨 피부톤 측정 중", "✨ 컬러 매칭 중", "💄 키트 생성 중"];
    return (
      <div style={{ minHeight: "100vh", background: "linear-gradient(135deg, #FFF0F4 0%, #F5F0FF 50%, #FFF8F0 100%)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: "'Noto Sans KR',sans-serif", padding: 24 }}>
        <div style={{ width: 180, height: 180, position: "relative", marginBottom: 32 }}>
          <div style={{
            width: "100%", height: "100%", borderRadius: "50%",
            background: "conic-gradient(from 0deg, #E65100, #BF360C, #1A237E, #5C6BC0, #E65100)",
            animation: "spin 3s linear infinite",
            boxShadow: "0 8px 40px rgba(194, 24, 91, 0.3)",
          }} />
          <div style={{
            position: "absolute", inset: 30, borderRadius: "50%", background: "#fff",
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 42,
          }}>🎨</div>
        </div>

        <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 32, fontWeight: 700, color: "#1A1A1A", marginBottom: 8, letterSpacing: "-0.5px", fontStyle: "italic" }}>
          Analyzing your colors
        </h2>
        <p style={{ fontSize: 13, color: "#888", marginBottom: 32 }}>잠시만 기다려주세요...</p>

        <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "center" }}>
          {steps.map((s, i) => (
            <div key={s} style={{
              fontSize: 13,
              color: i === analyzeStep ? "#C2185B" : i < analyzeStep ? "#999" : "#CCC",
              fontWeight: i === analyzeStep ? 700 : 500,
              transition: "all 0.3s",
              opacity: i === analyzeStep ? 1 : 0.6,
            }}>
              {i < analyzeStep ? "✓ " : ""}{s}{i === analyzeStep ? "..." : ""}
            </div>
          ))}
        </div>

        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // ── CAPTURE PHASE ──
  if (phase === "capture") return (
    <div style={{ minHeight: "100vh", background: "#FAFAF7", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: "'Noto Sans KR',sans-serif", padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 440, animation: "fadeIn 0.6s ease-out" }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 13, color: "#C2185B", fontStyle: "italic", letterSpacing: 2, marginBottom: 6 }}>STEP 1 / 2</p>
          <h1 style={{ fontSize: 24, fontWeight: 900, letterSpacing: "-1px", marginBottom: 6, color: "#1A1A1A" }}>얼굴 사진 📷</h1>
          <p style={{ fontSize: 13, color: "#888", lineHeight: 1.6 }}>자연광에서 메이크업 없이 정면으로</p>
        </div>

        {/* 품질 이슈 안내 */}
        {qualityIssues && (
          <div style={{ background: "#FFF8E1", border: "1px solid #FFD54F", borderRadius: 16, padding: "14px 18px", marginBottom: 16 }}>
            <p style={{ fontSize: 13, fontWeight: 800, color: "#E65100", marginBottom: 8 }}>⚠️ 사진을 다시 찍어주세요</p>
            <ul style={{ listStyle: "none", marginBottom: 8 }}>
              {qualityIssues.issues.map((iss, i) => (
                <li key={i} style={{ fontSize: 12, color: "#666", lineHeight: 1.7 }}>• {iss}</li>
              ))}
            </ul>
            <p style={{ fontSize: 12, color: "#444", lineHeight: 1.6, fontStyle: "italic" }}>💡 {qualityIssues.advice}</p>
          </div>
        )}

        <div style={{ background: "#fff", borderRadius: 24, border: "1px solid #EEE", overflow: "hidden", marginBottom: 16, boxShadow: "0 4px 24px rgba(0,0,0,0.04)" }}>
          <div style={{ position: "relative", aspectRatio: "4/3", background: "#F8F6F3", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <video ref={videoRef} style={{ width: "100%", height: "100%", objectFit: "cover", transform: "scaleX(-1)", display: cameraOn ? "block" : "none" }} autoPlay muted playsInline />
            <canvas ref={canvasRef} style={{ display: "none" }} />
            {!cameraOn && !photoB64 && !isUploading && (
              <div style={{ textAlign: "center", color: "#CCC" }}>
                <div style={{ fontSize: 40 }}>📷</div>
                <div style={{ fontSize: 13, marginTop: 8 }}>카메라 또는 사진 업로드</div>
              </div>
            )}
            {isUploading && (
              <div style={{ textAlign: "center", color: "#C2185B" }}>
                <div style={{ width: 32, height: 32, border: "3px solid #C2185B30", borderTop: "3px solid #C2185B", borderRadius: "50%", margin: "0 auto", animation: "spin 0.8s linear infinite" }} />
                <div style={{ fontSize: 13, marginTop: 12, fontWeight: 600 }}>이미지 처리 중...</div>
              </div>
            )}
            {photoB64 && !cameraOn && !isUploading && (
              <img src={`data:image/jpeg;base64,${photoB64}`} style={{ width: "100%", height: "100%", objectFit: "cover", transform: "scaleX(-1)" }} alt="" />
            )}
          </div>
          <div style={{ padding: 16, display: "flex", gap: 8 }}>
            {!cameraOn && !photoB64 && <>
              <button onClick={startCam} disabled={isUploading} style={{ flex: 2, padding: "11px", borderRadius: 12, border: "none", background: "#C2185B", color: "#fff", fontWeight: 700, fontSize: 13, cursor: isUploading ? "not-allowed" : "pointer", opacity: isUploading ? 0.6 : 1 }}>📷 카메라 켜기</button>
              <button onClick={() => fileRef.current?.click()} disabled={isUploading} style={{ flex: 1, padding: "11px", borderRadius: 12, border: "1px solid #DDD", background: "#fff", fontWeight: 700, fontSize: 13, cursor: isUploading ? "not-allowed" : "pointer", opacity: isUploading ? 0.6 : 1 }}>📁 업로드</button>
            </>}
            {cameraOn && (
              <button onClick={captureSnap} style={{ flex: 1, padding: "11px", borderRadius: 12, border: "none", background: "#C2185B", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>📸 촬영하기</button>
            )}
            {photoB64 && !cameraOn && (
              <button onClick={() => { setPhotoB64(null); setError(null); startCam(); }} style={{ flex: 1, padding: "11px", borderRadius: 12, border: "1px solid #DDD", background: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>🔄 다시 찍기</button>
            )}
          </div>
        </div>

        <input ref={fileRef} type="file" accept="image/*" onChange={handleUpload} style={{ display: "none" }} />
        {error && (
          <div style={{ background: "#FFF0F0", border: "1px solid #FFCCCC", borderRadius: 12, padding: "10px 16px", color: "#C00", fontSize: 13, textAlign: "center", marginBottom: 12 }}>{error}</div>
        )}

        <button
          onClick={() => setPhase("wrist")}
          disabled={!photoB64}
          style={{ width: "100%", padding: "16px", borderRadius: 16, border: "none", background: photoB64 ? "linear-gradient(135deg,#C2185B,#880E4F)" : "#E0DDD8", color: photoB64 ? "#fff" : "#AAA", fontSize: 15, fontWeight: 800, cursor: photoB64 ? "pointer" : "not-allowed", transition: "all 0.2s" }}
        >
          다음 단계 → 손목 사진
        </button>
      </div>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );

  // ── WRIST PHASE ──
  if (phase === "wrist") return (
    <div style={{ minHeight: "100vh", background: "#FAFAF7", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: "'Noto Sans KR',sans-serif", padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 440, animation: "fadeIn 0.6s ease-out" }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 13, color: "#C2185B", fontStyle: "italic", letterSpacing: 2, marginBottom: 6 }}>STEP 2 / 2</p>
          <h1 style={{ fontSize: 24, fontWeight: 900, letterSpacing: "-1px", marginBottom: 6, color: "#1A1A1A" }}>손목 사진 🤚</h1>
          <p style={{ fontSize: 13, color: "#888", lineHeight: 1.6 }}>손목 안쪽 정맥 색이 진단의 핵심이에요<br /><span style={{ color: "#BBB" }}>(생략하셔도 됩니다)</span></p>
        </div>

        <div style={{ background: "#FFF8E1", border: "1px solid #FFE082", borderRadius: 16, padding: "14px 18px", marginBottom: 16 }}>
          <p style={{ fontSize: 12, color: "#666", lineHeight: 1.7 }}>
            💡 <strong>찍는 방법:</strong> 손목 안쪽이 위로 오게, 자연광에서 정맥이 잘 보이게 찍어주세요.<br />
            🌿 <strong>초록빛</strong> = 웜톤 / 💙 <strong>파란빛</strong> = 쿨톤
          </p>
        </div>

        <div style={{ background: "#fff", borderRadius: 24, border: "1px solid #EEE", overflow: "hidden", marginBottom: 16, boxShadow: "0 4px 24px rgba(0,0,0,0.04)" }}>
          <div style={{ position: "relative", aspectRatio: "4/3", background: "#F8F6F3", display: "flex", alignItems: "center", justifyContent: "center" }}>
            {!wristB64 && !isUploading && (
              <div style={{ textAlign: "center", color: "#CCC" }}>
                <div style={{ fontSize: 40 }}>🤚</div>
                <div style={{ fontSize: 13, marginTop: 8 }}>손목 사진 업로드</div>
              </div>
            )}
            {isUploading && (
              <div style={{ textAlign: "center", color: "#C2185B" }}>
                <div style={{ width: 32, height: 32, border: "3px solid #C2185B30", borderTop: "3px solid #C2185B", borderRadius: "50%", margin: "0 auto", animation: "spin 0.8s linear infinite" }} />
                <div style={{ fontSize: 13, marginTop: 12, fontWeight: 600 }}>이미지 처리 중...</div>
              </div>
            )}
            {wristB64 && !isUploading && (
              <img src={`data:image/jpeg;base64,${wristB64}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt="" />
            )}
          </div>
          <div style={{ padding: 16, display: "flex", gap: 8 }}>
            <button onClick={() => wristFileRef.current?.click()} style={{ flex: 1, padding: "11px", borderRadius: 12, border: "none", background: "#C2185B", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
              {wristB64 ? "🔄 다시 업로드" : "📁 손목 사진 업로드"}
            </button>
          </div>
        </div>

        <input ref={wristFileRef} type="file" accept="image/*" onChange={handleWristUpload} style={{ display: "none" }} />

        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => setPhase("capture")}
            style={{ flex: 1, padding: "16px", borderRadius: 16, border: "1px solid #DDD", background: "#fff", color: "#666", fontSize: 14, fontWeight: 700, cursor: "pointer" }}
          >
            ← 이전
          </button>
          <button
            onClick={analyzeColor}
            style={{ flex: 2, padding: "16px", borderRadius: 16, border: "none", background: "linear-gradient(135deg,#C2185B,#880E4F)", color: "#fff", fontSize: 15, fontWeight: 800, cursor: "pointer", boxShadow: "0 8px 24px rgba(194,24,91,0.3)" }}
          >
            ✨ 분석 시작 {!wristB64 && "(손목 없이)"}
          </button>
        </div>
      </div>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );

  // ── KIT PHASE ──
  const KitContent = (
    <div style={{ background: "#fff", display: "flex", flexDirection: "column", height: "100%", overflow: "hidden", animation: "fadeIn 0.5s ease-out" }}>
      <div style={{ background: SEASONS[kit?.season]?.bg || "#FFF0F4", padding: "14px 20px", borderBottom: "1px solid #EEE" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {photoB64 && <img src={`data:image/jpeg;base64,${photoB64}`} style={{ width: 42, height: 42, borderRadius: "50%", objectFit: "cover", transform: "scaleX(-1)", border: `2px solid ${acc}` }} alt="" />}
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <div style={{ fontSize: 15, fontWeight: 900, color: acc }}>{SEASONS[kit?.season]?.label}</div>
              {kit?.confidence && (
                <div style={{ display: "flex", alignItems: "center", gap: 4, background: "#fff", borderRadius: 12, padding: "2px 8px", border: `1px solid ${acc}30` }}>
                  <span style={{ fontSize: 9, color: "#888" }}>정확도</span>
                  <span style={{ fontSize: 11, fontWeight: 800, color: acc }}>{kit.confidence}%</span>
                </div>
              )}
            </div>
            <div style={{ fontSize: 12, color: "#777", marginTop: 2 }}>{kit?.summary}</div>
            {kit?.secondaryGuess && kit.confidence < 80 && (
              <div style={{ fontSize: 11, color: "#999", marginTop: 4, fontStyle: "italic" }}>
                💡 {kit.secondaryGuess} 가능성도 있어요
              </div>
            )}
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

      <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>
        {activeTab === "palette" && (
          <div>
            <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 16, fontWeight: 700, color: "#1A1A1A", marginBottom: 4, fontStyle: "italic" }}>Best Colors</p>
            <p style={{ fontSize: 11, color: "#888", marginBottom: 12, lineHeight: 1.5 }}>이 색들은 내 피부톤을 가장 화사하게 빛나게 해줘요 ✨</p>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 24 }}>
              {kit?.palette?.best?.filter(isValidHex).map((c: string) => (
                <ColorSwatch key={c} color={c} onCopy={copyHex} />
              ))}
            </div>
            <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 16, fontWeight: 700, color: "#1A1A1A", marginBottom: 4, fontStyle: "italic" }}>Avoid Colors</p>
            <p style={{ fontSize: 11, color: "#888", marginBottom: 12, lineHeight: 1.5 }}>{SEASONS[kit?.season]?.avoidDesc || "이 색들은 피부톤과 잘 맞지 않아요"}</p>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {kit?.palette?.avoid?.filter(isValidHex).map((c: string) => (
                <ColorSwatch key={c} color={c} onCopy={copyHex} dim />
              ))}
            </div>
          </div>
        )}

        {activeTab === "makeup" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 15, fontWeight: 700, marginBottom: 8, fontStyle: "italic" }}>🫧 Foundation</p>
              <div style={{ background: "#FAF8F5", borderRadius: 12, padding: "10px 14px", fontSize: 13, color: "#444", lineHeight: 1.7 }}>{kit?.makeup?.foundation}</div>
            </div>
            {[{ key: "blush", label: "🌸 Blush" }, { key: "eye", label: "👁 Eye" }, { key: "lip", label: "💋 Lip" }].map(({ key, label }) => (
              <div key={key}>
                <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 15, fontWeight: 700, marginBottom: 8, fontStyle: "italic" }}>{label}</p>
                <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                  <div style={{ display: "flex", gap: 6 }}>
                    {kit?.makeup?.[key]?.colors?.filter(isValidHex).map((c: string) => (
                      <ColorSwatch key={c} color={c} size={32} onCopy={copyHex} />
                    ))}
                  </div>
                  <p style={{ fontSize: 12, color: "#555", lineHeight: 1.7, flex: 1, minWidth: 150 }}>{kit?.makeup?.[key]?.desc}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === "fashion" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {[{ key: "tops", label: "👕 Tops" }, { key: "bottoms", label: "👖 Bottoms" }, { key: "outwear", label: "🧥 Outerwear" }, { key: "avoid", label: "⚠️ Avoid" }].map(({ key, label }) => (
              <div key={key}>
                <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 15, fontWeight: 700, marginBottom: 8, fontStyle: "italic" }}>{label}</p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {kit?.fashion?.[key]?.map((item: string) => (
                    <span key={item} style={{ background: key === "avoid" ? "#F5F5F5" : `${acc}12`, color: key === "avoid" ? "#999" : acc, fontSize: 11, fontWeight: 600, padding: "4px 12px", borderRadius: 20 }}>{item}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === "layering" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {kit?.layering?.map((look: any, idx: number) => (
              <div key={idx} style={{ background: "#FAF8F5", borderRadius: 16, padding: 16, border: "1px solid #F0EDE8" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                  <div>
                    <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 16, fontWeight: 700, fontStyle: "italic" }}>{look.name}</p>
                    <p style={{ fontSize: 11, color: "#999" }}>{look.mood}</p>
                  </div>
                  {look.colors?.length > 0 && (
                    <div style={{ display: "flex" }}>
                      {look.colors.filter(isValidHex).map((c: string, ci: number) => (
                        <button key={ci} onClick={() => copyHex(c)} title={c} style={{ width: 22, height: 22, borderRadius: "50%", background: c, border: "2px solid #fff", marginLeft: ci > 0 ? -6 : 0, cursor: "pointer", padding: 0 }} />
                      ))}
                    </div>
                  )}
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 10 }}>
                  {look.items?.map((item: string) => (
                    <span key={item} style={{ background: `${acc}12`, color: acc, fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 20 }}>{item}</span>
                  ))}
                </div>
                <div style={{ borderLeft: `3px solid ${acc}`, paddingLeft: 10 }}>
                  <p style={{ fontSize: 12, color: "#555", lineHeight: 1.6 }}>💡 {look.tip}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  const ShopContent = (
    <div style={{ display: "flex", flexDirection: "column", background: "#FAFAF7", height: "100%", overflow: "hidden" }}>
      <div style={{ padding: "12px 16px", borderBottom: "1px solid #E8E4DE", background: "#fff" }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: "#888", marginBottom: 8 }}>🛍️ 상품 올리면 AI가 어울리는지 바로 알려줘요</p>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <div onClick={() => shopFileRef.current?.click()} style={{ width: 72, height: 72, borderRadius: 14, border: shopImg ? "none" : "2px dashed #DDD", background: "#F7F5F2", overflow: "hidden", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            {shopImg ? <img src={`data:image/jpeg;base64,${shopImg}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt="" /> : <span style={{ fontSize: 22, color: "#CCC" }}>+</span>}
          </div>
          <input ref={shopFileRef} type="file" accept="image/*" onChange={handleShopUpload} style={{ display: "none" }} />
          <p style={{ fontSize: 12, color: "#888", lineHeight: 1.6 }}>상품 이미지를 올리면<br />키트와 비교해서 분석해요</p>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
        {messages.map((m, i) => (
          <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start", gap: 8 }}>
            {m.role === "ai" && (
              <div style={{ width: 26, height: 26, borderRadius: "50%", background: `linear-gradient(135deg,${acc},${acc}88)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, flexShrink: 0 }}>🎨</div>
            )}
            <div style={{ maxWidth: "80%", padding: "10px 14px", borderRadius: m.role === "user" ? "18px 18px 4px 18px" : "18px 18px 18px 4px", background: m.role === "user" ? `${acc}18` : "#fff", border: m.role === "user" ? `1px solid ${acc}30` : "1px solid #EEE", color: m.role === "user" ? acc : "#333", fontSize: 13, lineHeight: 1.7, whiteSpace: "pre-wrap", wordBreak: "keep-all" }}>{m.text}</div>
          </div>
        ))}
        {chatLoading && (
          <div style={{ display: "flex", gap: 8 }}>
            <div style={{ width: 26, height: 26, borderRadius: "50%", background: `linear-gradient(135deg,${acc},${acc}88)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12 }}>🎨</div>
            <div style={{ background: "#fff", border: "1px solid #EEE", borderRadius: "18px 18px 18px 4px", padding: "12px 16px", display: "flex", gap: 5 }}>
              {[0,1,2].map(i => <span key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: acc, display: "inline-block", animation: `bounce 1.2s ${i*0.2}s infinite` }} />)}
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      <div style={{ padding: "6px 16px", display: "flex", gap: 6, flexWrap: "wrap" }}>
        {["이 색 나한테 어울려?","대안 색상 추천해줘","레이어링 어떻게 해?"].map(s => (
          <button key={s} onClick={() => sendChat(s)} disabled={chatLoading} style={{ background: "#F0EDE8", border: "none", borderRadius: 20, padding: "5px 11px", color: "#777", fontSize: 10, cursor: chatLoading ? "not-allowed" : "pointer", fontWeight: 600, opacity: chatLoading ? 0.5 : 1 }}>{s}</button>
        ))}
      </div>

      <div style={{ padding: "10px 16px", borderTop: "1px solid #E8E4DE", display: "flex", gap: 8, background: "#fff" }}>
        <input
          value={chatInput}
          onChange={e => setChatInput(e.target.value)}
          onCompositionStart={() => { isComposingRef.current = true; }}
          onCompositionEnd={() => { isComposingRef.current = false; }}
          onKeyDown={handleKeyDown}
          placeholder="궁금한 점을 물어보세요..."
          style={{ flex: 1, background: "#FAF8F5", border: "1px solid #E8E4DE", borderRadius: 22, padding: "9px 16px", color: "#333", fontSize: 13, outline: "none" }}
        />
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
            <strong style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 18, fontWeight: 700, letterSpacing: "-0.5px", color: "#1A1A1A", fontStyle: "italic", lineHeight: 1 }}>Color Kit</strong>
            <span style={{ fontSize: 9, color: "#999", letterSpacing: 1.5 }}>YOUR PERSONAL PALETTE</span>
          </div>
          {kit && <span style={{ fontSize: 10, background: acc, color: "#fff", padding: "3px 10px", borderRadius: 20, fontWeight: 700, marginLeft: 4 }}>{kit.season}</span>}
        </div>
        <button onClick={resetAll} style={{ fontSize: 11, color: "#999", background: "none", border: "1px solid #DDD", borderRadius: 20, padding: "5px 14px", cursor: "pointer", fontWeight: 600 }}>🔄 재분석</button>
      </header>

      {isMobile ? (
        <>
          <div style={{ display: "flex", borderBottom: "1px solid #EEE", background: "#fff", flexShrink: 0 }}>
            <button onClick={() => setMobileView("kit")} style={{ flex: 1, padding: "12px", border: "none", background: "none", fontSize: 13, fontWeight: mobileView === "kit" ? 800 : 500, color: mobileView === "kit" ? acc : "#999", borderBottom: mobileView === "kit" ? `2px solid ${acc}` : "2px solid transparent", cursor: "pointer" }}>
              🎨 내 키트
            </button>
            <button onClick={() => setMobileView("chat")} style={{ flex: 1, padding: "12px", border: "none", background: "none", fontSize: 13, fontWeight: mobileView === "chat" ? 800 : 500, color: mobileView === "chat" ? acc : "#999", borderBottom: mobileView === "chat" ? `2px solid ${acc}` : "2px solid transparent", cursor: "pointer" }}>
              🛍️ 쇼핑 도움
            </button>
          </div>
          <div style={{ flex: 1, overflow: "hidden" }}>
            {mobileView === "kit" ? KitContent : ShopContent}
          </div>
        </>
      ) : (
        <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
          <div style={{ width: "52%", borderRight: "1px solid #EEE", overflow: "hidden" }}>{KitContent}</div>
          <div style={{ flex: 1, overflow: "hidden" }}>{ShopContent}</div>
        </div>
      )}

      {toast && (
        <div style={{
          position: "fixed", bottom: 80, left: "50%", transform: "translateX(-50%)",
          background: "#1A1A1A", color: "#fff", padding: "10px 20px", borderRadius: 24,
          fontSize: 13, fontWeight: 600, zIndex: 1000,
          animation: "toastIn 0.3s ease-out",
          boxShadow: "0 8px 24px rgba(0,0,0,0.2)",
        }}>
          {toast}
        </div>
      )}

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;600;700;800;900&family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;0,700;1,400;1,600;1,700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        @keyframes bounce { 0%,60%,100%{transform:translateY(0)} 30%{transform:translateY(-5px)} }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes toastIn { from { opacity: 0; transform: translate(-50%, 10px); } to { opacity: 1; transform: translate(-50%, 0); } }
      `}</style>
    </div>
  );
}