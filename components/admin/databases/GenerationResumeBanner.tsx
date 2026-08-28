"use client";

import type { GenerationJob } from "@/lib/types";

interface GenerationResumeBannerProps {
  job: GenerationJob;
  onResume: () => void;
  onDiscard: () => void;
}

export default function GenerationResumeBanner({ job, onResume, onDiscard }: GenerationResumeBannerProps) {
  const done = job.completedParticipantIds?.length ?? 0;
  const stale = Date.now() - new Date(job.updatedAt).getTime() > 24 * 60 * 60 * 1000;

  return (
    <div
      className="mb-4 rounded-xl px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3"
      style={{ background: stale ? "#f8fafc" : "#fffbeb", border: `1px solid ${stale ? "#e2e8f0" : "#fde68a"}` }}
    >
      <span className="material-symbols-outlined" style={{ color: stale ? "#94a3b8" : "#d97706" }}>
        {stale ? "history" : "warning"}
      </span>
      <p className="text-sm flex-1" style={{ color: "#1b4332" }}>
        {stale
          ? `An old generation job is still recorded for this database (${done} of ${job.total} done, ${new Date(job.updatedAt).toLocaleDateString()}).`
          : `Generation was interrupted — ${done} of ${job.total} certificates done.`}
      </p>
      <div className="flex gap-2">
        {!stale && (
          <button
            onClick={onResume}
            className="px-4 py-1.5 rounded-lg text-xs font-semibold text-white cursor-pointer"
            style={{ background: "linear-gradient(135deg,#22c55e,#16a34a)" }}
          >
            Resume
          </button>
        )}
        <button
          onClick={onDiscard}
          className="px-4 py-1.5 rounded-lg text-xs font-semibold cursor-pointer"
          style={{ background: "#fff", border: "1px solid #e5ebe5", color: "#64748b" }}
        >
          Discard
        </button>
      </div>
    </div>
  );
}
