"use client";

import type { GenerationSummary } from "@/lib/generationState";

interface GenerationResumeBannerProps {
  status: "running" | "interrupted";
  summary: GenerationSummary;
  onResume: () => void;
  onDismiss: () => void;
}

export default function GenerationResumeBanner({ status, summary, onResume, onDismiss }: GenerationResumeBannerProps) {
  const left = summary.needsCert + summary.needsPdf;
  if (left === 0) return null; // nothing outstanding — derived truth wins over the job doc

  const stale = status === "interrupted";
  return (
    <div
      className="mb-4 rounded-xl px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3"
      style={{ background: stale ? "#fffbeb" : "#eff6ff", border: `1px solid ${stale ? "#fde68a" : "#bfdbfe"}` }}
    >
      <span className="material-symbols-outlined" style={{ color: stale ? "#d97706" : "#2563eb" }}>
        {stale ? "warning" : "progress_activity"}
      </span>
      <p className="text-sm flex-1" style={{ color: "#1b4332" }}>
        {stale
          ? `Generation was interrupted — ${summary.needsCert} still need a cert ID, ${summary.needsPdf} need a PDF.`
          : `Generation is running — ${summary.needsCert} need a cert ID, ${summary.needsPdf} need a PDF.`}
      </p>
      <div className="flex gap-2">
        <button
          onClick={onResume}
          className="px-4 py-1.5 rounded-lg text-xs font-semibold text-white cursor-pointer"
          style={{ background: "linear-gradient(135deg,#22c55e,#16a34a)" }}
        >
          Resume
        </button>
        <button
          onClick={onDismiss}
          className="px-4 py-1.5 rounded-lg text-xs font-semibold cursor-pointer"
          style={{ background: "#fff", border: "1px solid #e5ebe5", color: "#64748b" }}
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
