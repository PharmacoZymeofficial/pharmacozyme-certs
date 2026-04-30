"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import VerifySearch from "@/components/VerifySearch";
import VerificationResult from "@/components/VerificationResult";
import TrustBadges from "@/components/TrustBadges";
import PublicDatabaseCards from "@/components/PublicDatabaseCards";
import { Certificate } from "@/lib/types";
import { sfx } from "@/lib/sfx";

export default function VerifyPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex flex-col bg-surface">
          <Navbar />
          <main className="flex-1 flex items-center justify-center">
            <VerifyPageSkeleton />
          </main>
          <Footer />
        </div>
      }
    >
      <VerifyContent />
    </Suspense>
  );
}

function VerifyPageSkeleton() {
  return (
    <div className="w-full max-w-7xl mx-auto px-4 py-16 space-y-8 animate-pulse">
      <div className="h-12 bg-gray-200 rounded-xl w-1/2 mx-auto" />
      <div className="h-6 bg-gray-100 rounded-xl w-1/3 mx-auto" />
      <div className="h-40 bg-gray-100 rounded-2xl mt-8" />
    </div>
  );
}

function VerifyContent() {
  const searchParams = useSearchParams();
  const urlCertId = searchParams.get("certId") || searchParams.get("id") || "";

  const [certificate, setCertificate] = useState<Certificate | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasAutoVerified, setHasAutoVerified] = useState(false);
  const [preselectedDbId, setPreselectedDbId] = useState<string | null>(null);

  const resultRef = useRef<HTMLDivElement>(null);

  const scrollToSearch = () => {
    document.getElementById("verify-search")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handleVerify = async (certId: string, category?: string, subCategory?: string) => {
    setIsLoading(true);
    setError(null);
    setCertificate(null);

    try {
      const params = new URLSearchParams({ certId });
      if (category) params.set("category", category);
      if (subCategory) params.set("subCategory", subCategory);
      const response = await fetch(`/api/verify?${params.toString()}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Certificate not found. Please check the ID and try again.");
      }

      setCertificate(data.certificate);
      sfx.success();

      setTimeout(() => {
        resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 200);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred.");
      sfx.error();
      setTimeout(() => {
        resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-verify from URL param
  useEffect(() => {
    if (urlCertId && !hasAutoVerified) {
      setHasAutoVerified(true);
      handleVerify(urlCertId);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlCertId]);

  const handleClose = () => {
    setCertificate(null);
    setError(null);
  };

  const handleDatabaseSelect = (dbId: string) => {
    setPreselectedDbId(dbId);
    setTimeout(scrollToSearch, 80);
  };

  return (
    <div className="min-h-screen flex flex-col bg-surface">
      <Navbar />

      <main className="flex-1 pb-20">

        {/* ── HERO ── */}
        <section className="relative w-full overflow-hidden flex flex-col" style={{ height: "100svh" }}>
          {/* Desktop video */}
          <video
            className="hidden sm:block absolute inset-0 w-full h-full object-cover"
            src="/videos/hero-pc.mp4"
            autoPlay loop muted playsInline
          />
          {/* Mobile video */}
          <video
            className="sm:hidden absolute inset-0 w-full h-full object-cover"
            src="/videos/hero-mobile.mp4"
            autoPlay loop muted playsInline
          />

          {/* Gradient overlay — fades to section bg at bottom */}
          <div
            className="absolute inset-0"
            style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.2) 0%, rgba(0,0,0,0.1) 35%, rgba(6,15,8,0.7) 75%, rgba(6,15,8,1) 100%)" }}
          />

          {/* Centered headline */}
          <div className="relative z-10 flex-1 flex flex-col items-center justify-center text-center px-4">
            <div
              className="inline-flex items-center gap-2 mb-5 px-4 py-1.5 rounded-full"
              style={{ background: "rgba(82,183,136,0.12)", border: "1px solid rgba(82,183,136,0.25)" }}
            >
              <span
                className="material-symbols-outlined text-sm"
                style={{ color: "#52b788", fontVariationSettings: "'FILL' 1" }}
              >
                verified
              </span>
              <span className="text-xs font-semibold tracking-widest uppercase" style={{ color: "#52b788" }}>
                PharmacoZyme
              </span>
            </div>

            <h1
              className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white mb-4 leading-tight"
              style={{ fontFamily: "Fredoka, sans-serif", textShadow: "0 2px 24px rgba(0,0,0,0.4)" }}
            >
              Certificate Verification
            </h1>
            <p className="text-sm sm:text-base max-w-sm mx-auto mb-8" style={{ color: "rgba(255,255,255,0.55)" }}>
              Instantly verify the authenticity of any PharmacoZyme certificate
            </p>

            <div className="opacity-60">
              <TrustBadges dark />
            </div>
          </div>

          {/* Scroll-down indicator */}
          <div className="relative z-10 flex flex-col items-center pb-8 gap-1">
            <a
              href="#verify-search"
              onClick={(e) => { e.preventDefault(); scrollToSearch(); }}
              className="flex flex-col items-center gap-1.5 cursor-pointer group"
              aria-label="Scroll to search"
            >
              <span className="text-[11px] uppercase tracking-widest font-semibold" style={{ color: "rgba(82,183,136,0.5)" }}>
                Search Below
              </span>
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center"
                style={{
                  background: "rgba(82,183,136,0.12)",
                  border: "1px solid rgba(82,183,136,0.25)",
                  animation: "scrollBounce 2s ease-in-out infinite",
                }}
              >
                <span className="material-symbols-outlined text-base" style={{ color: "#52b788" }}>expand_more</span>
              </div>
            </a>
          </div>
        </section>

        {/* ── UNIFIED SEARCH PORTAL ── */}
        <VerifySearch
          onVerify={(certId, category, subCategory) => {
            handleVerify(certId, category, subCategory);
            setTimeout(() => {
              resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
            }, 200);
          }}
          isLoading={isLoading}
          defaultCertId={urlCertId}
          preselectedDbId={preselectedDbId}
        />

        {/* ── DATABASE CARDS ── */}
        <PublicDatabaseCards onDatabaseSelect={handleDatabaseSelect} />

        {/* ── RESULT SECTION ── */}
        <div ref={resultRef}>
          {(certificate || error || isLoading) && (
            <section className="max-w-2xl mx-auto px-4 sm:px-6 py-12">
              <div className="flex items-center justify-between mb-5">
                <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-outline">
                  Verification Result
                </p>
                {(certificate || error) && !isLoading && (
                  <button
                    onClick={handleClose}
                    className="text-xs text-outline hover:text-dark-green transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-sm">close</span>
                    Clear
                  </button>
                )}
              </div>
              <VerificationResult
                certificate={certificate}
                isLoading={isLoading}
                error={error}
                onClose={handleClose}
              />
            </section>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
