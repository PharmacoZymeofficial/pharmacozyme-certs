"use client";

interface CategoryTabsProps {
  active: "General" | "Official";
  counts: { General: number; Official: number };
  onChange: (c: "General" | "Official") => void;
}

export default function CategoryTabs({ active, counts, onChange }: CategoryTabsProps) {
  return (
    <div className="flex items-center gap-1.5 mb-6 p-1 rounded-xl w-fit bg-gray-50 border border-gray-100">
      {(["General", "Official"] as const).map((c) => (
        <button
          key={c}
          onClick={() => onChange(c)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer"
          style={{
            background: active === c ? "linear-gradient(135deg,#22c55e,#16a34a)" : "transparent",
            color: active === c ? "#fff" : "#4b5563",
            boxShadow: active === c ? "0 2px 10px rgba(34,197,94,0.30)" : "none",
          }}
        >
          <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: active === c ? "'FILL' 1" : "'FILL' 0" }}>
            {c === "Official" ? "workspace_premium" : "school"}
          </span>
          {c}
          <span className="text-xs opacity-70">({counts[c]})</span>
        </button>
      ))}
    </div>
  );
}
