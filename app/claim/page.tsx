"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Certificate } from "@/lib/types";
import { sfx } from "@/lib/sfx";

type ClaimStage = "loading" | "ready" | "opening" | "revealed" | "error";

export default function ClaimPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <span className="material-symbols-outlined text-4xl text-brand-vivid-green animate-spin">progress_activity</span>
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
  const [confettiPieces, setConfettiPieces] = useState<{ id: number; x: number; color: string; delay: number; size: number }[]>([]);
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

    // Box lid pops off
    sfx.unwrap();
    // Sparkle burst shortly after
    setTimeout(() => sfx.sparkle(), 280);
    // Triumphant fanfare as PDF reveals
    setTimeout(() => sfx.fanfare(), 850);

    // Generate confetti
    const pieces = Array.from({ length: 60 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      color: ["#52b788", "#1b4332", "#95d5b2", "#ffd700", "#ff6b6b", "#4ecdc4"][Math.floor(Math.random() * 6)],
      delay: Math.random() * 0.8,
      size: Math.random() * 8 + 6,
    }));
    setConfettiPieces(pieces);

    setTimeout(() => setStage("revealed"), 1600);
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
        {/* Confetti */}
        {stage === "opening" || stage === "revealed" ? (
          <div className="fixed inset-0 pointer-events-none z-30 overflow-hidden">
            {confettiPieces.map(p => (
              <div
                key={p.id}
                style={{
                  position: "absolute",
                  left: `${p.x}%`,
                  top: "-20px",
                  width: p.size,
                  height: p.size,
                  backgroundColor: p.color,
                  borderRadius: Math.random() > 0.5 ? "50%" : "2px",
                  animation: `confettiFall 2.5s ease-in ${p.delay}s forwards`,
                  transform: `rotate(${Math.random() * 360}deg)`,
                }}
              />
            ))}
          </div>
        ) : null}

        <div className="w-full max-w-lg mx-auto">
          {/* Loading state */}
          {stage === "loading" && (
            <div className="text-center space-y-6">
              <div className="relative w-24 h-24 mx-auto">
                <div className="absolute inset-0 rounded-full border-4 border-green-100" />
                <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-brand-vivid-green animate-spin" />
                <div className="absolute inset-3 rounded-full bg-green-50 flex items-center justify-center">
                  <span className="material-symbols-outlined text-3xl text-brand-vivid-green" style={{ fontVariationSettings: "'FILL' 1" }}>workspace_premium</span>
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-brand-dark-green font-semibold text-sm">Fetching your certificate...</p>
                <div className="flex justify-center gap-1.5">
                  {[0, 1, 2].map(i => (
                    <div key={i} className="w-1.5 h-1.5 rounded-full bg-brand-vivid-green"
                      style={{ animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite` }} />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Error state */}
          {stage === "error" && (
            <div className="bg-white rounded-2xl shadow-lg p-8 text-center border border-red-100">
              <span className="material-symbols-outlined text-5xl text-red-400 mb-4 block">error_outline</span>
              <h2 className="text-xl font-headline font-bold text-brand-dark-green mb-2">Certificate Not Found</h2>
              <p className="text-sm text-on-surface-variant mb-6">{error}</p>
              <Link
                href="/verify"
                onClick={() => sfx.click()}
                className="inline-flex items-center gap-2 px-6 py-3 bg-brand-vivid-green text-white rounded-xl font-semibold text-sm"
              >
                <span className="material-symbols-outlined text-sm">search</span>
                Try Verifying Manually
              </Link>
            </div>
          )}

          {/* Ready — show gift box to click */}
          {stage === "ready" && (
            <div className="text-center">
              <p className="text-sm text-on-surface-variant mb-2 uppercase tracking-widest font-bold text-brand-grass-green">
                Your Certificate Awaits
              </p>
              <h1 className="text-3xl sm:text-4xl font-headline font-bold text-brand-dark-green mb-2">
                {certificate?.recipientName}
              </h1>
              <p className="text-on-surface-variant mb-10 text-sm">Click the box to reveal your certificate</p>

              {/* Animated gift box */}
              <button
                onClick={handleOpen}
                className="mx-auto block group"
                style={{ WebkitTapHighlightColor: "transparent" }}
              >
                <div className="relative w-48 h-48 mx-auto" style={{ animation: "boxBounce 2s ease-in-out infinite" }}>
                  {/* Box body */}
                  <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-br from-[#1b4332] to-[#2d6a4f] rounded-2xl shadow-2xl flex items-center justify-center group-hover:scale-105 transition-transform">
                    {/* Ribbon vertical */}
                    <div className="absolute inset-x-0 top-0 bottom-0 flex items-center justify-center">
                      <div className="w-8 h-full bg-[#52b788]/40 rounded" />
                    </div>
                    <span className="material-symbols-outlined text-white/80 text-5xl z-10" style={{ fontVariationSettings: "'FILL' 1" }}>
                      workspace_premium
                    </span>
                  </div>
                  {/* Box lid */}
                  <div
                    className="absolute top-0 left-0 right-0 h-14 bg-gradient-to-br from-[#52b788] to-[#1b4332] rounded-2xl shadow-lg group-hover:-translate-y-4 transition-transform duration-300 origin-bottom"
                  >
                    {/* Ribbon horizontal on lid */}
                    <div className="absolute inset-y-0 left-0 right-0 flex items-center justify-center">
                      <div className="h-4 w-full bg-[#95d5b2]/30 rounded" />
                    </div>
                    {/* Bow */}
                    <div className="absolute -top-5 left-1/2 -translate-x-1/2 flex gap-2">
                      <div className="w-8 h-8 bg-[#ffd700] rounded-full opacity-90 scale-x-150 origin-right" />
                      <div className="w-8 h-8 bg-[#ffd700] rounded-full opacity-90 scale-x-150 origin-left" />
                    </div>
                  </div>
                </div>
                <p className="mt-6 text-brand-vivid-green font-bold text-sm uppercase tracking-widest flex items-center justify-center gap-2 group-hover:scale-105 transition-transform">
                  <span className="material-symbols-outlined text-sm">touch_app</span>
                  Tap to Open
                </p>
              </button>
            </div>
          )}

          {/* Opening animation */}
          {stage === "opening" && (
            <div className="text-center">
              {/* Burst rings */}
              <div className="relative w-48 h-48 mx-auto flex items-center justify-center">
                {[0, 1, 2].map(i => (
                  <div key={i} className="absolute inset-0 rounded-full border-4 border-brand-vivid-green"
                    style={{ animation: `burstRing 1s ease-out ${i * 0.15}s forwards`, opacity: 0 }} />
                ))}
                <div
                  className="w-28 h-28 rounded-full bg-gradient-to-br from-[#52b788] via-[#2d6a4f] to-[#1b4332] flex items-center justify-center shadow-2xl"
                  style={{ animation: "giftPop 0.8s cubic-bezier(0.34,1.56,0.64,1) forwards" }}
                >
                  <span
                    className="material-symbols-outlined text-6xl text-white"
                    style={{ fontVariationSettings: "'FILL' 1", animation: "starSpin 1.2s ease-out forwards" }}
                  >
                    workspace_premium
                  </span>
                </div>
              </div>
              <p className="mt-6 text-brand-vivid-green font-bold text-xl" style={{ animation: "fadeUp 0.5s 0.4s ease-out both" }}>
                🎊 Congratulations!
              </p>
            </div>
          )}

          {/* Revealed — PDF first, then card */}
          {stage === "revealed" && certificate && (() => {
            const rawUrl = certificate.driveLink || certificate.pdfUrl || "";
            const fileIdMatch = rawUrl.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
            const embedUrl = fileIdMatch
              ? `https://drive.google.com/file/d/${fileIdMatch[1]}/preview`
              : rawUrl;

            return (
              <div style={{ animation: "fadeSlideUp 0.6s ease-out forwards" }}>
                {/* Congrats banner */}
                <div className="text-center mb-5">
                  <h1 className="text-2xl sm:text-3xl font-headline font-bold text-brand-dark-green">
                    🎉 Congratulations, {certificate.recipientName?.split(" ")[0]}!
                  </h1>
                  <p className="text-on-surface-variant text-sm mt-1">Your certificate has been verified and is ready.</p>
                </div>

                {/* === PRIMARY: Actual PDF Certificate === */}
                <div
                  className="rounded-2xl overflow-hidden border border-green-200 shadow-2xl bg-white mb-5"
                  style={{ animation: "cardReveal 0.7s 0.15s ease-out both" }}
                >
                  {/* PDF toolbar row */}
                  <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-[#1b4332] to-[#2d6a4f]">
                    <div className="flex items-center gap-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src="/pharmacozyme-logo.png" alt="" className="h-6 opacity-90" />
                      <span className="text-[#95d5b2] text-xs font-bold uppercase tracking-widest">Certificate of Achievement</span>
                    </div>
                    {rawUrl && (
                      <a href={rawUrl} target="_blank" rel="noopener noreferrer"
                        onClick={() => sfx.click()}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-white/15 hover:bg-white/25 rounded-lg text-white text-xs font-bold transition-colors">
                        <span className="material-symbols-outlined text-sm">download</span>
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
                    /* No Drive link yet — show name card fallback */
                    <div className="p-8 text-center">
                      <span className="material-symbols-outlined text-5xl text-brand-vivid-green mb-3 block" style={{ fontVariationSettings: "'FILL' 1" }}>workspace_premium</span>
                      <p className="text-xs text-on-surface-variant mb-1">Certificate for</p>
                      <p className="text-2xl font-headline font-bold text-brand-dark-green">{certificate.recipientName}</p>
                      <p className="text-xs text-on-surface-variant mt-2">PDF available after generation is complete.</p>
                    </div>
                  )}
                </div>

                {/* === SECONDARY: Verified badge + meta === */}
                <div
                  className="bg-white rounded-2xl border border-green-100 shadow-sm p-5 mb-5"
                  style={{ animation: "cardReveal 0.7s 0.35s ease-out both" }}
                >
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <div>
                      <p className="text-[10px] uppercase tracking-widest text-outline mb-0.5">Certificate ID</p>
                      <p className="font-mono font-bold text-brand-grass-green">{certificate.uniqueCertId}</p>
                    </div>
                    {certificate.issueDate && (
                      <div>
                        <p className="text-[10px] uppercase tracking-widest text-outline mb-0.5">Issue Date</p>
                        <p className="font-semibold text-brand-dark-green text-sm">{formatDate(String(certificate.issueDate))}</p>
                      </div>
                    )}
                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 border border-green-200 rounded-full">
                      <span className="material-symbols-outlined text-brand-vivid-green text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>
                      <span className="text-xs font-bold text-brand-vivid-green uppercase tracking-widest">Verified</span>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2 mt-4">
                    {rawUrl && (
                      <a href={rawUrl} target="_blank" rel="noopener noreferrer"
                        onClick={() => sfx.send()}
                        className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-gradient-to-r from-[#1b4332] to-[#2d6a4f] text-white rounded-xl font-bold text-sm hover:opacity-90 transition-opacity">
                        <span className="material-symbols-outlined text-sm">download</span>
                        Download PDF
                      </a>
                    )}
                    <Link href={`/verify?certId=${certificate.uniqueCertId}`}
                      onClick={() => sfx.click()}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-white border-2 border-brand-vivid-green text-brand-grass-green rounded-xl font-bold text-sm hover:bg-green-50 transition-colors">
                      <span className="material-symbols-outlined text-sm">shield</span>
                      Verify Authenticity
                    </Link>
                  </div>
                </div>

                <p className="text-center text-xs text-on-surface-variant">
                  Share this achievement with{" "}
                  <button
                    onClick={() => {
                      sfx.share();
                      navigator.share?.({ title: "My PharmacoZyme Certificate", text: `I earned a certificate from PharmacoZyme! ID: ${certificate.uniqueCertId}`, url: window.location.href }).catch(() => {});
                    }}
                    className="text-brand-vivid-green font-semibold underline"
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
          0% { transform: translateY(-20px) rotate(0deg); opacity: 1; }
          100% { transform: translateY(110vh) rotate(720deg); opacity: 0; }
        }
        @keyframes boxBounce {
          0%, 100% { transform: translateY(0) scale(1); }
          50% { transform: translateY(-14px) scale(1.03); }
        }
        @keyframes giftPop {
          0% { transform: scale(0.3) rotate(-15deg); opacity: 0; }
          60% { transform: scale(1.15) rotate(5deg); opacity: 1; }
          80% { transform: scale(0.95) rotate(-2deg); }
          100% { transform: scale(1) rotate(0deg); opacity: 1; }
        }
        @keyframes starSpin {
          0% { transform: rotate(-180deg) scale(0); opacity: 0; }
          60% { transform: rotate(20deg) scale(1.2); opacity: 1; }
          100% { transform: rotate(0deg) scale(1); opacity: 1; }
        }
        @keyframes burstRing {
          0% { transform: scale(0.5); opacity: 0.8; }
          100% { transform: scale(2.5); opacity: 0; }
        }
        @keyframes fadeUp {
          0% { opacity: 0; transform: translateY(16px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeSlideUp {
          0% { opacity: 0; transform: translateY(30px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes cardReveal {
          0% { opacity: 0; transform: scale(0.93) translateY(20px); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes bounce {
          0%, 80%, 100% { transform: translateY(0); }
          40% { transform: translateY(-8px); }
        }
      `}</style>
    </div>
  );
}
