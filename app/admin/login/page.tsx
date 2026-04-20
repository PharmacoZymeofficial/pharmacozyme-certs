"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";

export default function AdminLoginPage() {
  return (
    <Suspense fallback={<LoginSkeleton />}>
      <LoginForm />
    </Suspense>
  );
}

function LoginSkeleton() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0c1f14]">
      <div className="w-10 h-10 rounded-full border-4 border-[#52b788] border-t-transparent animate-spin" />
    </div>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = searchParams.get("from") || "/admin/databases";

  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) return;

    setIsLoading(true);
    setError("");

    try {
      const res = await fetch("/api/admin/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (res.ok) {
        router.push(from);
        router.refresh();
      } else {
        const data = await res.json();
        setError(data.error || "Invalid password");
        setPassword("");
      }
    } catch {
      setError("Connection error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#0a1a10]">
      {/* Top bar */}
      <div className="px-6 py-4 flex items-center gap-3">
        <Image src="/pharmacozyme-logo.png" alt="PharmacoZyme" width={32} height={32} className="opacity-90" />
        <span className="text-[#52b788] font-bold text-sm tracking-widest uppercase">PharmacoZyme</span>
      </div>

      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm">
          {/* Icon */}
          <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-[#1b4332] border border-[#2d6a4f] flex items-center justify-center shadow-lg shadow-black/30">
            <span className="material-symbols-outlined text-3xl text-[#52b788]" style={{ fontVariationSettings: "'FILL' 1" }}>
              admin_panel_settings
            </span>
          </div>

          <h1 className="text-2xl font-bold text-white text-center mb-1">Admin Access</h1>
          <p className="text-sm text-[#52b788]/70 text-center mb-8">Enter your admin password to continue</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Admin password"
                autoFocus
                className="w-full h-12 px-4 pr-12 rounded-xl bg-[#1b4332]/60 border border-[#2d6a4f] text-white placeholder:text-[#52b788]/40 focus:outline-none focus:border-[#52b788] transition-colors text-sm"
                disabled={isLoading}
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#52b788]/60 hover:text-[#52b788]"
              >
                <span className="material-symbols-outlined text-lg">
                  {showPassword ? "visibility_off" : "visibility"}
                </span>
              </button>
            </div>

            {error && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-900/30 border border-red-700/40">
                <span className="material-symbols-outlined text-red-400 text-sm">error</span>
                <p className="text-red-400 text-xs">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading || !password.trim()}
              className="w-full h-12 rounded-xl font-bold text-sm bg-[#52b788] text-[#0a1a10] hover:bg-[#40a070] disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <span className="w-4 h-4 rounded-full border-2 border-[#0a1a10]/30 border-t-[#0a1a10] animate-spin" />
                  Verifying...
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-sm">login</span>
                  Sign In
                </>
              )}
            </button>
          </form>

          <p className="text-center text-xs text-[#52b788]/40 mt-8">
            PharmacoZyme Certificate System · Admin Portal
          </p>
        </div>
      </div>
    </div>
  );
}
