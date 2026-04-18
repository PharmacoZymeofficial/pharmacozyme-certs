"use client";

import { useState } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import CategorySelector from "@/components/CategorySelector";
import VerifyForm from "@/components/VerifyForm";
import VerificationResult from "@/components/VerificationResult";
import TrustBadges from "@/components/TrustBadges";
import { Certificate } from "@/lib/types";

export default function VerifyPage() {
  const [selectedCategory, setSelectedCategory] = useState<"General" | "Official">("General");
  const [selectedSubCategory, setSelectedSubCategory] = useState("");
  const [certificate, setCertificate] = useState<Certificate | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleVerify = async (certId: string) => {
    setIsLoading(true);
    setError(null);
    setCertificate(null);

    try {
      const response = await fetch(`/api/verify?certId=${encodeURIComponent(certId)}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Verification failed");
      }

      setCertificate(data.certificate);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setCertificate(null);
    setError(null);
  };

  return (
    <div className="min-h-screen flex flex-col bg-surface">
      <Navbar />

      <main className="pt-20 sm:pt-28 pb-16 sm:pb-20 flex-1">
        {/* Hero Section */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-10 sm:mb-16">
          <div className="flex flex-col items-center sm:items-start text-center sm:text-left gap-3 sm:gap-4 max-w-2xl mx-auto sm:mx-0">
            <span className="inline-flex items-center px-3 sm:px-4 py-1.5 rounded-full bg-primary-container text-dark-green text-[9px] sm:text-[10px] font-bold uppercase tracking-widest">
              Education | Research | Treatment
            </span>
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-headline font-bold text-dark-green tracking-tight leading-[1.1]">
              Verify Certificate <br className="hidden sm:block" />
              <span className="text-vivid-green">Authenticity</span>
            </h1>
            <p className="text-sm sm:text-base md:text-lg text-on-surface-variant max-w-lg leading-relaxed px-4 sm:px-0">
              Ensure the legitimacy of clinical credentials and professional achievements through our tamper-proof verification ledger.
            </p>
          </div>
        </section>

        {/* Verification Workflow */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-12">
            {/* Form Side */}
            <div className="lg:col-span-7 space-y-6 lg:space-y-8">
              {/* Step 1: Category Selector */}
              <div className="bg-surface-container-lowest rounded-xl p-5 sm:p-6 lg:p-8 border border-surface-container">
                <div className="flex items-center gap-3 sm:gap-4 mb-6 sm:mb-8">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-vivid-green flex items-center justify-center text-white font-bold text-xs sm:text-sm">1</div>
                  <h2 className="text-lg sm:text-xl font-headline font-bold text-dark-green">Category Selection</h2>
                </div>
                <CategorySelector
                  selectedCategory={selectedCategory}
                  selectedSubCategory={selectedSubCategory}
                  onCategoryChange={setSelectedCategory}
                  onSubCategoryChange={setSelectedSubCategory}
                />
              </div>

              {/* Step 2: Input Area */}
              <div className="bg-surface-container-lowest rounded-xl p-5 sm:p-6 lg:p-8 border border-surface-container">
                <div className="flex items-center gap-3 sm:gap-4 mb-6 sm:mb-8">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-vivid-green flex items-center justify-center text-white font-bold text-xs sm:text-sm">2</div>
                  <h2 className="text-lg sm:text-xl font-headline font-bold text-dark-green">Enter Certificate Details</h2>
                </div>
                <VerifyForm onVerify={handleVerify} isLoading={isLoading} />
              </div>

              {/* Trust Badges - Hidden on mobile, shown on tablet+ */}
              <div className="hidden sm:block">
                <TrustBadges />
              </div>
            </div>

            {/* Result Side */}
            <div className="lg:col-span-5">
              <div className="lg:sticky lg:top-24">
                <h3 className="text-[10px] font-bold uppercase tracking-[0.3em] text-outline mb-4 sm:mb-6 text-center lg:text-left">
                  Verification Preview
                </h3>
                
                {certificate || error || isLoading ? (
                  <VerificationResult
                    certificate={certificate}
                    isLoading={isLoading}
                    error={error}
                    onClose={handleClose}
                  />
                ) : (
                  /* Empty State - Preview Card */
                  <div className="bg-surface-container-lowest rounded-xl overflow-hidden border border-outline-variant/20">
                    <div className="relative h-36 sm:h-44 lg:h-48 bg-dark-green overflow-hidden">
                      <div className="absolute inset-0 p-4 sm:p-6 lg:p-8 flex flex-col justify-end">
                        <div className="text-primary-fixed font-headline font-semibold text-base sm:text-lg mb-1">MED-Q Excellence</div>
                        <div className="text-white/60 text-[9px] sm:text-[10px] uppercase tracking-widest font-medium">Digital Credentials Division</div>
                      </div>
                      <div className="absolute top-4 sm:top-6 right-4 sm:right-6 px-3 sm:px-4 py-1.5 sm:py-2 bg-white/10 backdrop-blur-md rounded-full border border-white/20">
                        <span className="text-white text-[9px] sm:text-[10px] font-bold tracking-widest uppercase">Valid ID</span>
                      </div>
                    </div>
                    <div className="p-4 sm:p-6 lg:p-8 space-y-4 sm:space-y-6">
                      <div className="flex justify-between items-start">
                        <div>
                          <label className="block text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-outline mb-1">Holder Name</label>
                          <div className="text-base sm:text-xl font-headline font-bold text-dark-green">Dr. Julianne V. Thorne</div>
                        </div>
                        <div className="w-12 h-12 sm:w-14 sm:h-14 lg:w-16 lg:h-16 rounded-xl bg-surface-container-low flex items-center justify-center border border-surface-variant">
                          <span className="material-symbols-outlined text-vivid-green text-xl sm:text-2xl lg:text-3xl">qr_code_2</span>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4 sm:gap-8">
                        <div>
                          <label className="block text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-outline mb-1">Issue Date</label>
                          <div className="text-xs sm:text-sm font-semibold text-dark-green">October 24, 2024</div>
                        </div>
                        <div>
                          <label className="block text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-outline mb-1">Type</label>
                          <div className="text-xs sm:text-sm font-semibold text-dark-green">Advanced Clinical Module</div>
                        </div>
                      </div>
                      <div className="pt-4 sm:pt-6 border-t border-surface-container">
                        <div className="inline-flex items-center gap-2 px-4 sm:px-6 py-2 sm:py-3 rounded-xl bg-green-50 border border-green-200">
                          <span className="material-symbols-outlined text-vivid-green text-base sm:text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>
                          <span className="text-vivid-green font-bold text-[9px] sm:text-[10px] tracking-[0.2em] uppercase">VERIFIED ✓</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Side Note */}
                <div className="mt-4 sm:mt-6 lg:mt-8 p-4 sm:p-5 lg:p-6 rounded-xl bg-primary-container/30 border-l-4 border-vivid-green">
                  <p className="text-[10px] sm:text-[11px] text-on-surface-variant leading-relaxed italic">
                    "This verification record is linked to our secure blockchain hash. Any unauthorized duplication or alteration is detectable by our system."
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Trust Badges - Mobile Only */}
          <div className="sm:hidden mt-6">
            <TrustBadges />
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
