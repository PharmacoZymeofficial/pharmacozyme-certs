"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
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
    <div className="min-h-screen flex items-center justify-center bg-[#060f08]">
      <div className="w-10 h-10 rounded-full border-4 border-[#52b788]/30 border-t-[#52b788] animate-spin" />
    </div>
  );
}

const FEATURES = [
  { icon: "verified_user", text: "Role-based access control" },
  { icon: "database", text: "Live Firestore certificate database" },
  { icon: "mail", text: "Automated email distribution" },
  { icon: "analytics", text: "Real-time reports & analytics" },
];

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

      const adminDoc = await getDoc(doc(db, "admins", user.uid));

      if (!adminDoc.exists()) {
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
      if (err.code === "auth/email-already-in-use") {
        try {
          const auth = getAuth(app!);
          const cred = await signInWithEmailAndPassword(auth, email, password);
          const user = cred.user;
          const adminDoc = await getDoc(doc(db, "admins", user.uid));

          if (!adminDoc.exists()) {
            await updateProfile(user, { displayName: displayName.trim() });
            await setDoc(doc(db, "admins", user.uid), {
              email: user.email,
              displayName: displayName.trim(),
              role: "admin",
              status: "pending",
              createdAt: new Date().toISOString(),
            });
            await auth.signOut();
            setInfo("Request submitted. Awaiting super admin approval.");
            setMode("signin");
            setPassword("");
          } else {
            const status = adminDoc.data().status;
            if (status === "rejected") {
              await updateDoc(doc(db, "admins", user.uid), {
                status: "pending",
                displayName: displayName.trim(),
                updatedAt: new Date().toISOString(),
              });
              await auth.signOut();
              setInfo("Re-request submitted. Awaiting super admin approval.");
              setMode("signin");
              setPassword("");
            } else if (status === "pending") {
              await auth.signOut();
              setInfo("Your account is already awaiting approval.");
              setMode("signin");
            } else {
              const role = user.email === SUPER_ADMIN_EMAIL ? "super_admin" : "admin";
              const data = adminDoc.data();
              const res = await fetch("/api/admin/auth", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ uid: user.uid, email: user.email, displayName: data.displayName, role }),
              });
              if (res.ok) { router.push(from); router.refresh(); }
            }
          }
        } catch {
          setError("Account already exists. Sign in instead.");
        }
      } else {
        setError(handleFirebaseError(err.code || ""));
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-[#060f08]">
      {/* ── LEFT BRANDING PANEL (hidden on mobile) ── */}
      <div className="hidden lg:flex lg:w-[45%] relative flex-col overflow-hidden"
        style={{ background: "linear-gradient(160deg, #0a2015 0%, #0d2a1a 40%, #0f3322 100%)" }}>

        {/* Grid pattern */}
        <div className="absolute inset-0 opacity-[0.04]" style={{
          backgroundImage: "linear-gradient(rgba(82,183,136,0.8) 1px, transparent 1px), linear-gradient(90deg, rgba(82,183,136,0.8) 1px, transparent 1px)",
          backgroundSize: "48px 48px"
        }} />

        {/* Radial glows */}
        <div className="absolute top-1/4 -left-24 w-80 h-80 rounded-full opacity-20"
          style={{ background: "radial-gradient(circle, #52b788 0%, transparent 70%)" }} />
        <div className="absolute bottom-1/3 right-0 w-64 h-64 rounded-full opacity-10"
          style={{ background: "radial-gradient(circle, #95d5b2 0%, transparent 70%)" }} />

        {/* Content */}
        <div className="relative z-10 flex flex-col h-full px-12 py-10">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#1b4332] border border-[#2d6a4f]/60 flex items-center justify-center">
              <Image src="/pharmacozyme-logo.png" alt="PharmacoZyme" width={24} height={24} className="opacity-90" />
            </div>
            <span className="text-[#52b788] font-bold text-sm tracking-widest uppercase">PharmacoZyme</span>
          </div>

          {/* Main text */}
          <div className="flex-1 flex flex-col justify-center">
            <div className="mb-3 inline-flex w-fit items-center gap-2 px-3 py-1 rounded-full bg-[#52b788]/10 border border-[#52b788]/20">
              <span className="material-symbols-outlined text-[#52b788] text-xs" style={{ fontVariationSettings: "'FILL' 1" }}>shield</span>
              <span className="text-[#52b788] text-[10px] font-bold uppercase tracking-widest">Secure Admin Portal</span>
            </div>

            <h1 className="text-4xl xl:text-5xl font-bold text-white leading-tight mb-4">
              Certificate<br />
              <span style={{ background: "linear-gradient(90deg, #52b788, #95d5b2)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                Management
              </span><br />
              Platform
            </h1>

            <p className="text-[#52b788]/60 text-sm leading-relaxed max-w-xs mb-10">
              Issue, verify, and manage professional certificates with our secure and scalable platform.
            </p>

            {/* Features */}
            <div className="space-y-3">
              {FEATURES.map((f, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[#52b788]/10 border border-[#52b788]/15 flex items-center justify-center flex-shrink-0">
                    <span className="material-symbols-outlined text-[#52b788] text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>{f.icon}</span>
                  </div>
                  <span className="text-[#95d5b2]/70 text-sm">{f.text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <p className="text-[#52b788]/30 text-xs">
            PharmacoZyme Professional Certifier · v2.0
          </p>
        </div>
      </div>

      {/* ── RIGHT FORM PANEL ── */}
      <div className="flex-1 flex flex-col min-h-screen">
        {/* Mobile top bar */}
        <div className="lg:hidden px-6 py-5 flex items-center gap-3 border-b border-white/5">
          <div className="w-8 h-8 rounded-lg bg-[#1b4332] border border-[#2d6a4f]/50 flex items-center justify-center">
            <Image src="/pharmacozyme-logo.png" alt="PharmacoZyme" width={18} height={18} className="opacity-90" />
          </div>
          <span className="text-[#52b788] font-bold text-xs tracking-widest uppercase">PharmacoZyme</span>
        </div>

        <div className="flex-1 flex items-center justify-center px-6 py-10">
          <div className="w-full max-w-[380px]">
            {/* Header */}
            <div className="mb-8">
              {/* Icon — desktop only (mobile has top bar) */}
              <div className="hidden lg:flex w-14 h-14 mb-5 rounded-2xl bg-[#1b4332] border border-[#2d6a4f]/60 items-center justify-center shadow-lg shadow-black/30">
                <span className="material-symbols-outlined text-2xl text-[#52b788]" style={{ fontVariationSettings: "'FILL' 1" }}>
                  admin_panel_settings
                </span>
              </div>
              <h2 className="text-2xl font-bold text-white mb-1">
                {mode === "signin" ? "Welcome back" : "Request access"}
              </h2>
              <p className="text-sm text-[#52b788]/50">
                {mode === "signin" ? "Sign in to the admin portal" : "Submit your access request to the super admin"}
              </p>
            </div>

            {/* Mode toggle */}
            <div className="flex p-1 rounded-xl bg-white/5 border border-white/8 mb-6 gap-1">
              {(["signin", "register"] as const).map(m => (
                <button
                  key={m}
                  type="button"
                  onClick={() => { setMode(m); setError(""); setInfo(""); }}
                  className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                    mode === m
                      ? "bg-[#52b788] text-[#0a1a10] shadow-sm"
                      : "text-[#52b788]/50 hover:text-[#52b788]"
                  }`}
                >
                  {m === "signin" ? "Sign In" : "Request Access"}
                </button>
              ))}
            </div>

            <form onSubmit={mode === "signin" ? handleSignIn : handleRegister} className="space-y-3">
              {mode === "register" && (
                <div className="group">
                  <label className="block text-[10px] font-bold text-[#52b788]/50 uppercase tracking-widest mb-1.5">Full Name</label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 material-symbols-outlined text-[#52b788]/30 text-base group-focus-within:text-[#52b788]/60 transition-colors">
                      person
                    </span>
                    <input
                      type="text"
                      value={displayName}
                      onChange={e => setDisplayName(e.target.value)}
                      placeholder="Your full name"
                      required
                      disabled={isLoading}
                      className="w-full h-12 pl-10 pr-4 rounded-xl bg-white/5 border border-white/8 text-white placeholder:text-white/20 focus:outline-none focus:border-[#52b788]/50 focus:bg-white/8 transition-all text-sm"
                    />
                  </div>
                </div>
              )}

              <div className="group">
                <label className="block text-[10px] font-bold text-[#52b788]/50 uppercase tracking-widest mb-1.5">Email Address</label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 material-symbols-outlined text-[#52b788]/30 text-base group-focus-within:text-[#52b788]/60 transition-colors">
                    mail
                  </span>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                    autoFocus
                    disabled={isLoading}
                    className="w-full h-12 pl-10 pr-4 rounded-xl bg-white/5 border border-white/8 text-white placeholder:text-white/20 focus:outline-none focus:border-[#52b788]/50 focus:bg-white/8 transition-all text-sm"
                  />
                </div>
              </div>

              <div className="group">
                <label className="block text-[10px] font-bold text-[#52b788]/50 uppercase tracking-widest mb-1.5">Password</label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 material-symbols-outlined text-[#52b788]/30 text-base group-focus-within:text-[#52b788]/60 transition-colors">
                    lock
                  </span>
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder={mode === "register" ? "Min. 6 characters" : "Your password"}
                    required
                    disabled={isLoading}
                    className="w-full h-12 pl-10 pr-12 rounded-xl bg-white/5 border border-white/8 text-white placeholder:text-white/20 focus:outline-none focus:border-[#52b788]/50 focus:bg-white/8 transition-all text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#52b788]/30 hover:text-[#52b788]/70 transition-colors cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-lg">
                      {showPassword ? "visibility_off" : "visibility"}
                    </span>
                  </button>
                </div>
              </div>

              {/* Error / Info messages */}
              {error && (
                <div className="flex items-start gap-2.5 px-3.5 py-3 rounded-xl bg-red-950/40 border border-red-700/30">
                  <span className="material-symbols-outlined text-red-400 text-base flex-shrink-0 mt-0.5">error</span>
                  <p className="text-red-300 text-xs leading-relaxed">{error}</p>
                </div>
              )}

              {info && (
                <div className="flex items-start gap-2.5 px-3.5 py-3 rounded-xl bg-amber-950/30 border border-amber-700/30">
                  <span className="material-symbols-outlined text-amber-400 text-base flex-shrink-0 mt-0.5">info</span>
                  <p className="text-amber-300 text-xs leading-relaxed">{info}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading || !email.trim() || !password.trim() || (mode === "register" && !displayName.trim())}
                className="w-full h-12 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 mt-1 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ background: "linear-gradient(135deg, #52b788 0%, #2d6a4f 100%)", color: "#060f08" }}
              >
                {isLoading ? (
                  <>
                    <span className="w-4 h-4 rounded-full border-2 border-[#060f08]/30 border-t-[#060f08] animate-spin" />
                    {mode === "signin" ? "Signing in..." : "Submitting..."}
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>
                      {mode === "signin" ? "login" : "person_add"}
                    </span>
                    {mode === "signin" ? "Sign In" : "Request Access"}
                  </>
                )}
              </button>
            </form>

            {/* Divider */}
            <div className="flex items-center gap-3 my-6">
              <div className="flex-1 h-px bg-white/6" />
              <span className="text-[10px] text-white/20 font-medium uppercase tracking-widest">Secured</span>
              <div className="flex-1 h-px bg-white/6" />
            </div>

            {/* Security note */}
            <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-white/3 border border-white/6">
              <span className="material-symbols-outlined text-[#52b788]/40 text-base flex-shrink-0" style={{ fontVariationSettings: "'FILL' 1" }}>
                verified_user
              </span>
              <p className="text-[10px] text-white/25 leading-relaxed">
                Access is restricted to approved accounts only. New registrations require super admin approval.
              </p>
            </div>

            <p className="text-center text-[10px] text-white/15 mt-8">
              PharmacoZyme Certificate System · Admin Portal
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
