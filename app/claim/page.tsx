"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Certificate } from "@/lib/types";

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
        } else {
          setError(data.error || "Certificate not found.");
          setStage("error");
        }
      })
      .catch(() => {
        setError("Failed to load certificate. Please try again.");
        setStage("error");
      });
  }, [certId]);

  const handleOpen = () => {
    if (hasOpened.current) return;
    hasOpened.current = true;
    setStage("opening");

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
            <div className="text-center">
              <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-green-100 flex items-center justify-center animate-pulse">
                <span className="material-symbols-outlined text-4xl text-brand-vivid-green">workspace_premium</span>
              </div>
              <p className="text-on-surface-variant text-sm animate-pulse">Loading your certificate...</p>
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
              <div
                className="w-32 h-32 mx-auto rounded-full bg-gradient-to-br from-[#52b788] to-[#1b4332] flex items-center justify-center shadow-2xl"
                style={{ animation: "boxExplode 1.5s ease-out forwards" }}
              >
                <span className="material-symbols-outlined text-5xl text-white" style={{ fontVariationSettings: "'FILL' 1", animation: "spinIn 1.5s ease-out forwards" }}>
                  workspace_premium
                </span>
              </div>
              <p className="mt-6 text-brand-vivid-green font-bold text-lg animate-pulse">Congratulations!</p>
            </div>
          )}

          {/* Revealed — certificate card */}
          {stage === "revealed" && certificate && (
            <div style={{ animation: "fadeSlideUp 0.6s ease-out forwards" }}>
              {/* Congrats banner */}
              <div className="text-center mb-6">
                <span className="text-4xl">🎉</span>
                <h1 className="text-2xl sm:text-3xl font-headline font-bold text-brand-dark-green mt-2">
                  Congratulations, {certificate.recipientName?.split(" ")[0]}!
                </h1>
                <p className="text-on-surface-variant text-sm mt-1">Your certificate has been verified and is ready.</p>
              </div>

              {/* Certificate card */}
              <div
                className="bg-white rounded-2xl shadow-2xl overflow-hidden border border-green-100"
                style={{ animation: "cardReveal 0.8s 0.2s ease-out both" }}
              >
                {/* Header */}
                <div className="bg-gradient-to-r from-[#1b4332] to-[#2d6a4f] p-6 text-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/pharmacozyme-logo.png" alt="PharmacoZyme" className="h-10 mx-auto mb-3 opacity-90" />
                  <p className="text-[#95d5b2] text-xs uppercase tracking-[0.3em] font-bold">Certificate of Achievement</p>
                </div>

                {/* Body */}
                <div className="p-6 sm:p-8 text-center">
                  <p className="text-on-surface-variant text-xs uppercase tracking-widest mb-2">This certificate is proudly presented to</p>
                  <h2 className="text-2xl sm:text-3xl font-headline font-bold text-brand-dark-green mb-4">{certificate.recipientName}</h2>

                  <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-50 border border-green-200 rounded-full mb-6">
                    <span className="material-symbols-outlined text-brand-vivid-green text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>
                    <span className="text-xs font-bold text-brand-vivid-green uppercase tracking-widest">Verified Certificate</span>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-left mb-6">
                    {certificate.certType && (
                      <div className="bg-surface-container-low rounded-xl p-3">
                        <p className="text-[10px] uppercase tracking-widest text-outline mb-1">Type</p>
                        <p className="font-semibold text-brand-dark-green text-sm">{certificate.certType}</p>
                      </div>
                    )}
                    {certificate.topic && (
                      <div className="bg-surface-container-low rounded-xl p-3">
                        <p className="text-[10px] uppercase tracking-widest text-outline mb-1">Topic</p>
                        <p className="font-semibold text-brand-dark-green text-sm">{certificate.topic}</p>
                      </div>
                    )}
                    <div className="bg-surface-container-low rounded-xl p-3">
                      <p className="text-[10px] uppercase tracking-widest text-outline mb-1">Certificate ID</p>
                      <p className="font-mono font-bold text-brand-grass-green text-sm">{certificate.uniqueCertId}</p>
                    </div>
                    {certificate.issueDate && (
                      <div className="bg-surface-container-low rounded-xl p-3">
                        <p className="text-[10px] uppercase tracking-widest text-outline mb-1">Issue Date</p>
                        <p className="font-semibold text-brand-dark-green text-sm">{formatDate(String(certificate.issueDate))}</p>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    {(certificate.pdfUrl || certificate.driveLink) && (
                      <a
                        href={(certificate.pdfUrl || certificate.driveLink)!}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-[#1b4332] to-[#2d6a4f] text-white rounded-xl font-bold text-sm hover:opacity-90 transition-opacity"
                      >
                        <span className="material-symbols-outlined text-sm">download</span>
                        Download PDF
                      </a>
                    )}
                    <Link
                      href={`/verify?certId=${certificate.uniqueCertId}`}
                      className="flex items-center justify-center gap-2 px-6 py-3 bg-white border-2 border-brand-vivid-green text-brand-grass-green rounded-xl font-bold text-sm hover:bg-green-50 transition-colors"
                    >
                      <span className="material-symbols-outlined text-sm">verified</span>
                      View Verification
                    </Link>
                  </div>
                </div>

                {/* Footer */}
                <div className="bg-[#f0fdf4] px-6 py-4 border-t border-green-100 flex items-center justify-between">
                  <p className="text-[10px] text-outline">PharmacoZyme Certificate System</p>
                  <p className="text-[10px] text-outline font-mono">{certificate.uniqueCertId}</p>
                </div>
              </div>

              {/* Share nudge */}
              <p className="text-center text-xs text-on-surface-variant mt-6">
                Share this achievement with{" "}
                <button
                  onClick={() => navigator.share?.({ title: "My PharmacoZyme Certificate", text: `I earned a certificate from PharmacoZyme! ID: ${certificate.uniqueCertId}`, url: window.location.href }).catch(() => {})}
                  className="text-brand-vivid-green font-semibold underline"
                >
                  Share Link
                </button>
              </p>
            </div>
          )}
        </div>
      </main>

      <Footer />

      <style>{`
        @keyframes confettiFall {
          0% { transform: translateY(-20px) rotate(0deg); opacity: 1; }
          100% { transform: translateY(110vh) rotate(720deg); opacity: 0; }
        }
        @keyframes boxBounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-12px); }
        }
        @keyframes boxExplode {
          0% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.4); opacity: 0.8; }
          100% { transform: scale(0.8); opacity: 0; }
        }
        @keyframes spinIn {
          0% { transform: rotate(0deg) scale(0.5); opacity: 0; }
          100% { transform: rotate(720deg) scale(1); opacity: 1; }
        }
        @keyframes fadeSlideUp {
          0% { opacity: 0; transform: translateY(30px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes cardReveal {
          0% { opacity: 0; transform: scale(0.9) rotateX(10deg); }
          100% { opacity: 1; transform: scale(1) rotateX(0deg); }
        }
      `}</style>
    </div>
  );
}
