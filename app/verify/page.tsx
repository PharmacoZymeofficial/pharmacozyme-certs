"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import VerifyForm from "@/components/VerifyForm";
import VerificationResult from "@/components/VerificationResult";
import TrustBadges from "@/components/TrustBadges";
import { Certificate } from "@/lib/types";
import { sfx } from "@/lib/sfx";

export default function VerifyPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex flex-col bg-surface">
        <Navbar />
        <main className="flex-1 flex items-center justify-center">
          <VerifyPageSkeleton />
        </main>
        <Footer />
      </div>
    }>
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

  const resultRef = useRef<HTMLDivElement>(null);

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

      // Scroll to result
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

  return (
    <div className="min-h-screen flex flex-col bg-surface">
      <Navbar />

      <main className="flex-1 pb-20">
        {/* ── HERO: Full viewport with form overlaid ── */}
        <section className="relative w-full overflow-hidden" style={{ minHeight: "100svh" }}>
          {/* Video background */}
          <video
            className="hidden sm:block absolute inset-0 w-full h-full object-cover"
            src="/videos/hero-pc.mp4"
            autoPlay loop muted playsInline
          />
          <video
            className="sm:hidden absolute inset-0 w-full h-full object-cover"
            src="/videos/hero-mobile.mp4"
            autoPlay loop muted playsInline
          />

          {/* Dark gradient overlay */}
          <div className="absolute inset-0"
            style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.35) 0%, rgba(6,15,8,0.75) 60%, rgba(6,15,8,0.95) 100%)" }} />

          {/* Subtle grid */}
          <div className="absolute inset-0 opacity-[0.025]" style={{
            backgroundImage: "linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)",
            backgroundSize: "40px 40px"
          }} />

          {/* Hero content */}
          <div className="relative z-10 flex flex-col items-center justify-center min-h-[100svh] px-4 pb-8 pt-24">

            {/* Badge */}
            <div className="flex items-center gap-2 px-4 py-1.5 rounded-full mb-6"
              style={{ background: "rgba(82,183,136,0.12)", border: "1px solid rgba(82,183,136,0.25)", backdropFilter: "blur(8px)" }}>
              <span className="material-symbols-outlined text-[#52b788] text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>shield</span>
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#52b788]">Secure Verification Portal</span>
            </div>

            {/* Heading */}
            <h1 className="font-bold text-3xl sm:text-5xl lg:text-6xl text-white text-center mb-3 leading-tight"
              style={{ textShadow: "0 2px 20px rgba(0,0,0,0.5)" }}>
              Verify Your
              <br />
              <span style={{ background: "linear-gradient(90deg, #52b788 0%, #95d5b2 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                Certificate
              </span>
            </h1>
            <p className="text-sm sm:text-base text-white/55 text-center max-w-md mb-10">
              Instantly authenticate any PharmacoZyme certificate against our tamper-proof records.
            </p>

            {/* Glassmorphism form card */}
            <div className="w-full max-w-xl rounded-2xl sm:rounded-3xl overflow-hidden"
              style={{
                background: "rgba(10,26,16,0.75)",
                backdropFilter: "blur(24px)",
                border: "1px solid rgba(82,183,136,0.2)",
                boxShadow: "0 8px 40px rgba(0,0,0,0.4), inset 0 1px 0 rgba(82,183,136,0.1)"
              }}>

              <div className="p-5 sm:p-7">
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                    style={{ background: "linear-gradient(135deg, #52b788, #1b4332)" }}>
                    <span className="material-symbols-outlined text-white text-base" style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>
                  </div>
                  <div>
                    <p className="text-white font-bold text-sm">Enter Certificate ID</p>
                    <p className="text-[11px] text-[#52b788]/50">Type or paste the ID to begin verification</p>
                  </div>
                </div>

                {/* Inject verify form here — the form renders on the dark glass card */}
                <VerifyForm onVerify={handleVerify} isLoading={isLoading} defaultValue={urlCertId} dark />
              </div>
            </div>

            {/* Trust badges below form */}
            <div className="mt-8 w-full max-w-xl opacity-70">
              <TrustBadges dark />
            </div>

            {/* Scroll cue */}
            {(certificate || error) && (
              <button
                onClick={() => resultRef.current?.scrollIntoView({ behavior: "smooth" })}
                className="mt-8 flex flex-col items-center gap-1.5 text-[#52b788]/60 hover:text-[#52b788] transition-colors cursor-pointer"
              >
                <span className="text-xs font-medium uppercase tracking-widest">View Result</span>
                <span className="material-symbols-outlined text-lg animate-bounce">expand_more</span>
              </button>
            )}
          </div>
        </section>

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
