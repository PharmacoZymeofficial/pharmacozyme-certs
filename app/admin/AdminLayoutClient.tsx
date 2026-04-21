"use client";

import { ReactNode, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import AdminSidebar from "@/components/AdminSidebar";
import AdminMobileNav from "@/components/AdminMobileNav";
import { ToastProvider } from "@/components/Toast";
import { ConfirmProvider } from "@/components/ConfirmModal";
import { AuthProvider, useAdminUser } from "@/lib/auth-context";

function RevokedScreen({ reason }: { reason: "rejected" | "deleted" | null }) {
  const router = useRouter();
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    const interval = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          router.push("/admin/login");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [router]);

  const circumference = 2 * Math.PI * 20;
  const dashOffset = circumference * (1 - countdown / 5);

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#060f08] overflow-hidden">
      {/* Ambient glow */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-[600px] h-[600px] rounded-full opacity-10"
          style={{ background: "radial-gradient(circle, #ef4444 0%, transparent 70%)" }} />
      </div>

      {/* Grid overlay */}
      <div className="absolute inset-0 opacity-[0.03]" style={{
        backgroundImage: "linear-gradient(rgba(255,255,255,0.8) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.8) 1px, transparent 1px)",
        backgroundSize: "40px 40px"
      }} />

      <div className="relative text-center px-8 max-w-md mx-auto">
        {/* Lock icon with pulsing ring */}
        <div className="relative w-24 h-24 mx-auto mb-8">
          <div className="absolute inset-0 rounded-full border-2 border-red-500/20 animate-ping" />
          <div className="absolute inset-0 rounded-full border border-red-700/30" />
          <div className="w-24 h-24 rounded-full bg-red-950/40 border border-red-700/40 flex items-center justify-center">
            <span className="material-symbols-outlined text-5xl text-red-400"
              style={{ fontVariationSettings: "'FILL' 1" }}>
              lock
            </span>
          </div>
        </div>

        <div className="mb-2 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-900/20 border border-red-700/30">
          <div className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
          <span className="text-red-400 text-[10px] font-bold uppercase tracking-widest">Access Terminated</span>
        </div>

        <h1 className="text-3xl font-bold text-white mt-4 mb-3">Access Revoked</h1>

        <p className="text-[#52b788]/60 text-sm mb-8 leading-relaxed">
          {reason === "deleted"
            ? "Your admin account has been removed by the super administrator."
            : "Your admin access has been revoked by the super administrator."}
          {" "}Contact them to request access again.
        </p>

        {/* Countdown ring */}
        <div className="inline-flex flex-col items-center gap-3">
          <div className="relative w-16 h-16">
            <svg className="w-16 h-16 -rotate-90" viewBox="0 0 48 48">
              <circle cx="24" cy="24" r="20" fill="none" stroke="#1a0505" strokeWidth="3" />
              <circle
                cx="24" cy="24" r="20" fill="none"
                stroke="#ef4444" strokeWidth="3"
                strokeDasharray={circumference}
                strokeDashoffset={dashOffset}
                strokeLinecap="round"
                style={{ transition: "stroke-dashoffset 0.9s linear" }}
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-xl font-bold text-red-400">
              {countdown}
            </span>
          </div>
          <span className="text-[#52b788]/50 text-xs font-medium">Redirecting to login...</span>
        </div>
      </div>
    </div>
  );
}

function AdminLayoutInner({ children }: { children: ReactNode }) {
  const { revoked, revokedReason } = useAdminUser();

  if (revoked) {
    return <RevokedScreen reason={revokedReason} />;
  }

  return (
    <div className="min-h-screen bg-surface-container-low">
      <AdminSidebar />
      <AdminMobileNav />
      <main className="lg:ml-64 pt-16 lg:pt-0 pb-24 lg:pb-0">
        {children}
      </main>
    </div>
  );
}

export default function AdminLayoutClient({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isLoginPage = pathname === "/admin/login";

  if (isLoginPage) {
    return <>{children}</>;
  }

  return (
    <AuthProvider>
      <ToastProvider>
        <ConfirmProvider>
          <AdminLayoutInner>{children}</AdminLayoutInner>
        </ConfirmProvider>
      </ToastProvider>
    </AuthProvider>
  );
}
