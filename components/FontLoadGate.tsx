"use client";

import { useState, useEffect } from "react";
import Image from "next/image";

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
      {/* Grid */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `linear-gradient(rgba(82,183,136,0.025) 1px,transparent 1px),
                            linear-gradient(90deg,rgba(82,183,136,0.025) 1px,transparent 1px)`,
          backgroundSize: "48px 48px",
        }}
      />

      {/* Ambient orbs */}
      <div className="absolute pointer-events-none" style={{ top: "-20%", left: "-15%", width: 600, height: 600, borderRadius: "50%", background: "radial-gradient(circle,rgba(34,197,94,0.09) 0%,transparent 65%)", animation: "orbFloat 12s ease-in-out infinite" }} />
      <div className="absolute pointer-events-none" style={{ bottom: "-20%", right: "-15%", width: 700, height: 700, borderRadius: "50%", background: "radial-gradient(circle,rgba(82,183,136,0.07) 0%,transparent 65%)", animation: "orbFloat 16s ease-in-out 3s infinite reverse" }} />

      {/* Shimmer sweep */}
      <div className="absolute inset-0 pointer-events-none" style={{ background: "linear-gradient(90deg,transparent,rgba(82,183,136,0.03),transparent)", animation: "shimmerSlide 2.5s ease infinite" }} />

      {/* Navbar skeleton */}
      <div
        className="relative z-10 flex items-center px-4 sm:px-6 flex-shrink-0"
        style={{ height: 60, background: "rgba(255,255,255,0.03)", borderBottom: "1px solid rgba(82,183,136,0.08)" }}
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

      {/* CENTER — Logo animation stage */}
      <div className="flex-1 flex flex-col items-center justify-center relative px-4">

        {/* Wide ambient glow behind logo */}
        <div
          className="absolute pointer-events-none"
          style={{
            width: 320, height: 320,
            borderRadius: "50%",
            background: "radial-gradient(circle,rgba(82,183,136,0.13) 0%,transparent 65%)",
            animation: "logoGlowPulse 2.4s ease-in-out infinite",
          }}
        />

        {/* Orbit ring 1 — clockwise dot */}
        <div
          className="absolute pointer-events-none"
          style={{ width: 196, height: 196, borderRadius: "50%", border: "1px dashed rgba(82,183,136,0.18)", animation: "orbitSpin 7s linear infinite" }}
        >
          <div style={{ position: "absolute", top: -5, left: "50%", transform: "translateX(-50%)", width: 10, height: 10, borderRadius: "50%", background: "linear-gradient(135deg,#52b788,#22c55e)", boxShadow: "0 0 10px rgba(82,183,136,0.9)" }} />
        </div>

        {/* Orbit ring 2 — counter-clockwise dot */}
        <div
          className="absolute pointer-events-none"
          style={{ width: 228, height: 228, borderRadius: "50%", border: "1px dashed rgba(82,183,136,0.09)", animation: "orbitSpin 11s linear infinite reverse" }}
        >
          <div style={{ position: "absolute", bottom: -4, left: "50%", transform: "translateX(-50%)", width: 7, height: 7, borderRadius: "50%", background: "#22c55e", boxShadow: "0 0 8px rgba(34,197,94,0.8)" }} />
        </div>

        {/* Orbit ring 3 — tiny fast dot */}
        <div
          className="absolute pointer-events-none"
          style={{ width: 158, height: 158, borderRadius: "50%", border: "1px solid rgba(82,183,136,0.05)", animation: "orbitSpin 4.5s linear infinite" }}
        >
          <div style={{ position: "absolute", top: "50%", right: -3, transform: "translateY(-50%)", width: 6, height: 6, borderRadius: "50%", background: "rgba(82,183,136,0.7)", boxShadow: "0 0 6px rgba(82,183,136,0.6)" }} />
        </div>

        {/* Logo */}
        <div
          style={{
            position: "relative",
            width: 120, height: 120,
            animation: "logoEntrance 0.9s cubic-bezier(0.34,1.56,0.64,1) both, logoBounce 3.2s ease-in-out 0.9s infinite",
            zIndex: 2,
          }}
        >
          {/* Glow ring on logo itself */}
          <div style={{ position: "absolute", inset: -10, borderRadius: "50%", background: "radial-gradient(circle,rgba(82,183,136,0.22) 0%,transparent 70%)", animation: "logoGlowPulse 1.8s ease-in-out infinite" }} />

          <Image
            src="/pharmacozyme-logo.png"
            alt="PharmacoZyme"
            width={120}
            height={120}
            style={{ borderRadius: "50%", position: "relative", zIndex: 1, filter: "drop-shadow(0 4px 20px rgba(82,183,136,0.35))" }}
            priority
          />

          {/* Scan line */}
          <div
            style={{
              position: "absolute", left: 8, right: 8, height: 2, borderRadius: 2,
              background: "linear-gradient(90deg,transparent,rgba(82,183,136,0.8),transparent)",
              animation: "scanLine 2.2s ease-in-out 0.6s infinite",
              zIndex: 3,
            }}
          />
        </div>

        {/* Brand name */}
        <div style={{ marginTop: 22, animation: "slideUpFade 0.6s ease 0.5s both", textAlign: "center" }}>
          <p className="text-white font-bold" style={{ fontFamily: "Fredoka, sans-serif", fontSize: 22, letterSpacing: "0.03em" }}>
            PharmacoZyme
          </p>
          <p style={{ color: "rgba(82,183,136,0.5)", fontFamily: "Poppins, sans-serif", fontSize: 10, letterSpacing: "0.2em", marginTop: 3 }}>
            CERTIFICATE VERIFICATION
          </p>
        </div>

        {/* Bouncing dots loader */}
        <div className="flex items-center gap-2" style={{ marginTop: 20, animation: "slideUpFade 0.6s ease 0.7s both" }}>
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              style={{
                width: 6, height: 6, borderRadius: "50%",
                background: "#52b788",
                animation: `dotBounce 1.2s ease-in-out ${i * 0.2}s infinite`,
              }}
            />
          ))}
        </div>
      </div>

      {/* Loading bar */}
      <div className="absolute bottom-0 left-0 right-0 h-[2px] overflow-hidden" style={{ background: "rgba(82,183,136,0.06)" }}>
        <div style={{ height: "100%", width: "45%", background: "linear-gradient(90deg,transparent,#52b788,#22c55e,transparent)", animation: "shimmerSlide 1.6s ease infinite" }} />
      </div>
    </div>
  );
}

export default function FontLoadGate({ children }: { children: React.ReactNode }) {
  const [hiding, setHiding] = useState(false);
  const [gone, setGone] = useState(false);

  useEffect(() => {
    const MIN_MS = 1400;
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
