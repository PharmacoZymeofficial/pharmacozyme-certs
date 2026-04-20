"use client";

import { useState, useEffect } from "react";
import { Certificate } from "@/lib/types";
import { sfx } from "@/lib/sfx";

interface VerificationResultProps {
  certificate: Certificate | null;
  isLoading: boolean;
  error: string | null;
  onClose: () => void;
}

export default function VerificationResult({ certificate, isLoading, error, onClose }: VerificationResultProps) {
  const [revealed, setRevealed] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);

  useEffect(() => {
    if (certificate) {
      setRevealed(false);
      setShowConfetti(false);
      const t1 = setTimeout(() => setRevealed(true), 100);
      const t2 = setTimeout(() => { setShowConfetti(true); sfx.sparkle(); }, 600);
      const t3 = setTimeout(() => setShowConfetti(false), 3500);
      return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
    }
  }, [certificate]);

  if (isLoading) {
    return (
      <div className="bg-white rounded-2xl overflow-hidden border border-outline-variant/20 shadow-lg animate-pulse">
        <div className="h-44 sm:h-52 bg-gradient-to-br from-gray-200 to-gray-300" />
        <div className="p-5 sm:p-7 space-y-4">
          <div className="h-5 bg-gray-200 rounded-xl w-3/4" />
          <div className="h-4 bg-gray-100 rounded-xl w-1/2" />
          <div className="grid grid-cols-2 gap-4">
            <div className="h-10 bg-gray-100 rounded-xl" />
            <div className="h-10 bg-gray-100 rounded-xl" />
          </div>
          <div className="h-4 bg-gray-100 rounded-xl w-full" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-2xl overflow-hidden border border-red-100 shadow-lg">
        <div className="bg-gradient-to-br from-red-50 to-rose-50 p-6 sm:p-8 flex items-center gap-4 border-b border-red-100">
          <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
            <span className="material-symbols-outlined text-red-500 text-2xl">error</span>
          </div>
          <div>
            <p className="font-headline font-bold text-red-700 text-base">Verification Failed</p>
            <p className="text-xs text-red-500 mt-0.5">{error}</p>
          </div>
        </div>
        <div className="p-5 sm:p-6 text-center space-y-4">
          <p className="text-xs text-gray-500">
            If you believe this is an error, please contact our support team.
          </p>
          <button
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl border-2 border-gray-200 text-gray-600 hover:border-red-300 hover:text-red-600 transition-all font-medium text-xs"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (!certificate) return null;

  const isValid = certificate.status === "generated" || certificate.status === "sent";
  const downloadUrl = certificate?.driveLink || certificate?.pdfUrl || "";
  const displayTitle = certificate.certType || certificate.topic || certificate.subCategory || "Certificate";
  const displaySubtitle = [certificate.category, certificate.subCategory].filter(Boolean).join(" — ");

  return (
    <div
      className="bg-white rounded-2xl overflow-hidden border border-outline-variant/20 shadow-xl relative"
      style={{
        transform: revealed ? "translateY(0) scale(1)" : "translateY(24px) scale(0.96)",
        opacity: revealed ? 1 : 0,
        transition: "all 0.55s cubic-bezier(0.34, 1.56, 0.64, 1)",
      }}
    >
      {/* Confetti burst */}
      {showConfetti && (
        <div className="absolute inset-0 pointer-events-none z-50 overflow-hidden rounded-2xl">
          {Array.from({ length: 22 }).map((_, i) => (
            <div
              key={i}
              className="absolute w-2 h-2 rounded-sm"
              style={{
                left: `${5 + Math.random() * 90}%`,
                top: "-8px",
                background: ["#22c55e","#16a34a","#4ade80","#fbbf24","#60a5fa","#f472b6","#a78bfa"][i % 7],
                animation: `fall ${0.7 + Math.random() * 1.3}s ease-in ${Math.random() * 0.5}s forwards`,
                transform: `rotate(${Math.random() * 360}deg)`,
              }}
            />
          ))}
        </div>
      )}

      {/* Premium header */}
      <div className="relative h-44 sm:h-52 overflow-hidden" style={{ background: "linear-gradient(135deg, #0f2d1f 0%, #1b4332 40%, #2d6a4f 100%)" }}>
        {/* Decorative grid pattern */}
        <div className="absolute inset-0 opacity-[0.06]" style={{
          backgroundImage: "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)",
          backgroundSize: "28px 28px"
        }} />
        {/* Ambient glow */}
        <div className="absolute -bottom-8 -left-8 w-48 h-48 rounded-full opacity-20" style={{ background: "radial-gradient(circle, #52b788, transparent 70%)" }} />
        <div className="absolute -top-4 right-8 w-32 h-32 rounded-full opacity-10" style={{ background: "radial-gradient(circle, #95d5b2, transparent 70%)" }} />

        {/* Content */}
        <div className="absolute inset-0 p-5 sm:p-7 flex flex-col justify-end">
          {/* Valid/Invalid pill */}
          <div className={`absolute top-4 sm:top-5 right-4 sm:right-5 px-3 sm:px-4 py-1.5 rounded-full border backdrop-blur-md flex items-center gap-1.5 ${isValid ? "bg-green-500/20 border-green-400/40" : "bg-red-500/20 border-red-400/40"}`}>
            <div className={`w-1.5 h-1.5 rounded-full ${isValid ? "bg-green-400 animate-pulse" : "bg-red-400"}`} />
            <span className={`text-[9px] sm:text-[10px] font-bold tracking-widest uppercase ${isValid ? "text-green-300" : "text-red-300"}`}>
              {isValid ? "Valid ID" : "Invalid"}
            </span>
          </div>

          <div className="text-primary-fixed font-headline font-bold text-lg sm:text-xl mb-1 drop-shadow-sm">
            {displayTitle}
          </div>
          <div className="text-white/50 text-[9px] sm:text-[10px] uppercase tracking-[0.2em] font-medium">
            {displaySubtitle || "PharmacoZyme Certificate"}
          </div>
        </div>

        {/* Seal watermark */}
        <div className="absolute top-1/2 right-16 -translate-y-1/2 opacity-5">
          <span className="material-symbols-outlined text-white" style={{ fontSize: "96px", fontVariationSettings: "'FILL' 1" }}>verified</span>
        </div>
      </div>

      {/* Content */}
      <div className="p-5 sm:p-7 space-y-5">
        {/* Holder + QR */}
        <div className="flex justify-between items-start gap-3">
          <div>
            <label className="block text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-outline mb-1">Holder Name</label>
            <div className="text-lg sm:text-2xl font-headline font-bold text-dark-green leading-tight">{certificate.recipientName}</div>
          </div>
          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-surface-container-low flex items-center justify-center border border-surface-variant flex-shrink-0">
            <span className="material-symbols-outlined text-vivid-green text-2xl sm:text-3xl">qr_code_2</span>
          </div>
        </div>

        {/* Details grid */}
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          <div className="bg-surface-container-low/50 rounded-xl p-3">
            <label className="block text-[8px] sm:text-[9px] font-bold uppercase tracking-widest text-outline mb-1">Issue Date</label>
            <div className="text-xs sm:text-sm font-semibold text-dark-green">{certificate.issueDate}</div>
          </div>
          <div className="bg-surface-container-low/50 rounded-xl p-3">
            <label className="block text-[8px] sm:text-[9px] font-bold uppercase tracking-widest text-outline mb-1">Category</label>
            <div className="text-xs sm:text-sm font-semibold text-dark-green">{certificate.category}</div>
          </div>
          <div className="bg-surface-container-low/50 rounded-xl p-3 col-span-2">
            <label className="block text-[8px] sm:text-[9px] font-bold uppercase tracking-widest text-outline mb-1">Sub-Category</label>
            <div className="text-xs sm:text-sm font-semibold text-dark-green">{certificate.subCategory || "—"}</div>
          </div>
        </div>

        {/* Cert ID */}
        <div className="flex items-center gap-2 p-3 rounded-xl bg-surface-container-low/50 border border-outline-variant/10">
          <span className="material-symbols-outlined text-outline text-base">badge</span>
          <div>
            <p className="text-[8px] text-outline font-bold uppercase tracking-wider">Certificate ID</p>
            <p className="font-mono text-xs text-dark-green font-semibold">{certificate.uniqueCertId}</p>
          </div>
        </div>

        {/* Blockchain Hash */}
        <div className="flex items-start gap-2">
          <span className="material-symbols-outlined text-outline text-sm mt-0.5">link</span>
          <div className="min-w-0">
            <p className="text-[9px] text-gray-500 font-medium uppercase tracking-wider mb-0.5">Blockchain Hash</p>
            <p className="font-mono text-[10px] text-gray-500 break-all leading-relaxed">{certificate.blockchainHash}</p>
          </div>
        </div>

        {/* Verified stamp + Download */}
        <div className="pt-3 border-t border-surface-container flex flex-wrap items-center gap-2.5">
          <div className={`inline-flex items-center gap-2 px-4 sm:px-5 py-2.5 rounded-xl border ${isValid ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}`}>
            <span
              className={`material-symbols-outlined ${isValid ? "text-vivid-green" : "text-red-500"} text-base sm:text-lg`}
              style={isValid ? { fontVariationSettings: "'FILL' 1" } : {}}
            >
              {isValid ? "verified" : "cancel"}
            </span>
            <span className={`font-bold text-[9px] sm:text-[10px] tracking-[0.2em] uppercase ${isValid ? "text-vivid-green" : "text-red-500"}`}>
              {isValid ? "VERIFIED ✓" : "INVALID"}
            </span>
          </div>
          {isValid && downloadUrl && (
            <a
              href={downloadUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => sfx.send()}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-dark-green text-white text-[9px] sm:text-[10px] font-bold tracking-widest uppercase hover:bg-green-900 transition-colors"
            >
              <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>download</span>
              Download PDF
            </a>
          )}
        </div>
      </div>

      {/* Footer note */}
      <div className="px-5 sm:px-7 pb-5 sm:pb-7">
        <div className="p-3 sm:p-4 rounded-xl bg-primary-container/30 border-l-4 border-vivid-green">
          <p className="text-[10px] sm:text-[11px] text-on-surface-variant leading-relaxed italic">
            "This verification record is linked to our secure blockchain hash. Any unauthorized duplication or alteration is detectable by our system."
          </p>
        </div>
      </div>
    </div>
  );
}
