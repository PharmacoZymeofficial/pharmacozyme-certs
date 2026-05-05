"use client";

import { useState, useEffect } from "react";

const STEPS = [
  {
    id: "welcome",
    icon: "waving_hand",
    title: "Welcome to PharmacoZyme Certs",
    subtitle: "Your complete certificate management platform",
    description: "This quick tour will show you how to create, manage, and send professional certificates in minutes. You can re-open this tour any time from the Help page.",
    color: "from-brand-dark-green to-brand-grass-green",
    accent: "#52b788",
    image: null,
    tip: null,
  },
  {
    id: "databases",
    icon: "database",
    title: "Step 1 — Create a Database",
    subtitle: "Organise participants by course or event",
    description: "Go to Databases and click "New Database". Choose a category (General / Official), pick a sub-category and topic, then add participants manually, via CSV import, or by linking a Google Sheet.",
    color: "from-emerald-700 to-emerald-500",
    accent: "#10b981",
    image: null,
    tip: "💡 Linking a Google Sheet lets you sync participants automatically with one click.",
  },
  {
    id: "templates",
    icon: "design_services",
    title: "Step 2 — Upload a Template",
    subtitle: "Use your own PDF certificate design",
    description: "Go to Templates and upload a PDF. Then open the position editor to drag the Name, Certificate ID, QR Code, and any custom text elements onto exactly the right spot on your design.",
    color: "from-purple-700 to-purple-500",
    accent: "#a855f7",
    image: null,
    tip: "💡 Use the "Preview PDF" button in the editor to see the real rendered output with your chosen fonts.",
  },
  {
    id: "generate-ids",
    icon: "tag",
    title: "Step 3 — Generate Certificate IDs",
    subtitle: "Unique IDs power verification and tracking",
    description: "Inside a database, click "Generate IDs". Choose App Format (e.g. 2026-PZ-CRS-0001), Name Format, or a Custom prefix. IDs are assigned to participants without one and saved instantly.",
    color: "from-blue-700 to-blue-500",
    accent: "#3b82f6",
    image: null,
    tip: "💡 App Format automatically uses your database category code — no manual entry needed.",
  },
  {
    id: "generate-pdfs",
    icon: "auto_awesome",
    title: "Step 4 — Generate PDFs",
    subtitle: "Batch-render personalised certificates",
    description: "Click "Generate PDFs" and select a template. The system renders each participant's name, ID, and QR code onto your template and uploads the PDF to Google Drive automatically.",
    color: "from-amber-700 to-amber-500",
    accent: "#f59e0b",
    image: null,
    tip: "💡 Select specific participants first if you only want to regenerate a subset.",
  },
  {
    id: "send-emails",
    icon: "send",
    title: "Step 5 — Send Certificates",
    subtitle: "Deliver certificates directly to recipients",
    description: "Click "Send Emails" to open the email composer. Customise the subject and message (use [Name] and [VerificationLink] placeholders), choose a sender identity, and send or schedule the batch.",
    color: "from-rose-700 to-rose-500",
    accent: "#f43f5e",
    image: null,
    tip: "💡 Schedule emails to deliver at a specific date and time — great for cohort graduations.",
  },
  {
    id: "verify",
    icon: "verified",
    title: "Step 6 — Public Verification",
    subtitle: "Anyone can verify a certificate instantly",
    description: "Every QR code links to verify.pharmacozyme.com. Recipients and employers can scan it or enter the certificate ID to confirm authenticity, view recipient details, and download the PDF.",
    color: "from-teal-700 to-teal-500",
    accent: "#14b8a6",
    image: null,
    tip: "💡 The verification page shows the certificate status live — if you revoke an ID it shows as invalid.",
  },
  {
    id: "history",
    icon: "history",
    title: "Step 7 — Track Activity",
    subtitle: "Complete audit log of all actions",
    description: "The History page logs every certificate generation and email send with timestamps and admin names. Use it to audit activity, check delivery counts, or troubleshoot missed sends.",
    color: "from-slate-700 to-slate-500",
    accent: "#64748b",
    image: null,
    tip: null,
  },
  {
    id: "done",
    icon: "check_circle",
    title: "You're all set! 🎉",
    subtitle: "Start issuing professional certificates today",
    description: "Head to Databases to add your first participants, or upload a template to get started. Come back to this tutorial any time from the Help page in the sidebar.",
    color: "from-brand-dark-green to-brand-vivid-green",
    accent: "#52b788",
    image: null,
    tip: null,
  },
];

interface TutorialProps {
  onClose: () => void;
}

export default function Tutorial({ onClose }: TutorialProps) {
  const [step, setStep] = useState(0);
  const [animating, setAnimating] = useState(false);
  const [direction, setDirection] = useState<"next" | "prev">("next");

  const current = STEPS[step];
  const isFirst = step === 0;
  const isLast = step === STEPS.length - 1;

  const go = (nextStep: number, dir: "next" | "prev") => {
    if (animating) return;
    setDirection(dir);
    setAnimating(true);
    setTimeout(() => {
      setStep(nextStep);
      setAnimating(false);
    }, 220);
  };

  const next = () => { if (!isLast) go(step + 1, "next"); };
  const prev = () => { if (!isFirst) go(step - 1, "prev"); };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "Enter") next();
      if (e.key === "ArrowLeft") prev();
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [step, animating]);

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div
        className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden"
        style={{ maxHeight: "90vh" }}
      >
        {/* Gradient header */}
        <div className={`bg-gradient-to-br ${current.color} px-8 pt-8 pb-10 relative overflow-hidden`}>
          {/* Decorative circles */}
          <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full bg-white/10" />
          <div className="absolute -bottom-10 -left-6 w-32 h-32 rounded-full bg-white/10" />

          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors text-white"
          >
            <span className="material-symbols-outlined text-sm">close</span>
          </button>

          {/* Step counter */}
          <div className="mb-4 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 text-white text-[11px] font-bold uppercase tracking-widest">
            <span className="material-symbols-outlined text-xs" style={{ fontVariationSettings: "'FILL' 1" }}>flag</span>
            {isLast ? "Complete" : `Step ${step} of ${STEPS.length - 2}`}
          </div>

          {/* Icon + title */}
          <div
            className="transition-all duration-200"
            style={{
              opacity: animating ? 0 : 1,
              transform: animating
                ? `translateX(${direction === "next" ? "-20px" : "20px"})`
                : "translateX(0)",
            }}
          >
            <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center mb-4">
              <span
                className="material-symbols-outlined text-white text-3xl"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                {current.icon}
              </span>
            </div>
            <h2 className="text-2xl font-headline font-bold text-white mb-1">{current.title}</h2>
            <p className="text-white/80 text-sm font-medium">{current.subtitle}</p>
          </div>
        </div>

        {/* Body */}
        <div className="px-8 py-6 overflow-y-auto" style={{ maxHeight: "calc(90vh - 220px)" }}>
          <div
            className="transition-all duration-200"
            style={{
              opacity: animating ? 0 : 1,
              transform: animating
                ? `translateX(${direction === "next" ? "20px" : "-20px"})`
                : "translateX(0)",
            }}
          >
            <p className="text-on-surface-variant leading-relaxed text-sm mb-4">{current.description}</p>

            {current.tip && (
              <div
                className="rounded-xl px-4 py-3 text-sm font-medium mb-4"
                style={{ background: `${current.accent}18`, color: current.accent, border: `1px solid ${current.accent}30` }}
              >
                {current.tip}
              </div>
            )}
          </div>

          {/* Progress dots */}
          <div className="flex items-center justify-center gap-1.5 mt-6 mb-2">
            {STEPS.map((_, i) => (
              <button
                key={i}
                onClick={() => go(i, i > step ? "next" : "prev")}
                className="rounded-full transition-all duration-200"
                style={{
                  width: i === step ? "20px" : "8px",
                  height: "8px",
                  background: i === step ? current.accent : "#d1d5db",
                }}
              />
            ))}
          </div>
        </div>

        {/* Footer nav */}
        <div className="px-8 pb-6 flex items-center justify-between gap-3 border-t border-gray-100 pt-4">
          <button
            onClick={prev}
            disabled={isFirst}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <span className="material-symbols-outlined text-base">arrow_back</span>
            Back
          </button>

          <button
            onClick={isLast ? onClose : next}
            className="flex items-center gap-1.5 px-6 py-2.5 rounded-xl text-sm font-bold text-white transition-all active:scale-95 shadow-sm"
            style={{ background: current.accent }}
          >
            {isLast ? (
              <>
                <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: "'FILL' 1" }}>rocket_launch</span>
                Get Started
              </>
            ) : (
              <>
                Next
                <span className="material-symbols-outlined text-base">arrow_forward</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
