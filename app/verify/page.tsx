"use client";

import { useState, useEffect, Suspense } from "react";
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
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mt-12">
        <div className="lg:col-span-7 space-y-6">
          <div className="h-40 bg-gray-100 rounded-2xl" />
          <div className="h-32 bg-gray-100 rounded-2xl" />
        </div>
        <div className="lg:col-span-5">
          <div className="h-80 bg-gray-100 rounded-2xl" />
        </div>
      </div>
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
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred.");
      sfx.error();
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-verify if certId is in URL
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

      <main className="flex-1 pt-0 pb-16 sm:pb-20">
        {/* Video Hero Section — full viewport, no overlay content */}
        <section className="relative w-full overflow-hidden" style={{ height: "100svh" }}>
          <video
            className="hidden sm:block absolute inset-0 w-full h-full object-cover"
            src="/videos/hero-pc.mp4"
            autoPlay
            loop
            muted
            playsInline
          />
          <video
            className="sm:hidden absolute inset-0 w-full h-full object-cover"
            src="/videos/hero-mobile.mp4"
            autoPlay
            loop
            muted
            playsInline
          />
          {/* Dark overlay */}
          <div className="absolute inset-0 bg-black/40 pointer-events-none" />
          {/* Subtle bottom fade into page */}
          <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-surface to-transparent pointer-events-none" />
        </section>

        {/* Verification Workflow */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8 sm:mt-12">
          {/* Section label */}
          <div className="text-center mb-8 sm:mb-10">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-vivid-green/10 border border-vivid-green/20 mb-4">
              <span className="material-symbols-outlined text-vivid-green text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>shield</span>
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-vivid-green">Secure Verification Portal</span>
            </div>
            <h1 className="font-headline font-bold text-2xl sm:text-3xl lg:text-4xl text-dark-green mb-2">
              Verify Your Certificate
            </h1>
            <p className="text-sm text-on-surface-variant max-w-md mx-auto">
              Enter a certificate ID to instantly verify its authenticity against our tamper-proof blockchain records.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-12">
            {/* Form Side */}
            <div className="lg:col-span-7 space-y-5 lg:space-y-6">
              {/* Input Card */}
              <div className="bg-white rounded-2xl p-5 sm:p-7 lg:p-8 border border-outline-variant/20 shadow-[0_4px_24px_rgba(0,0,0,0.06)]">
                <div className="flex items-center gap-3 sm:gap-4 mb-6">
                  <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-gradient-to-br from-vivid-green to-dark-green flex items-center justify-center text-white shadow-sm">
                    <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>
                  </div>
                  <div>
                    <h2 className="text-base sm:text-lg font-headline font-bold text-dark-green">Enter Certificate ID</h2>
                    <p className="text-[11px] text-on-surface-variant">Type or paste the certificate ID number</p>
                  </div>
                </div>
                <VerifyForm onVerify={handleVerify} isLoading={isLoading} defaultValue={urlCertId} />
              </div>

              <div className="hidden sm:block">
                <TrustBadges />
              </div>
            </div>

            {/* Result Side */}
            <div className="lg:col-span-5">
              <div className="lg:sticky lg:top-24">
                <h3 className="text-[10px] font-bold uppercase tracking-[0.3em] text-outline mb-4 sm:mb-5 text-center lg:text-left">
                  Verification Result
                </h3>

                {certificate || error || isLoading ? (
                  <VerificationResult
                    certificate={certificate}
                    isLoading={isLoading}
                    error={error}
                    onClose={handleClose}
                  />
                ) : (
                  <EmptyResultCard />
                )}
              </div>
            </div>
          </div>

          <div className="sm:hidden mt-5">
            <TrustBadges />
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}

function EmptyResultCard() {
  return (
    <div className="bg-white rounded-2xl overflow-hidden border border-outline-variant/15 shadow-[0_4px_24px_rgba(0,0,0,0.06)]">
      <div className="relative h-44 sm:h-52 overflow-hidden" style={{ background: "linear-gradient(135deg, #0f2d1f 0%, #1b4332 40%, #2d6a4f 100%)" }}>
        <div className="absolute inset-0 opacity-[0.06]" style={{
          backgroundImage: "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)",
          backgroundSize: "28px 28px"
        }} />
        <div className="absolute -bottom-8 -left-8 w-48 h-48 rounded-full opacity-20" style={{ background: "radial-gradient(circle, #52b788, transparent 70%)" }} />
        <div className="absolute inset-0 p-5 sm:p-7 flex flex-col justify-end">
          <div className="text-white/30 font-headline font-bold text-xl sm:text-2xl mb-1">— — —</div>
          <div className="text-white/30 text-[9px] uppercase tracking-[0.2em] font-medium">PharmacoZyme Certificate</div>
        </div>
        <div className="absolute top-4 sm:top-5 right-4 sm:right-5 px-3 py-1.5 bg-white/10 backdrop-blur-md rounded-full border border-white/15">
          <span className="text-white/50 text-[9px] font-bold tracking-widest uppercase">Awaiting ID</span>
        </div>
        <div className="absolute top-1/2 right-16 -translate-y-1/2 opacity-[0.04]">
          <span className="material-symbols-outlined text-white" style={{ fontSize: "96px", fontVariationSettings: "'FILL' 1" }}>verified</span>
        </div>
      </div>
      <div className="p-5 sm:p-7 space-y-4">
        <div className="space-y-2">
          {[70, 45, 80].map((w, i) => (
            <div key={i} className="h-3.5 bg-surface-container/70 rounded-full" style={{ width: `${w}%` }} />
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          {[1, 2].map(i => (
            <div key={i} className="h-10 bg-surface-container/50 rounded-xl" />
          ))}
        </div>
        <div className="pt-2 border-t border-surface-container">
          <div className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-surface-container/60 border border-outline-variant/15">
            <span className="material-symbols-outlined text-outline text-base">pending</span>
            <span className="text-outline font-bold text-[9px] tracking-[0.2em] uppercase">Enter ID to Verify</span>
          </div>
        </div>
      </div>
    </div>
  );
}
