"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Certificate } from "@/lib/types";
import { sfx } from "@/lib/sfx";

type ClaimStage = "loading" | "ready" | "opening" | "revealed" | "error";

interface Particle {
  id: number;
  x: number;
  color: string;
  delay: number;
  size: number;
  shape: "circle" | "rect" | "star";
  duration: number;
}

export default function ClaimPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-[#060f08]">
        <div className="relative w-16 h-16">
          <div className="absolute inset-0 rounded-full border-2 border-[#52b788]/20" />
          <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-[#52b788] animate-spin" />
          <div className="absolute inset-3 rounded-full bg-[#1b4332]/50 flex items-center justify-center">
            <span className="material-symbols-outlined text-xl text-[#52b788]" style={{ fontVariationSettings: "'FILL' 1" }}>workspace_premium</span>
          </div>
        </div>
      </div>
    }>
      <ClaimContent />
    </Suspense>
  );
}

function ClaimContent() {
  const searchParams = useSearchParams();
  const certId = searchParams.get("id") || searchParams.get("certId") || "";

  const [stage, setStage] = useState<ClaimStage>("loading");
  const [certificate, setCertificate] = useState<Certificate | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [particles, setParticles] = useState<Particle[]>([]);
  const hasOpened = useRef(false);

  useEffect(() => {
    if (!certId) {
      setError("No certificate ID provided.");
      setStage("error");
      return;
    }

    fetch(`/api/verify?certId=${encodeURIComponent(certId)}`)
      .then(r => r.json())
      .then(data => {
        if (data.certificate) {
          setCertificate(data.certificate);
          setStage("ready");
          sfx.notify();
        } else {
          setError(data.error || "Certificate not found.");
          setStage("error");
          sfx.error();
        }
      })
      .catch(() => {
        setError("Failed to load certificate. Please try again.");
        setStage("error");
        sfx.error();
      });
  }, [certId]);

  const handleOpen = () => {
    if (hasOpened.current) return;
    hasOpened.current = true;
    setStage("opening");

    sfx.unwrap();
    setTimeout(() => sfx.sparkle(), 280);
    setTimeout(() => sfx.fanfare(), 850);

    const newParticles: Particle[] = Array.from({ length: 80 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      color: ["#52b788", "#1b4332", "#95d5b2", "#ffd700", "#ff6b6b", "#4ecdc4", "#a78bfa", "#fb923c"][Math.floor(Math.random() * 8)],
      delay: Math.random() * 1.0,
      size: Math.random() * 10 + 5,
      shape: (["circle", "rect", "star"] as const)[Math.floor(Math.random() * 3)],
      duration: 2 + Math.random() * 1.5,
    }));
    setParticles(newParticles);

    setTimeout(() => setStage("revealed"), 1800);
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "";
    try {
      return new Date(dateStr).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-surface overflow-hidden">
      <Navbar />

      <main className="flex-1 pt-20 sm:pt-28 pb-16 flex items-center justify-center px-4 relative">
        {/* Confetti particles */}
        {(stage === "opening" || stage === "revealed") && (
          <div className="fixed inset-0 pointer-events-none z-30 overflow-hidden">
            {particles.map(p => (
              <div
                key={p.id}
                style={{
                  position: "absolute",
                  left: `${p.x}%`,
                  top: "-20px",
                  width: p.size,
                  height: p.size,
                  backgroundColor: p.color,
                  borderRadius: p.shape === "circle" ? "50%" : p.shape === "rect" ? "2px" : "0",
                  animation: `confettiFall ${p.duration}s ease-in ${p.delay}s forwards`,
                  transform: `rotate(${Math.random() * 360}deg)`,
                  clipPath: p.shape === "star" ? "polygon(50% 0%,61% 35%,98% 35%,68% 57%,79% 91%,50% 70%,21% 91%,32% 57%,2% 35%,39% 35%)" : undefined,
                }}
              />
            ))}
          </div>
        )}

        <div className="w-full max-w-lg mx-auto">
          {/* ── LOADING ── */}
          {stage === "loading" && (
            <div className="text-center space-y-8">
              <div className="relative w-28 h-28 mx-auto">
                <div className="absolute inset-0 rounded-full border-4 border-green-100" />
                <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-brand-vivid-green animate-spin" />
                <div className="absolute inset-2 rounded-full border-4 border-transparent border-b-[#95d5b2]/40 animate-spin" style={{ animationDirection: "reverse", animationDuration: "1.8s" }} />
                <div className="absolute inset-5 rounded-full bg-gradient-to-br from-green-50 to-[#d8f3dc] flex items-center justify-center">
                  <span className="material-symbols-outlined text-3xl text-brand-vivid-green" style={{ fontVariationSettings: "'FILL' 1" }}>workspace_premium</span>
                </div>
              </div>
              <div className="space-y-3">
                <p className="text-brand-dark-green font-bold text-base">Retrieving your certificate...</p>
                <p className="text-sm text-on-surface-variant">Checking our secure database</p>
                <div className="flex justify-center gap-2">
                  {[0, 1, 2, 3].map(i => (
                    <div key={i} className="w-1.5 h-1.5 rounded-full bg-brand-vivid-green"
                      style={{ animation: `dotPulse 1.4s ease-in-out ${i * 0.2}s infinite` }} />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── ERROR ── */}
          {stage === "error" && (
            <div className="bg-white rounded-3xl shadow-xl p-8 sm:p-10 text-center border border-red-100">
              <div className="w-20 h-20 mx-auto mb-5 rounded-full bg-red-50 border border-red-100 flex items-center justify-center">
                <span className="material-symbols-outlined text-5xl text-red-400">error_outline</span>
              </div>
              <h2 className="text-xl font-bold text-brand-dark-green mb-2">Certificate Not Found</h2>
              <p className="text-sm text-on-surface-variant mb-7 leading-relaxed">{error}</p>
              <Link
                href="/verify"
                onClick={() => sfx.click()}
                className="inline-flex items-center gap-2 px-7 py-3 rounded-xl font-bold text-sm text-white transition-opacity hover:opacity-90"
                style={{ background: "linear-gradient(135deg, #52b788, #1b4332)" }}
              >
                <span className="material-symbols-outlined text-sm">search</span>
                Try Verifying Manually
              </Link>
            </div>
          )}

          {/* ── READY: Premium Gift Box ── */}
          {stage === "ready" && (
            <div className="text-center">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full mb-4"
                style={{ background: "rgba(82,183,136,0.1)", border: "1px solid rgba(82,183,136,0.2)" }}>
                <div className="w-1.5 h-1.5 rounded-full bg-[#52b788] animate-pulse" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-[#52b788]">Certificate Ready</span>
              </div>

              <h1 className="text-3xl sm:text-4xl font-bold text-brand-dark-green mb-2 leading-tight">
                {certificate?.recipientName}
              </h1>
              <p className="text-on-surface-variant mb-12 text-sm">Your certificate is waiting inside. Tap to reveal.</p>

              {/* 3D gift box button */}
              <button
                onClick={handleOpen}
                className="mx-auto block group cursor-pointer"
                style={{ WebkitTapHighlightColor: "transparent" }}
                aria-label="Open certificate"
              >
                {/* Outer glow ring */}
                <div className="relative mx-auto" style={{ width: 200, height: 220 }}>
                  {/* Ambient glow */}
                  <div className="absolute inset-0 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                    style={{ background: "radial-gradient(ellipse, rgba(82,183,136,0.3) 0%, transparent 70%)", filter: "blur(20px)", transform: "scale(1.3)" }} />

                  {/* Bounce animation wrapper */}
                  <div className="absolute inset-0" style={{ animation: "giftFloat 2.5s ease-in-out infinite" }}>
                    {/* Box shadow */}
                    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-36 h-4 rounded-full opacity-20 group-hover:opacity-40 transition-opacity"
                      style={{ background: "radial-gradient(ellipse, #1b4332 0%, transparent 70%)", filter: "blur(6px)" }} />

                    {/* Box body */}
                    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-40 h-[130px] rounded-2xl overflow-hidden group-hover:scale-105 transition-transform duration-300"
                      style={{ background: "linear-gradient(160deg, #1b4332 0%, #0d2a1a 60%)", boxShadow: "0 8px 32px rgba(0,0,0,0.25), inset 0 1px 0 rgba(82,183,136,0.15)" }}>

                      {/* Ribbon vertical */}
                      <div className="absolute inset-x-0 top-0 bottom-0 flex justify-center">
                        <div className="w-9 h-full" style={{ background: "linear-gradient(to bottom, rgba(82,183,136,0.5), rgba(45,106,79,0.3))" }} />
                      </div>

                      {/* Shine effect */}
                      <div className="absolute inset-0 opacity-10 group-hover:opacity-20 transition-opacity"
                        style={{ background: "linear-gradient(135deg, white 0%, transparent 50%)" }} />

                      {/* Center icon */}
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="material-symbols-outlined text-white/80 text-5xl z-10" style={{ fontVariationSettings: "'FILL' 1" }}>
                          workspace_premium
                        </span>
                      </div>
                    </div>

                    {/* Box lid */}
                    <div
                      className="absolute left-1/2 -translate-x-1/2 w-44 h-16 rounded-2xl origin-bottom group-hover:-translate-y-6 group-hover:rotate-[-8deg] transition-all duration-500 overflow-hidden"
                      style={{
                        top: 60,
                        background: "linear-gradient(135deg, #52b788 0%, #2d6a4f 100%)",
                        boxShadow: "0 4px 16px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.15)"
                      }}
                    >
                      {/* Lid ribbon horizontal */}
                      <div className="absolute inset-y-0 left-0 right-0 flex items-center justify-center">
                        <div className="h-5 w-full" style={{ background: "rgba(149,213,178,0.3)" }} />
                      </div>
                      {/* Lid shine */}
                      <div className="absolute inset-0 opacity-10" style={{ background: "linear-gradient(135deg, white 0%, transparent 60%)" }} />
                    </div>

                    {/* Bow */}
                    <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-1 group-hover:-translate-y-6 group-hover:rotate-[-8deg] transition-all duration-500" style={{ top: 20 }}>
                      <div className="w-9 h-9 rounded-full scale-x-150 origin-right opacity-95"
                        style={{ background: "radial-gradient(circle at 30% 30%, #fde68a, #f59e0b)" }} />
                      <div className="w-9 h-9 rounded-full scale-x-150 origin-left opacity-95"
                        style={{ background: "radial-gradient(circle at 70% 30%, #fde68a, #f59e0b)" }} />
                    </div>
                  </div>
                </div>

                <div className="mt-5 flex items-center justify-center gap-2 font-bold text-sm uppercase tracking-widest text-brand-vivid-green group-hover:scale-105 transition-transform">
                  <span className="material-symbols-outlined text-sm">touch_app</span>
                  Tap to Open
                </div>
              </button>
            </div>
          )}

          {/* ── OPENING ── */}
          {stage === "opening" && (
            <div className="text-center">
              <div className="relative w-52 h-52 mx-auto flex items-center justify-center">
                {[0, 1, 2, 3].map(i => (
                  <div key={i} className="absolute inset-0 rounded-full border-2 border-brand-vivid-green"
                    style={{ animation: `burstRing 1s ease-out ${i * 0.12}s forwards`, opacity: 0 }} />
                ))}
                {/* Glow core */}
                <div className="absolute inset-0 rounded-full"
                  style={{ background: "radial-gradient(circle, rgba(82,183,136,0.15) 0%, transparent 70%)", animation: "coreGlow 1.2s ease-out forwards" }} />
                <div
                  className="w-32 h-32 rounded-full flex items-center justify-center shadow-2xl"
                  style={{
                    background: "linear-gradient(135deg, #52b788 0%, #2d6a4f 50%, #1b4332 100%)",
                    animation: "giftPop 0.85s cubic-bezier(0.34, 1.56, 0.64, 1) forwards",
                    boxShadow: "0 0 60px rgba(82,183,136,0.4)",
                  }}
                >
                  <span
                    className="material-symbols-outlined text-6xl text-white"
                    style={{ fontVariationSettings: "'FILL' 1", animation: "starSpin 1.2s ease-out forwards" }}
                  >
                    workspace_premium
                  </span>
                </div>
              </div>
              <p className="mt-6 text-brand-dark-green font-bold text-xl" style={{ animation: "fadeUp 0.5s 0.4s ease-out both" }}>
                Congratulations!
              </p>
              <p className="text-on-surface-variant text-sm mt-1" style={{ animation: "fadeUp 0.5s 0.6s ease-out both" }}>
                Preparing your certificate...
              </p>
            </div>
          )}

          {/* ── REVEALED ── */}
          {stage === "revealed" && certificate && (() => {
            const rawUrl = certificate.driveLink || certificate.pdfUrl || "";
            const fileIdMatch = rawUrl.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
            const embedUrl = fileIdMatch
              ? `https://drive.google.com/file/d/${fileIdMatch[1]}/preview`
              : rawUrl;

            return (
              <div style={{ animation: "fadeSlideUp 0.7s ease-out forwards" }}>
                {/* Header */}
                <div className="text-center mb-6">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full mb-3"
                    style={{ background: "rgba(82,183,136,0.1)", border: "1px solid rgba(82,183,136,0.25)" }}>
                    <span className="material-symbols-outlined text-[#52b788] text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-[#52b788]">Certificate Verified</span>
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-bold text-brand-dark-green leading-tight">
                    Congratulations, {certificate.recipientName?.split(" ")[0]}!
                  </h1>
                  <p className="text-on-surface-variant text-sm mt-1.5">Your certificate is verified and ready to download.</p>
                </div>

                {/* PDF Certificate */}
                <div
                  className="rounded-2xl overflow-hidden mb-4"
                  style={{
                    border: "1px solid rgba(82,183,136,0.3)",
                    boxShadow: "0 8px 40px rgba(27,67,50,0.15)",
                    animation: "cardReveal 0.7s 0.15s ease-out both"
                  }}
                >
                  {/* Toolbar */}
                  <div className="flex items-center justify-between px-4 py-3"
                    style={{ background: "linear-gradient(90deg, #1b4332, #2d6a4f)" }}>
                    <div className="flex items-center gap-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src="/pharmacozyme-logo.png" alt="" className="h-6 opacity-90" />
                      <div>
                        <p className="text-[#95d5b2] text-[9px] font-bold uppercase tracking-widest">Certificate of Achievement</p>
                        <p className="text-white/40 text-[8px]">PharmacoZyme · {certificate.subCategory || certificate.category}</p>
                      </div>
                    </div>
                    {rawUrl && (
                      <a href={rawUrl} target="_blank" rel="noopener noreferrer"
                        onClick={() => sfx.click()}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white text-xs font-bold transition-all hover:bg-white/20 cursor-pointer"
                        style={{ background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.15)" }}
                      >
                        <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>download</span>
                        Download
                      </a>
                    )}
                  </div>

                  {rawUrl ? (
                    <div style={{ aspectRatio: "1.414 / 1", width: "100%" }}>
                      <iframe
                        src={embedUrl}
                        className="w-full h-full"
                        style={{ border: "none", display: "block" }}
                        title="Certificate PDF"
                        allow="autoplay"
                      />
                    </div>
                  ) : (
                    <div className="p-10 text-center bg-white">
                      <span className="material-symbols-outlined text-5xl text-brand-vivid-green mb-3 block" style={{ fontVariationSettings: "'FILL' 1" }}>workspace_premium</span>
                      <p className="text-xs text-on-surface-variant mb-1">Certificate for</p>
                      <p className="text-2xl font-bold text-brand-dark-green">{certificate.recipientName}</p>
                      <p className="text-xs text-on-surface-variant mt-2">PDF will be available after generation is complete.</p>
                    </div>
                  )}
                </div>

                {/* Meta card */}
                <div
                  className="bg-white rounded-2xl border border-green-100 shadow-sm p-5 mb-4"
                  style={{ animation: "cardReveal 0.7s 0.3s ease-out both" }}
                >
                  <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
                    <div>
                      <p className="text-[10px] uppercase tracking-widest text-outline mb-0.5">Certificate ID</p>
                      <p className="font-mono font-bold text-brand-grass-green text-sm">{certificate.uniqueCertId}</p>
                    </div>
                    {certificate.issueDate && (
                      <div>
                        <p className="text-[10px] uppercase tracking-widest text-outline mb-0.5">Issue Date</p>
                        <p className="font-semibold text-brand-dark-green text-sm">{formatDate(String(certificate.issueDate))}</p>
                      </div>
                    )}
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-green-50 border border-green-200">
                      <span className="material-symbols-outlined text-brand-vivid-green text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>
                      <span className="text-xs font-bold text-brand-vivid-green uppercase tracking-wider">Verified</span>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2.5">
                    {rawUrl && (
                      <a href={rawUrl} target="_blank" rel="noopener noreferrer"
                        onClick={() => sfx.send()}
                        className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm text-white transition-opacity hover:opacity-90 cursor-pointer"
                        style={{ background: "linear-gradient(135deg, #52b788 0%, #1b4332 100%)" }}
                      >
                        <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>download</span>
                        Download PDF
                      </a>
                    )}
                    <Link href={`/verify?certId=${certificate.uniqueCertId}`}
                      onClick={() => sfx.click()}
                      className="flex-1 flex items-center justify-center gap-2 py-3 bg-white border-2 border-brand-vivid-green text-brand-grass-green rounded-xl font-bold text-sm hover:bg-green-50 transition-colors cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-sm">shield</span>
                      Verify Authenticity
                    </Link>
                  </div>
                </div>

                {/* Share */}
                <p className="text-center text-xs text-on-surface-variant" style={{ animation: "fadeUp 0.5s 0.5s ease-out both" }}>
                  Share this achievement with{" "}
                  <button
                    onClick={() => {
                      sfx.share();
                      navigator.share?.({ title: "My PharmacoZyme Certificate", text: `I earned a certificate from PharmacoZyme! ID: ${certificate.uniqueCertId}`, url: window.location.href }).catch(() => {});
                    }}
                    className="text-brand-vivid-green font-semibold underline cursor-pointer"
                  >
                    Share Link
                  </button>
                </p>
              </div>
            );
          })()}
        </div>
      </main>

      <Footer />

      <style>{`
        @keyframes confettiFall {
          0% { transform: translateY(-20px) rotate(0deg) scale(1); opacity: 1; }
          80% { opacity: 1; }
          100% { transform: translateY(110vh) rotate(720deg) scale(0.5); opacity: 0; }
        }
        @keyframes giftFloat {
          0%, 100% { transform: translateY(0) scale(1); }
          50% { transform: translateY(-16px) scale(1.02); }
        }
        @keyframes giftPop {
          0% { transform: scale(0.2) rotate(-20deg); opacity: 0; }
          60% { transform: scale(1.2) rotate(6deg); opacity: 1; }
          80% { transform: scale(0.93) rotate(-2deg); }
          100% { transform: scale(1) rotate(0deg); opacity: 1; }
        }
        @keyframes starSpin {
          0% { transform: rotate(-180deg) scale(0); opacity: 0; }
          60% { transform: rotate(20deg) scale(1.25); opacity: 1; }
          100% { transform: rotate(0deg) scale(1); opacity: 1; }
        }
        @keyframes burstRing {
          0% { transform: scale(0.4); opacity: 0.9; }
          100% { transform: scale(2.8); opacity: 0; }
        }
        @keyframes coreGlow {
          0% { opacity: 0; transform: scale(0.5); }
          50% { opacity: 1; }
          100% { opacity: 0; transform: scale(2); }
        }
        @keyframes fadeUp {
          0% { opacity: 0; transform: translateY(16px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeSlideUp {
          0% { opacity: 0; transform: translateY(36px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes cardReveal {
          0% { opacity: 0; transform: scale(0.94) translateY(24px); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes dotPulse {
          0%, 80%, 100% { transform: scale(0.8); opacity: 0.4; }
          40% { transform: scale(1.2); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
