"use client";

interface CrossCategoryHintProps {
  actualCategory: "General" | "Official";
  certId: string;
  currentCategory: "General" | "Official";
}

export default function CrossCategoryHint({ actualCategory, certId }: CrossCategoryHintProps) {
  const href =
    actualCategory === "Official"
      ? `/official?certId=${encodeURIComponent(certId)}`
      : `/verify?certId=${encodeURIComponent(certId)}`;

  return (
    <div
      className="max-w-2xl mx-auto rounded-2xl p-6 text-center"
      style={{ background: "#fff", border: "1px solid #e5ebe5", boxShadow: "0 8px 32px rgba(15,46,28,0.08)" }}
    >
      <span className="material-symbols-outlined text-3xl" style={{ color: "#52b788", fontVariationSettings: "'FILL' 1" }}>
        info
      </span>
      <p className="mt-3 text-sm text-gray-700">
        This is an <span className="font-semibold text-brand-dark-green">{actualCategory}</span> certificate.
      </p>
      <a
        href={href}
        className="inline-flex items-center gap-1.5 mt-4 px-5 py-2.5 rounded-xl text-sm font-semibold text-white"
        style={{ background: "linear-gradient(135deg,#22c55e,#16a34a)", boxShadow: "0 4px 16px rgba(34,197,94,0.30)" }}
      >
        <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>
        Verify on the {actualCategory} page
        <span className="material-symbols-outlined text-base">arrow_forward</span>
      </a>
    </div>
  );
}
