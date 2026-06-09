"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { ClaimContent } from "./ClaimContent";

function ClaimWithSearchParams() {
  const searchParams = useSearchParams();
  const certId = searchParams.get("id") || searchParams.get("certId") || "";
  return <ClaimContent certId={certId} />;
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
      <ClaimWithSearchParams />
    </Suspense>
  );
}
