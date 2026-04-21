"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { app } from "@/lib/firebase";
import { db } from "@/lib/firebase";

const SUPER_ADMIN_EMAIL = "pharmacozymeofficial@gmail.com";

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

  const [mode, setMode] = useState<"signin" | "register">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleFirebaseError = (code: string) => {
    switch (code) {
      case "auth/user-not-found":
      case "auth/wrong-password":
      case "auth/invalid-credential":
        return "Invalid email or password.";
      case "auth/email-already-in-use":
        return "Account already exists. Sign in instead.";
      case "auth/weak-password":
        return "Password must be at least 6 characters.";
      case "auth/invalid-email":
        return "Invalid email address.";
      case "auth/too-many-requests":
        return "Too many attempts. Try again later.";
      default:
        return "Authentication error. Please try again.";
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) return;
    setIsLoading(true);
    setError("");
    setInfo("");

    try {
      const auth = getAuth(app!);
      const credential = await signInWithEmailAndPassword(auth, email, password);
      const user = credential.user;

      // Check admin approval status in Firestore
      const adminDoc = await getDoc(doc(db, "admins", user.uid));

      if (!adminDoc.exists()) {
        // Auto-approve super admin, require approval for others
        if (user.email === SUPER_ADMIN_EMAIL) {
          await setDoc(doc(db, "admins", user.uid), {
            email: user.email,
            displayName: user.displayName || user.email?.split("@")[0] || "Admin",
            role: "super_admin",
            status: "approved",
            createdAt: new Date().toISOString(),
          });
        } else {
          await setDoc(doc(db, "admins", user.uid), {
            email: user.email,
            displayName: user.displayName || user.email?.split("@")[0] || "Admin",
            role: "admin",
            status: "pending",
            createdAt: new Date().toISOString(),
          });
          await auth.signOut();
          setInfo("Your account is awaiting super admin approval.");
          setIsLoading(false);
          return;
        }
      } else {
        const adminData = adminDoc.data();
        if (adminData.status === "pending") {
          await auth.signOut();
          setInfo("Your account is awaiting super admin approval.");
          setIsLoading(false);
          return;
        }
        if (adminData.status === "rejected") {
          await auth.signOut();
          setError("Your access request was rejected. Contact the super admin.");
          setIsLoading(false);
          return;
        }
      }

      // Approved — set session cookie
      const role = user.email === SUPER_ADMIN_EMAIL ? "super_admin" : "admin";
      const adminData = (await getDoc(doc(db, "admins", user.uid))).data();
      const res = await fetch("/api/admin/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          uid: user.uid,
          email: user.email,
          displayName: adminData?.displayName || user.displayName || user.email?.split("@")[0],
          role,
        }),
      });

      if (res.ok) {
        router.push(from);
        router.refresh();
      } else {
        setError("Session error. Please try again.");
      }
    } catch (err: any) {
      setError(handleFirebaseError(err.code || ""));
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim() || !displayName.trim()) return;
    setIsLoading(true);
    setError("");
    setInfo("");

    try {
      const auth = getAuth(app!);
      const credential = await createUserWithEmailAndPassword(auth, email, password);
      const user = credential.user;

      await updateProfile(user, { displayName: displayName.trim() });

      const isSuperAdmin = user.email === SUPER_ADMIN_EMAIL;
      await setDoc(doc(db, "admins", user.uid), {
        email: user.email,
        displayName: displayName.trim(),
        role: isSuperAdmin ? "super_admin" : "admin",
        status: isSuperAdmin ? "approved" : "pending",
        createdAt: new Date().toISOString(),
      });

      if (isSuperAdmin) {
        const res = await fetch("/api/admin/auth", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            uid: user.uid,
            email: user.email,
            displayName: displayName.trim(),
            role: "super_admin",
          }),
        });
        if (res.ok) {
          router.push(from);
          router.refresh();
        }
      } else {
        await auth.signOut();
        setInfo("Account created! Awaiting super admin approval before you can log in.");
        setMode("signin");
        setPassword("");
      }
    } catch (err: any) {
      setError(handleFirebaseError(err.code || ""));
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
          <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-[#1b4332] border border-[#2d6a4f] flex items-center justify-center shadow-lg shadow-black/30">
            <span className="material-symbols-outlined text-3xl text-[#52b788]" style={{ fontVariationSettings: "'FILL' 1" }}>
              admin_panel_settings
            </span>
          </div>

          <h1 className="text-2xl font-bold text-white text-center mb-1">Admin Access</h1>
          <p className="text-sm text-[#52b788]/70 text-center mb-6">
            {mode === "signin" ? "Sign in to the admin portal" : "Request access to the admin portal"}
          </p>

          {/* Mode toggle */}
          <div className="flex rounded-xl overflow-hidden border border-[#2d6a4f] mb-6">
            <button
              type="button"
              onClick={() => { setMode("signin"); setError(""); setInfo(""); }}
              className={`flex-1 py-2.5 text-sm font-medium transition-colors ${mode === "signin" ? "bg-[#52b788] text-[#0a1a10]" : "text-[#52b788]/70 hover:text-[#52b788]"}`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => { setMode("register"); setError(""); setInfo(""); }}
              className={`flex-1 py-2.5 text-sm font-medium transition-colors ${mode === "register" ? "bg-[#52b788] text-[#0a1a10]" : "text-[#52b788]/70 hover:text-[#52b788]"}`}
            >
              Request Access
            </button>
          </div>

          <form onSubmit={mode === "signin" ? handleSignIn : handleRegister} className="space-y-3">
            {mode === "register" && (
              <input
                type="text"
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                placeholder="Full name"
                required
                className="w-full h-12 px-4 rounded-xl bg-[#1b4332]/60 border border-[#2d6a4f] text-white placeholder:text-[#52b788]/40 focus:outline-none focus:border-[#52b788] transition-colors text-sm"
                disabled={isLoading}
              />
            )}

            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="Email address"
              required
              autoFocus
              className="w-full h-12 px-4 rounded-xl bg-[#1b4332]/60 border border-[#2d6a4f] text-white placeholder:text-[#52b788]/40 focus:outline-none focus:border-[#52b788] transition-colors text-sm"
              disabled={isLoading}
            />

            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder={mode === "register" ? "Create password (min. 6 chars)" : "Password"}
                required
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

            {info && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-900/30 border border-amber-700/40">
                <span className="material-symbols-outlined text-amber-400 text-sm">info</span>
                <p className="text-amber-300 text-xs">{info}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading || !email.trim() || !password.trim() || (mode === "register" && !displayName.trim())}
              className="w-full h-12 rounded-xl font-bold text-sm bg-[#52b788] text-[#0a1a10] hover:bg-[#40a070] disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 mt-1"
            >
              {isLoading ? (
                <>
                  <span className="w-4 h-4 rounded-full border-2 border-[#0a1a10]/30 border-t-[#0a1a10] animate-spin" />
                  {mode === "signin" ? "Signing in..." : "Submitting..."}
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-sm">
                    {mode === "signin" ? "login" : "person_add"}
                  </span>
                  {mode === "signin" ? "Sign In" : "Request Access"}
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
