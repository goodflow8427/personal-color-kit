"use client";

import { useState, useRef, useEffect } from "react";

const SEASONS: Record<string, { bg: string; accent: string; label: string }> = {
  "봄웜": { bg: "linear-gradient(135deg,#FFE0B2,#FFF3E0)", accent: "#E65100", label: "🌸 Spring Warm" },
  "여름쿨": { bg: "linear-gradient(135deg,#E3F2FD,#F3E5F5)", accent: "#5C6BC0", label: "🌊 Summer Cool" },
  "가을웜": { bg: "linear-gradient(135deg,#FFF8E1,#FBE9E7)", accent: "#BF360C", label: "🍂 Autumn Warm" },
  "겨울쿨": { bg: "linear-gradient(135deg,#E8EAF6,#ECEFF1)", accent: "#1A237E", label: "❄️ Winter Cool" },
};

const toB64 = (file: File): Promise<string> =>
  new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = (e) => res((e.target?.result as string).split(",")[1]);
    r.onerror = rej;
    r.readAsDataURL(file);
  });

export default function Home() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const shopFileRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const [phase, setPhase] = useState<"capture" | "analyzing" | "kit">("capture");
  const [cameraOn, setCameraOn] = useState(false);
  const [photoB64, setPhotoB64] = useState<string | null>(null);
  const [kit, setKit] = useState<any>(null);
  const [activeTab, setActiveTab] = useState("palette");
  const [shopImg, setShopImg] = useState<string | null>(null);
  const [messages, setMessages] = useState<{ role: string; text: string }[]>([]);
  const [chatHistory, setChatHistory] = useState<any[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startCam = async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
      streamRef.current = s;
      if (videoRef.current) { videoRef.current.srcObject = s; videoRef.current.play(); }
      setCameraOn(true);
    } catch { setError("카메라 권한을 허용해주세요."); }
  };

  const stopCam = () => { streamRef.current?.getTracks().forEach(t => t.stop()); setCameraOn(false); };

  const captureSnap = () => {
    const v = videoRef.current, c = canvasRef.current;
    if (!v || !c) return;
    c.width = v.videoWidth; c.height = v.videoHeight;
    c.getContext("2d")?.drawImage(v, 0, 0);
    setPhotoB64(c.toDataURL("image/jpeg", 0.85).split(",")[1]);
    stopCam();
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return;
    setPhotoB64(await toB64(f));
  };

  const handleShopUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return;
    const b64 = await toB64(f);
    setShopImg(b64);
    await analyzeShopItem(b64);
  };

  const analyzeColor = async () => {
    if (!photoB64) return;
    setPhase("analyzing"); setError(null);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: photoB64 }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setKit(data.kit);
      setPhase("kit");
      setMessages([{ role: "ai", text: `✨ ${data.kit.season} 분석 완료! 왼쪽 키트를 확인해보세요. 쇼핑 중 궁금한 점은 언제든 물어봐요 💕` }]);
      setChatHistory([
        { role: "user", content: `내 퍼스널 컬러: ${JSON.stringify(data.kit)}` },
        { role: "assistant", content: `${data.kit.season} 분석 완료! 쇼핑 도움 드릴게요 💕` },
      ]);
    } catch { setError("분석 오류가 발생했어요. 다시 시도해주세요."); setPhase("capture"); }
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

  const sendChat = async () => {
    const txt = chatInput.trim(); if (!txt || chatLoading) return;
    setChatInput("");
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

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);
  useEffect(() => () => stopCam(), []);

  const acc = kit ? (SEASONS[kit.season]?.accent || "#C2185B") : "#C2185B";

  // ── CAPTURE PHASE ──
  if (phase === "capture" || phase === "analyzing") return (
    <div style={{ minHeight: "100vh", background: "#FAFAF7", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: "'Noto Sans KR',sans-serif", padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 440 }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🎨</div>
          <h1 style={{ fontSize: 26, fontWeight: 900, letterSpacing: "-1px", marginBottom: 8 }}>나만의 컬러 키트</h1>
          <p style={{ fontSize: 14, color: "#888", lineHeight: 1.7 }}>사진 한 장으로 퍼스널 컬러를 분석하고<br />맞춤 팔레트·메이크업·패션·레이어링 키트를 만들어요</p>
        </div>

        <div style={{ background: "#fff", borderRadius: 24, border: "1px solid #EEE", overflow: "hidden", marginBottom: 16 }}>
          <div style={{ position: "relative", aspectRatio: "4/3", background: "#F8F6F3", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <video ref={videoRef} style={{ width: "100%", height: "100%", objectFit: "cover", transform: "scaleX(-1)", display: cameraOn ? "block" : "none" }} autoPlay muted playsInline />
            <canvas ref={canvasRef} style={{ display: "none" }} />
            {!cameraOn && !photoB64 && <div style={{ textAlign: "center", color: "#CCC" }}><div style={{ fontSize: 40 }}>📷</div><div style={{ fontSize: 13, marginTop: 8 }}>카메라 또는 사진 업로드</div></div>}
            {photoB64 && !cameraOn && <img src={`data:image/jpeg;base64,${photoB64}`} style={{ width: "100%", height: "100%", objectFit: "cover", transform: "scaleX(-1)" }} alt="" />}
          </div>
          <div style={{ padding: 16, display: "flex", gap: 8 }}>
            {!cameraOn && !photoB64 && <>
              <button onClick={startCam} style={{ flex: 2, padding: "11px", borderRadius: 12, border: "none", background: "#C2185B", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>📷 카메라 켜기</button>
              <button onClick={() => fileRef.current?.click()} style={{ flex: 1, padding: "11px", borderRadius: 12, border: "1px solid #DDD", background: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>📁 업로드</button>
            </>}
            {cameraOn && <button onClick={captureSnap} style={{ flex: 1, padding: "11px", borderRadius: 12, border: "none", background: "#C2185B", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>📸 촬영하기</button>}
            {photoB64 && !cameraOn && <button onClick={() => { setPhotoB64(null); startCam(); }} style={{ flex: 1, padding: "11px", borderRadius: 12, border: "1px solid #DDD", background: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>🔄 다시 찍기</button>}
          </div>
        </div>

        <input ref={fileRef} type="file" accept="image/*" onChange={handleUpload} style={{ display: "none" }} />
        {error && <div style={{ background: "#FFF0F0", border: "1px solid #FFCCCC", borderRadius: 12, padding: "10px 16px", color: "#C00", fontSize: 13, textAlign: "center", marginBottom: 12 }}>{error}</div>}

        <button onClick={analyzeColor} disabled={!photoB64 || phase === "analyzing"} style={{ width: "100%", padding: "18px", borderRadius: 18, border: "none", background: photoB64 ? "linear-gradient(135deg,#C2185B,#880E4F)" : "#E0DDD8", color: photoB64 ? "#fff" : "#AAA", fontSize: 16, fontWeight: 900, cursor: photoB64 ? "pointer" : "not-allowed" }}>
          {phase === "analyzing" ? "🎨 분석 중..." : "✨ 내 컬러 키트 만들기"}
        </button>
      </div>
    </div>
  );

  // ── KIT PHASE ──
  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", fontFamily: "'Noto Sans KR',sans-serif" }}>
      <header style={{ background: "#fff", borderBottom: "1px solid #EEE", padding: "0 20px", height: 52, display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span>🎨</span>
          <strong style={{ fontSize: 16, letterSpacing: "-1px" }}>COLOR KIT</strong>
          {kit && <span style={{ fontSize: 10, background: acc, color: "#fff", padding: "2px 8px", borderRadius: 20 }}>{kit.season}</span>}
        </div>
        <button onClick={() => { setPhase("capture"); setKit(null); setPhotoB64(null); }} style={{ fontSize: 11, color: "#999", background: "none", border: "1px solid #DDD", borderRadius: 20, padding: "4px 12px", cursor: "pointer" }}>🔄 재분석</button>
      </header>

      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        {/* Kit Panel */}
        <div style={{ width: "52%", borderRight: "1px solid #EEE", background: "#fff", display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <div style={{ background: SEASONS[kit?.season]?.bg || "#FFF0F4", padding: "14px 20px", borderBottom: "1px solid #EEE" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {photoB64 && <img src={`data:image/jpeg;base64,${photoB64}`} style={{ width: 42, height: 42, borderRadius: "50%", objectFit: "cover", transform: "scaleX(-1)", border: `2px solid ${acc}` }} alt="" />}
              <div>
                <div style={{ fontSize: 15, fontWeight: 900, color: acc }}>{SEASONS[kit?.season]?.label}</div>
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

          <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>
            {activeTab === "palette" && (
              <div>
                <p style={{ fontSize: 12, fontWeight: 800, color: "#1A1A1A", marginBottom: 12 }}>✨ BEST COLORS</p>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 20 }}>
                  {kit?.palette?.best?.map((c: string) => (
                    <div key={c} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                      <div style={{ width: 40, height: 40, borderRadius: "50%", background: c, boxShadow: `0 0 0 3px #fff, 0 0 0 5px ${c}` }} />
                      <span style={{ fontSize: 9, color: "#888" }}>{c}</span>
                    </div>
                  ))}
                </div>
                <p style={{ fontSize: 12, fontWeight: 800, color: "#1A1A1A", marginBottom: 12 }}>🚫 AVOID COLORS</p>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  {kit?.palette?.avoid?.map((c: string) => (
                    <div key={c} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                      <div style={{ width: 40, height: 40, borderRadius: "50%", background: c, opacity: 0.5 }} />
                      <span style={{ fontSize: 9, color: "#888" }}>{c}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {activeTab === "makeup" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div><p style={{ fontSize: 12, fontWeight: 800, marginBottom: 8 }}>🫧 FOUNDATION</p><div style={{ background: "#FAF8F5", borderRadius: 12, padding: "10px 14px", fontSize: 13, color: "#444", lineHeight: 1.7 }}>{kit?.makeup?.foundation}</div></div>
                {[{ key: "blush", label: "🌸 BLUSH" }, { key: "eye", label: "👁 EYE" }, { key: "lip", label: "💋 LIP" }].map(({ key, label }) => (
                  <div key={key}>
                    <p style={{ fontSize: 12, fontWeight: 800, marginBottom: 8 }}>{label}</p>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div style={{ display: "flex", gap: 6 }}>
                        {kit?.makeup?.[key]?.colors?.map((c: string) => <div key={c} style={{ width: 32, height: 32, borderRadius: "50%", background: c, boxShadow: `0 0 0 2px #fff, 0 0 0 4px ${c}` }} />)}
                      </div>
                      <p style={{ fontSize: 12, color: "#555", lineHeight: 1.7 }}>{kit?.makeup?.[key]?.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {activeTab === "fashion" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {[{ key: "tops", label: "👕 상의" }, { key: "bottoms", label: "👖 하의" }, { key: "outwear", label: "🧥 아우터" }, { key: "avoid", label: "⚠️ 피해야 할 스타일" }].map(({ key, label }) => (
                  <div key={key}>
                    <p style={{ fontSize: 12, fontWeight: 800, marginBottom: 8 }}>{label}</p>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {kit?.fashion?.[key]?.map((item: string) => <span key={item} style={{ background: key === "avoid" ? "#F5F5F5" : `${acc}12`, color: key === "avoid" ? "#999" : acc, fontSize: 11, fontWeight: 600, padding: "4px 12px", borderRadius: 20 }}>{item}</span>)}
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
                      <div><p style={{ fontSize: 14, fontWeight: 800 }}>{look.name}</p><p style={{ fontSize: 11, color: "#999" }}>{look.mood}</p></div>
                      <div style={{ display: "flex" }}>{look.colors?.map((c: string, ci: number) => <div key={ci} style={{ width: 22, height: 22, borderRadius: "50%", background: c, border: "2px solid #fff", marginLeft: ci > 0 ? -6 : 0 }} />)}</div>
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 10 }}>
                      {look.items?.map((item: string) => <span key={item} style={{ background: `${acc}12`, color: acc, fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 20 }}>{item}</span>)}
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

        {/* Shopping Panel */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", background: "#FAFAF7" }}>
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
                {m.role === "ai" && <div style={{ width: 26, height: 26, borderRadius: "50%", background: `linear-gradient(135deg,${acc},${acc}88)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, flexShrink: 0 }}>🎨</div>}
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
              <button key={s} onClick={() => setChatInput(s)} style={{ background: "#F0EDE8", border: "none", borderRadius: 20, padding: "5px 11px", color: "#777", fontSize: 10, cursor: "pointer", fontWeight: 600 }}>{s}</button>
            ))}
          </div>

          <div style={{ padding: "10px 16px", borderTop: "1px solid #E8E4DE", display: "flex", gap: 8, background: "#fff" }}>
            <input value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => e.key === "Enter" && sendChat()} placeholder="궁금한 점을 물어보세요..." style={{ flex: 1, background: "#FAF8F5", border: "1px solid #E8E4DE", borderRadius: 22, padding: "9px 16px", color: "#333", fontSize: 13, outline: "none" }} />
            <button onClick={sendChat} disabled={!chatInput.trim() || chatLoading} style={{ width: 38, height: 38, borderRadius: "50%", background: chatInput.trim() ? `linear-gradient(135deg,${acc},${acc}AA)` : "#EEE", border: "none", color: "#fff", cursor: chatInput.trim() ? "pointer" : "default", fontSize: 15 }}>↑</button>
          </div>
        </div>
      </div>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;600;700;800;900&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        @keyframes bounce { 0%,60%,100%{transform:translateY(0)} 30%{transform:translateY(-5px)} }
      `}</style>
    </div>
  );
}