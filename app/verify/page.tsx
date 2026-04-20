"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import VerifyForm from "@/components/VerifyForm";
import VerificationResult from "@/components/VerificationResult";
import TrustBadges from "@/components/TrustBadges";
import { Certificate } from "@/lib/types";

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

  const handleVerify = async (certId: string) => {
    setIsLoading(true);
    setError(null);
    setCertificate(null);

    try {
      const response = await fetch(`/api/verify?certId=${encodeURIComponent(certId)}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Certificate not found. Please check the ID and try again.");
      }

      setCertificate(data.certificate);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred.");
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
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-10 sm:mt-14">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-12">
            {/* Form Side */}
            <div className="lg:col-span-7 space-y-6 lg:space-y-8">
              {/* Step 1: Input */}
              <div className="bg-surface-container-lowest rounded-2xl p-5 sm:p-6 lg:p-8 border border-surface-container shadow-sm">
                <div className="flex items-center gap-3 sm:gap-4 mb-6 sm:mb-8">
                  <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-vivid-green flex items-center justify-center text-white font-bold text-sm">
                    <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>
                  </div>
                  <div>
                    <h2 className="text-lg sm:text-xl font-headline font-bold text-dark-green">Enter Certificate ID</h2>
                    <p className="text-xs text-on-surface-variant">Type or paste the certificate ID number</p>
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
                <h3 className="text-[10px] font-bold uppercase tracking-[0.3em] text-outline mb-4 sm:mb-6 text-center lg:text-left">
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

                <div className="mt-4 sm:mt-6 p-4 sm:p-5 rounded-xl bg-primary-container/30 border-l-4 border-vivid-green">
                  <p className="text-[10px] sm:text-[11px] text-on-surface-variant leading-relaxed italic">
                    "This verification record is linked to our secure blockchain hash. Any unauthorized duplication or alteration is detectable by our system."
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="sm:hidden mt-6">
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
    <div className="bg-surface-container-lowest rounded-2xl overflow-hidden border border-outline-variant/20 shadow-sm">
      <div className="relative h-36 sm:h-44 bg-dark-green overflow-hidden flex items-end p-6">
        <div
          className="absolute inset-0 opacity-10"
          style={{ backgroundImage: "radial-gradient(circle at 70% 50%, #52b788 0%, transparent 60%)" }}
        />
        <div className="relative z-10">
          <div className="text-primary-fixed font-headline font-semibold text-base sm:text-lg mb-1">MED-Q Excellence</div>
          <div className="text-white/60 text-[9px] sm:text-[10px] uppercase tracking-widest font-medium">Digital Credentials</div>
        </div>
        <div className="absolute top-4 right-4 px-3 py-1.5 bg-white/10 backdrop-blur-md rounded-full border border-white/20">
          <span className="text-white text-[9px] font-bold tracking-widest uppercase">Awaiting ID</span>
        </div>
      </div>
      <div className="p-5 sm:p-6 space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-4 bg-surface-container rounded-lg" style={{ width: `${[70, 50, 85][i]}%` }} />
        ))}
        <div className="pt-3 border-t border-surface-container">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-surface-container border border-outline-variant/20">
            <span className="material-symbols-outlined text-outline text-base">pending</span>
            <span className="text-outline font-bold text-[9px] tracking-[0.2em] uppercase">Enter ID to Verify</span>
          </div>
        </div>
      </div>
    </div>
  );
}
