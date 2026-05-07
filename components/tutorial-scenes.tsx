"use client";

import { useEffect, useState } from "react";

const FILL = { fontVariationSettings: "'FILL' 1" } as const;

// ── Scene 1: Welcome — animated rosette/badge ──
export function SceneWelcome({ accent }: { accent: string }) {
  return (
    <div className="relative w-full h-44 flex items-center justify-center">
      <div className="absolute w-32 h-32 rounded-full" style={{ background: `${accent}15`, animation: "ping 2s cubic-bezier(0,0,0.2,1) infinite" }} />
      <div className="absolute w-24 h-24 rounded-full" style={{ background: `${accent}25` }} />
      <div
        className="relative w-20 h-20 rounded-full flex items-center justify-center shadow-lg"
        style={{ background: `linear-gradient(135deg,${accent},${accent}cc)`, boxShadow: `0 12px 32px ${accent}55` }}
      >
        <span className="material-symbols-outlined text-white text-4xl" style={FILL}>workspace_premium</span>
      </div>
      <div className="absolute -top-1 left-1/2 -translate-x-1/2 flex gap-1">
        {[0,1,2,3,4].map(i => (
          <div key={i} className="w-1.5 h-1.5 rounded-full" style={{ background: accent, animation: `confetti 1.4s ease ${i*0.1}s infinite` }} />
        ))}
      </div>
    </div>
  );
}

// ── Scene 2: Databases — mock card grid ──
export function SceneDatabases({ accent }: { accent: string }) {
  const cards = [
    { name: "Pharmacology Course", count: 24, delay: 0 },
    { name: "Webinar - April", count: 18, delay: 120 },
  ];
  return (
    <div className="grid grid-cols-3 gap-2 w-full">
      {cards.map((c, i) => (
        <div key={i} className="rounded-lg p-2.5 bg-white border border-gray-200 shadow-sm" style={{ animation: `slideUpFade 0.4s ease ${c.delay}ms both` }}>
          <div className="flex items-center gap-1.5 mb-1.5">
            <div className="w-5 h-5 rounded-md flex items-center justify-center" style={{ background: `${accent}20` }}>
              <span className="material-symbols-outlined text-xs" style={{ color: accent, fontSize: 12, ...FILL }}>database</span>
            </div>
            <span className="text-[10px] font-bold text-gray-700 truncate">{c.name}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[9px] text-gray-400">{c.count} participants</span>
            <span className="w-1 h-1 rounded-full" style={{ background: accent }} />
          </div>
        </div>
      ))}
      <div
        className="rounded-lg p-2.5 border-2 border-dashed flex flex-col items-center justify-center"
        style={{ borderColor: accent, animation: "pulseScale 1.6s ease infinite" }}
      >
        <span className="material-symbols-outlined" style={{ color: accent, fontSize: 18, ...FILL }}>add_circle</span>
        <span className="text-[9px] font-bold mt-0.5" style={{ color: accent }}>New Database</span>
      </div>
    </div>
  );
}

// ── Scene 3: Templates — mock canvas with draggable Name marker ──
export function SceneTemplates({ accent }: { accent: string }) {
  const [pos, setPos] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setPos(p => (p + 1) % 3), 1100);
    return () => clearInterval(id);
  }, []);
  const positions = [{ left: "30%", top: "42%" }, { left: "50%", top: "48%" }, { left: "40%", top: "45%" }];
  return (
    <div className="relative w-full h-44 rounded-lg bg-white border border-gray-200 overflow-hidden shadow-sm">
      {/* Mock certificate background */}
      <div className="absolute inset-2 border border-dashed border-gray-200 rounded" />
      <div className="absolute top-3 left-1/2 -translate-x-1/2 text-[8px] tracking-widest text-gray-400 font-bold">CERTIFICATE</div>
      <div className="absolute top-7 left-1/2 -translate-x-1/2 w-12 h-px bg-gray-300" />
      <div className="absolute bottom-4 right-4 w-8 h-8 rounded bg-gray-100 grid grid-cols-3 grid-rows-3 gap-px p-0.5">
        {[...Array(9)].map((_, i) => <div key={i} className="bg-gray-700" />)}
      </div>
      {/* Animated name marker */}
      <div
        className="absolute -translate-x-1/2 -translate-y-1/2 px-2 py-1 rounded text-[9px] font-bold flex items-center gap-1 shadow-md"
        style={{
          left: positions[pos].left,
          top: positions[pos].top,
          background: accent,
          color: "white",
          transition: "left 0.7s cubic-bezier(0.34,1.56,0.64,1), top 0.7s cubic-bezier(0.34,1.56,0.64,1)",
        }}
      >
        <span className="material-symbols-outlined" style={{ fontSize: 12, ...FILL }}>open_with</span>
        Name
      </div>
    </div>
  );
}

// ── Scene 4: Generate IDs — animated list ──
export function SceneGenerateIds({ accent }: { accent: string }) {
  const rows = [
    { name: "Ali Khan", id: "PZ-CRS-0001" },
    { name: "Sara Ahmed", id: "PZ-CRS-0002" },
    { name: "Bilal Iqbal", id: "PZ-CRS-0003" },
  ];
  return (
    <div className="space-y-1.5 w-full">
      {rows.map((r, i) => (
        <div
          key={i}
          className="flex items-center justify-between p-2 rounded-lg bg-white border border-gray-200 shadow-sm"
          style={{ animation: `slideUpFade 0.4s ease ${i * 220}ms both` }}
        >
          <span className="text-[11px] font-medium text-gray-700">{r.name}</span>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded" style={{ background: `${accent}15`, color: accent }}>{r.id}</span>
            <span className="material-symbols-outlined text-base" style={{ color: accent, ...FILL, animation: `popIn 0.3s ease ${i * 220 + 200}ms both` }}>check_circle</span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Scene 5: Generate PDFs — progress bar + PDF icons ──
export function SceneGeneratePdfs({ accent }: { accent: string }) {
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setProgress(p => (p >= 100 ? 0 : p + 4)), 80);
    return () => clearInterval(id);
  }, []);
  const pdfsVisible = Math.floor(progress / 33);
  return (
    <div className="w-full space-y-3">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[11px] font-bold text-gray-700">Generating PDFs...</span>
        <span className="text-[11px] font-bold" style={{ color: accent }}>{progress}%</span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-100" style={{ width: `${progress}%`, background: `linear-gradient(90deg,${accent},${accent}cc)` }} />
      </div>
      <div className="flex justify-center gap-3 mt-3">
        {[0,1,2].map(i => (
          <div
            key={i}
            className="w-12 h-14 rounded bg-white border border-gray-200 flex flex-col items-center justify-center shadow-sm"
            style={{
              opacity: i < pdfsVisible ? 1 : 0.25,
              transform: i < pdfsVisible ? "scale(1)" : "scale(0.85)",
              transition: "all 0.4s ease",
            }}
          >
            <span className="material-symbols-outlined" style={{ color: accent, fontSize: 24, ...FILL }}>picture_as_pdf</span>
            <span className="text-[7px] font-mono mt-0.5 text-gray-500">CERT-{i + 1}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Scene 6: Send Emails — composer with paper plane ──
export function SceneSendEmails({ accent }: { accent: string }) {
  const [sent, setSent] = useState(false);
  useEffect(() => {
    const id = setInterval(() => setSent(s => !s), 2000);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="relative w-full">
      <div className="rounded-lg bg-white border border-gray-200 p-2.5 shadow-sm">
        <div className="flex items-center gap-1.5 pb-1.5 border-b border-gray-100 mb-1.5">
          <span className="text-[9px] font-bold text-gray-500">To:</span>
          <div className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px]" style={{ background: `${accent}15`, color: accent }}>
            <span className="material-symbols-outlined" style={{ fontSize: 10, ...FILL }}>person</span>
            [Name]
          </div>
        </div>
        <div className="text-[10px] text-gray-700 leading-relaxed">
          Dear <span className="font-bold" style={{ color: accent }}>[Name]</span>, your certificate is ready. View it here: <span className="font-mono" style={{ color: accent }}>[VerificationLink]</span>
        </div>
      </div>
      <div
        className="absolute right-0 -top-2 w-9 h-9 rounded-full flex items-center justify-center shadow-lg"
        style={{
          background: `linear-gradient(135deg,${accent},${accent}cc)`,
          transform: sent ? "translate(20px,-20px) rotate(15deg)" : "translate(0,0) rotate(0deg)",
          opacity: sent ? 0 : 1,
          transition: "all 0.9s cubic-bezier(0.5,0,0.75,0)",
        }}
      >
        <span className="material-symbols-outlined text-white" style={{ fontSize: 18, ...FILL }}>send</span>
      </div>
    </div>
  );
}

// ── Scene 7: Verify — QR → arrow → result ──
export function SceneVerify({ accent }: { accent: string }) {
  return (
    <div className="flex items-center justify-center gap-3 w-full py-2">
      {/* QR */}
      <div className="w-16 h-16 rounded bg-white border border-gray-200 grid grid-cols-5 grid-rows-5 gap-px p-1 shadow-sm">
        {[...Array(25)].map((_, i) => {
          const filled = [0,1,2,3,4,5,9,10,14,15,19,20,21,22,23,24, 7,12,17, 11,13].includes(i);
          return <div key={i} className={filled ? "bg-gray-900" : "bg-white"} />;
        })}
      </div>
      <span className="material-symbols-outlined text-2xl" style={{ color: accent, animation: "arrowNudge 0.9s ease-in-out infinite", ...FILL }}>arrow_forward</span>
      {/* Result card */}
      <div
        className="rounded-lg px-3 py-2.5 flex flex-col items-center gap-0.5 shadow-md"
        style={{ background: `linear-gradient(135deg,${accent}10,${accent}25)`, border: `1px solid ${accent}` }}
      >
        <span className="material-symbols-outlined" style={{ color: accent, fontSize: 20, ...FILL }}>verified</span>
        <span className="text-[10px] font-bold" style={{ color: accent }}>Authentic</span>
        <span className="text-[8px] text-gray-500 font-mono">PZ-CRS-0001</span>
      </div>
    </div>
  );
}

// ── Scene 8: History — vertical timeline ──
export function SceneHistory({ accent }: { accent: string }) {
  const events = [
    { type: "Generated 24 PDFs", time: "2m ago", icon: "auto_awesome" },
    { type: "Sent 24 emails", time: "1m ago", icon: "send" },
    { type: "5 verifications", time: "just now", icon: "verified" },
  ];
  return (
    <div className="relative pl-6 space-y-2.5 w-full">
      <div className="absolute left-2 top-1.5 bottom-1.5 w-px" style={{ background: `${accent}30` }} />
      {events.map((e, i) => (
        <div
          key={i}
          className="relative flex items-center gap-2.5"
          style={{ animation: `slideUpFade 0.4s ease ${i * 200}ms both` }}
        >
          <div
            className="absolute -left-6 w-4 h-4 rounded-full flex items-center justify-center"
            style={{ background: `${accent}25`, border: `2px solid ${accent}` }}
          >
            <div className="w-1 h-1 rounded-full" style={{ background: accent }} />
          </div>
          <div className="flex-1 flex items-center justify-between p-1.5 rounded-lg bg-white border border-gray-200 shadow-sm">
            <div className="flex items-center gap-1.5">
              <span className="material-symbols-outlined" style={{ color: accent, fontSize: 14, ...FILL }}>{e.icon}</span>
              <span className="text-[10px] font-medium text-gray-700">{e.type}</span>
            </div>
            <span className="text-[9px] text-gray-400">{e.time}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Scene 9: Done — checkmark with confetti ──
export function SceneDone({ accent }: { accent: string }) {
  return (
    <div className="relative w-full h-40 flex items-center justify-center">
      {[...Array(12)].map((_, i) => (
        <div
          key={i}
          className="absolute w-1.5 h-1.5 rounded-full"
          style={{
            background: i % 3 === 0 ? accent : i % 3 === 1 ? "#facc15" : "#f472b6",
            top: `${10 + (i * 7) % 80}%`,
            left: `${5 + (i * 13) % 90}%`,
            animation: `confetti ${1 + (i % 3) * 0.2}s ease ${i * 0.05}s infinite`,
          }}
        />
      ))}
      <div className="relative">
        <div
          className="w-20 h-20 rounded-full flex items-center justify-center shadow-xl"
          style={{ background: `linear-gradient(135deg,${accent},${accent}aa)`, animation: "popIn 0.6s cubic-bezier(0.34,1.56,0.64,1)" }}
        >
          <span className="material-symbols-outlined text-white text-5xl" style={FILL}>check</span>
        </div>
      </div>
    </div>
  );
}
