"use client";

import { useState, useEffect } from "react";

function SkeletonPulse({ w, h, className = "", style = {} }: { w?: string | number; h?: string | number; className?: string; style?: React.CSSProperties }) {
  return (
    <div
      className={`animate-pulse rounded-xl ${className}`}
      style={{ width: w, height: h, background: "rgba(82,183,136,0.1)", ...style }}
    />
  );
}

function LoadingSkeleton() {
  return (
    <div
      className="fixed inset-0 z-[9998] flex flex-col overflow-hidden"
      style={{ background: "linear-gradient(160deg,#060f08 0%,#081c15 55%,#062106 100%)" }}
    >
      {/* Subtle grid */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `linear-gradient(rgba(82,183,136,0.025) 1px,transparent 1px),
                            linear-gradient(90deg,rgba(82,183,136,0.025) 1px,transparent 1px)`,
          backgroundSize: "48px 48px",
        }}
      />

      {/* Ambient orbs */}
      <div
        className="absolute pointer-events-none"
        style={{
          top: "-15%", left: "-10%",
          width: 500, height: 500,
          borderRadius: "50%",
          background: "radial-gradient(circle,rgba(34,197,94,0.07) 0%,transparent 65%)",
        }}
      />
      <div
        className="absolute pointer-events-none"
        style={{
          bottom: "-15%", right: "-10%",
          width: 600, height: 600,
          borderRadius: "50%",
          background: "radial-gradient(circle,rgba(82,183,136,0.05) 0%,transparent 65%)",
        }}
      />

      {/* Shimmer sweep */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: "linear-gradient(90deg,transparent,rgba(82,183,136,0.035),transparent)",
          animation: "shimmerSlide 2.2s ease infinite",
        }}
      />

      {/* Navbar skeleton */}
      <div
        className="relative z-10 flex items-center px-4 sm:px-6 flex-shrink-0"
        style={{
          height: 60,
          background: "rgba(255,255,255,0.03)",
          borderBottom: "1px solid rgba(82,183,136,0.08)",
        }}
      >
        <div className="flex items-center gap-3">
          <SkeletonPulse w={36} h={36} style={{ borderRadius: 10 }} />
          <SkeletonPulse w={130} h={18} style={{ borderRadius: 8 }} />
        </div>
        <div className="ml-auto flex items-center gap-5">
          <SkeletonPulse w={96} h={14} />
          <SkeletonPulse w={64} h={14} style={{ background: "rgba(82,183,136,0.07)" }} />
        </div>
      </div>

      {/* Hero area */}
      <div className="flex-1 flex flex-col items-center justify-end pb-10 relative px-4">
        {/* Scroll indicator skeleton at bottom */}
        <div className="flex flex-col items-center gap-2">
          <SkeletonPulse w={52} h={10} style={{ borderRadius: 6 }} />
          <SkeletonPulse w={32} h={32} style={{ borderRadius: "50%", border: "1px solid rgba(82,183,136,0.15)" }} />
        </div>
      </div>

      {/* Loading bar */}
      <div
        className="absolute bottom-0 left-0 right-0 h-[2px] overflow-hidden"
        style={{ background: "rgba(82,183,136,0.08)" }}
      >
        <div
          style={{
            height: "100%",
            width: "40%",
            background: "linear-gradient(90deg,transparent,#52b788,transparent)",
            animation: "shimmerSlide 1.6s ease infinite",
          }}
        />
      </div>

      {/* Brand watermark — centered, subtle */}
      <div
        className="absolute inset-0 flex items-center justify-center pointer-events-none"
        style={{ opacity: 0.08 }}
      >
        <p
          className="text-white text-6xl sm:text-8xl font-bold select-none"
          style={{ fontFamily: "Fredoka, sans-serif", letterSpacing: "-0.02em" }}
        >
          PharmacoZyme
        </p>
      </div>
    </div>
  );
}

export default function FontLoadGate({ children }: { children: React.ReactNode }) {
  const [hiding, setHiding] = useState(false);
  const [gone, setGone] = useState(false);

  useEffect(() => {
    const MIN_MS = 700;
    const t0 = Date.now();

    (typeof document !== "undefined" ? document.fonts.ready : Promise.resolve()).then(() => {
      const wait = Math.max(0, MIN_MS - (Date.now() - t0));
      return new Promise<void>((r) => setTimeout(r, wait));
    }).then(() => {
      setHiding(true);
      setTimeout(() => setGone(true), 480);
    });
  }, []);

  return (
    <>
      {children}
      {!gone && (
        <div
          style={{
            opacity: hiding ? 0 : 1,
            transition: "opacity 0.48s cubic-bezier(0.16,1,0.3,1)",
            pointerEvents: hiding ? "none" : "auto",
          }}
        >
          <LoadingSkeleton />
        </div>
      )}
    </>
  );
}
