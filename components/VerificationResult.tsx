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
      <div className="bg-white rounded-xl overflow-hidden border border-outline-variant/20 animate-pulse">
        <div className="h-36 sm:h-44 lg:h-48 bg-gray-200"></div>
        <div className="p-4 sm:p-6 lg:p-8 space-y-4">
          <div className="h-6 bg-gray-200 rounded-xl w-3/4"></div>
          <div className="h-4 bg-gray-200 rounded-xl w-1/2"></div>
          <div className="h-4 bg-gray-200 rounded-xl w-full"></div>
          <div className="h-4 bg-gray-200 rounded-xl w-2/3"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-xl overflow-hidden border border-red-200">
        <div className="bg-red-50 p-4 sm:p-6 flex items-center gap-3 sm:gap-4 border-b border-red-100">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-red-100 flex items-center justify-center">
            <span className="material-symbols-outlined text-red-500 text-xl">error</span>
          </div>
          <div>
            <p className="font-headline font-bold text-red-700 text-sm sm:text-base">Verification Failed</p>
            <p className="text-xs sm:text-sm text-red-500">{error}</p>
          </div>
        </div>
        <div className="p-4 sm:p-6 text-center">
          <p className="text-xs sm:text-sm text-gray-500 mb-4">
            If you believe this is an error, please contact our support team.
          </p>
          <button
            onClick={onClose}
            className="px-5 sm:px-6 py-2 sm:py-3 rounded-xl border-2 border-gray-200 text-gray-600 hover:border-red-300 hover:text-red-600 transition-all font-medium text-xs sm:text-sm"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (!certificate) {
    return null;
  }

  const isValid = certificate.status === "generated" || certificate.status === "sent";

  const downloadUrl = certificate?.driveLink || certificate?.pdfUrl || "";

  return (
    <div
      className="bg-white rounded-xl overflow-hidden border border-outline-variant/20 relative"
      style={{
        transform: revealed ? "translateY(0) scale(1)" : "translateY(20px) scale(0.97)",
        opacity: revealed ? 1 : 0,
        transition: "all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)",
      }}
    >
      {/* Confetti burst */}
      {showConfetti && (
        <div className="absolute inset-0 pointer-events-none z-50 overflow-hidden">
          {Array.from({ length: 18 }).map((_, i) => (
            <div
              key={i}
              className="absolute w-2 h-2 rounded-sm"
              style={{
                left: `${10 + Math.random() * 80}%`,
                top: "-8px",
                background: ["#22c55e","#16a34a","#4ade80","#fbbf24","#60a5fa","#f472b6"][i % 6],
                animation: `fall ${0.8 + Math.random() * 1.2}s ease-in ${Math.random() * 0.4}s forwards`,
                transform: `rotate(${Math.random() * 360}deg)`,
              }}
            />
          ))}
        </div>
      )}
      {/* Header with dark green background */}
      <div className="relative h-36 sm:h-44 lg:h-48 bg-dark-green overflow-hidden">
        <div className="absolute inset-0 p-4 sm:p-6 lg:p-8 flex flex-col justify-end">
          <div className="text-primary-fixed font-headline font-semibold text-base sm:text-lg mb-1">
            {certificate.certType}
          </div>
          <div className="text-white/60 text-[9px] sm:text-[10px] uppercase tracking-widest font-medium">
            {certificate.subCategory} Certificate
          </div>
        </div>
        <div className="absolute top-4 sm:top-6 right-4 sm:right-6 px-3 sm:px-4 py-1.5 sm:py-2 bg-white/10 backdrop-blur-md rounded-full border border-white/20">
          <span className="text-white text-[9px] sm:text-[10px] font-bold tracking-widest uppercase">
            {isValid ? "Valid ID" : "Invalid"}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 sm:p-6 lg:p-8 space-y-4 sm:space-y-6">
        <div className="flex justify-between items-start">
          <div>
            <label className="block text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-outline mb-1">Holder Name</label>
            <div className="text-base sm:text-xl font-headline font-bold text-dark-green">{certificate.recipientName}</div>
          </div>
          <div className="w-12 h-12 sm:w-14 sm:h-14 lg:w-16 lg:h-16 rounded-xl bg-surface-container-low flex items-center justify-center border border-surface-variant">
            <span className="material-symbols-outlined text-vivid-green text-xl sm:text-2xl lg:text-3xl">qr_code_2</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:gap-8">
          <div>
            <label className="block text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-outline mb-1">Issue Date</label>
            <div className="text-xs sm:text-sm font-semibold text-dark-green">{certificate.issueDate}</div>
          </div>
          <div>
            <label className="block text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-outline mb-1">Category</label>
            <div className="text-xs sm:text-sm font-semibold text-dark-green">{certificate.category}</div>
          </div>
        </div>

        {/* Blockchain Hash */}
        <div className="pt-3 sm:pt-4 border-t border-surface-container">
          <div className="flex items-center gap-2 mb-1.5 sm:mb-2">
            <span className="material-symbols-outlined text-outline text-sm">link</span>
            <p className="text-[9px] sm:text-[10px] text-gray-500 font-medium uppercase tracking-wider">Blockchain Hash</p>
          </div>
          <p className="font-mono text-[10px] sm:text-xs text-gray-600 break-all">{certificate.blockchainHash}</p>
        </div>

        {/* Verified Stamp + Download */}
        <div className="pt-3 sm:pt-4 border-t border-surface-container flex flex-wrap items-center gap-3">
          <div className={`inline-flex items-center gap-2 px-4 sm:px-6 py-2 sm:py-3 rounded-xl border ${isValid ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
            <span
              className={`material-symbols-outlined ${isValid ? 'text-vivid-green' : 'text-red-500'} text-base sm:text-lg`}
              style={isValid ? { fontVariationSettings: "'FILL' 1" } : {}}
            >
              {isValid ? 'verified' : 'cancel'}
            </span>
            <span className={`font-bold text-[9px] sm:text-[10px] tracking-[0.2em] uppercase ${isValid ? 'text-vivid-green' : 'text-red-500'}`}>
              {isValid ? 'VERIFIED ✓' : 'INVALID'}
            </span>
          </div>
          {isValid && downloadUrl && (
            <a
              href={downloadUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => sfx.send()}
              className="inline-flex items-center gap-2 px-4 py-2 sm:py-3 rounded-xl bg-dark-green text-white text-[9px] sm:text-[10px] font-bold tracking-widest uppercase hover:bg-green-900 transition-colors"
            >
              <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>download</span>
              Download PDF
            </a>
          )}
        </div>
      </div>

      {/* Side Note */}
      <div className="px-4 sm:px-6 lg:px-8 pb-4 sm:pb-6 lg:pb-8">
        <div className="p-3 sm:p-4 rounded-xl bg-primary-container/30 border-l-4 border-vivid-green">
          <p className="text-[10px] sm:text-[11px] text-on-surface-variant leading-relaxed italic">
            "This verification record is linked to our secure blockchain hash. Any unauthorized duplication or alteration is detectable by our system."
          </p>
        </div>
      </div>
    </div>
  );
}
