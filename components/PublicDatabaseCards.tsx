"use client";

import { useState, useEffect, useRef } from "react";

interface PublicDatabase {
  id: string;
  name: string;
  category: string;
  subCategory: string;
  topic: string;
  description: string;
  participantCount: number;
  createdAt: string;
}

interface Props {
  onDatabaseSelect: (dbId: string) => void;
}

// Category-based visual config — no side borders, no gradient text
const CATEGORY_CONFIG: Record<string, { bg: string; badge: string; badgeText: string; icon: string }> = {
  General: {
    bg: "linear-gradient(135deg, rgba(209,250,229,0.6) 0%, rgba(167,243,208,0.3) 100%)",
    badge: "rgba(6,95,70,0.1)",
    badgeText: "#065f46",
    icon: "school",
  },
  Official: {
    bg: "linear-gradient(135deg, rgba(187,247,208,0.35) 0%, rgba(134,239,172,0.18) 100%)",
    badge: "rgba(27,67,50,0.1)",
    badgeText: "#1b4332",
    icon: "workspace_premium",
  },
};

function fallbackConfig() {
  return {
    bg: "linear-gradient(135deg, rgba(209,250,229,0.4) 0%, rgba(187,247,208,0.2) 100%)",
    badge: "rgba(6,95,70,0.08)",
    badgeText: "#065f46",
    icon: "folder",
  };
}

function fmtDate(d: string) {
  if (!d) return "";
  try {
    return new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short" });
  } catch {
    return "";
  }
}

function DatabaseCard({
  db,
  index,
  isVisible,
  onSelect,
}: {
  db: PublicDatabase;
  index: number;
  isVisible: boolean;
  onSelect: (id: string) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const cfg = CATEGORY_CONFIG[db.category] || fallbackConfig();

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        opacity: isVisible ? 1 : 0,
        transform: isVisible
          ? hovered ? "translateY(-6px)" : "translateY(0)"
          : "translateY(24px)",
        transition: isVisible
          ? "opacity 0.3s ease, transform 0.22s cubic-bezier(0.16,1,0.3,1), box-shadow 0.22s ease, border-color 0.22s ease, background 0.22s ease"
          : `opacity 0.55s ${120 + index * 70}ms ease, transform 0.55s ${120 + index * 70}ms cubic-bezier(0.16,1,0.3,1)`,
        borderRadius: "1.25rem",
        background: hovered ? "#fff" : "#fafcfa",
        border: hovered ? "1.5px solid #40916c" : "1.5px solid #d1fae5",
        boxShadow: hovered
          ? "0 16px 40px rgba(27,67,50,0.12), 0 2px 8px rgba(27,67,50,0.06)"
          : "0 2px 12px rgba(27,67,50,0.05)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Card top accent strip — full-width gradient bg, not a side border */}
      <div style={{ height: 4, borderRadius: "1.25rem 1.25rem 0 0", background: cfg.bg.includes("209,250") ? "linear-gradient(90deg,#40916c,#74c69d)" : "linear-gradient(90deg,#1b4332,#40916c)" }} />

      <div className="p-5 flex flex-col gap-4 flex-1">
        {/* Header row */}
        <div className="flex items-start justify-between gap-3">
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: cfg.bg }}
          >
            <span
              className="material-symbols-outlined text-xl"
              style={{ color: cfg.badgeText, fontVariationSettings: "'FILL' 1" }}
            >
              {cfg.icon}
            </span>
          </div>
          <span
            className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full flex-shrink-0"
            style={{ background: cfg.badge, color: cfg.badgeText }}
          >
            {db.category}
          </span>
        </div>

        {/* Name + meta */}
        <div className="flex-1">
          <h3 className="font-bold text-[#0d2b1a] text-base leading-snug mb-1.5" style={{ fontFamily: "Fredoka, sans-serif" }}>
            {db.name}
          </h3>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {db.subCategory && (
              <span className="text-[10px] px-2 py-0.5 rounded-md font-medium" style={{ background: "rgba(64,145,108,0.1)", color: "#40916c" }}>
                {db.subCategory}
              </span>
            )}
            {db.topic && db.topic !== db.subCategory && (
              <span className="text-[10px] px-2 py-0.5 rounded-md font-medium" style={{ background: "rgba(64,145,108,0.07)", color: "#52b788" }}>
                {db.topic}
              </span>
            )}
          </div>
          {db.description && (
            <p className="text-xs leading-relaxed line-clamp-2" style={{ color: "#6b7c75" }}>
              {db.description}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-3" style={{ borderTop: "1px solid rgba(64,145,108,0.1)" }}>
          <div className="flex items-center gap-1.5" style={{ color: "#52b788" }}>
            <span className="material-symbols-outlined text-sm">group</span>
            <span className="text-xs font-medium">{db.participantCount.toLocaleString()} participants</span>
          </div>
          {fmtDate(db.createdAt) && (
            <span className="text-[10px]" style={{ color: "#94a3b8" }}>{fmtDate(db.createdAt)}</span>
          )}
        </div>

        {/* CTA */}
        <button
          onClick={() => onSelect(db.id)}
          className="w-full py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-all"
          style={{
            background: hovered ? "linear-gradient(135deg,#40916c,#1b4332)" : "rgba(64,145,108,0.08)",
            color: hovered ? "#fff" : "#40916c",
            border: hovered ? "none" : "1px solid rgba(64,145,108,0.2)",
          }}
        >
          <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>
            manage_search
          </span>
          Search in this database
        </button>
      </div>
    </div>
  );
}

export default function PublicDatabaseCards({ onDatabaseSelect }: Props) {
  const [databases, setDatabases] = useState<PublicDatabase[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterText, setFilterText] = useState("");
  const [isVisible, setIsVisible] = useState(false);

  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    fetch("/api/databases/public")
      .then((r) => r.json())
      .then((d) => setDatabases(d.databases || []))
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  // Entrance animation
  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setIsVisible(true); },
      { threshold: 0.05 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const filtered = filterText.trim()
    ? databases.filter(
        (db) =>
          db.name.toLowerCase().includes(filterText.toLowerCase()) ||
          db.subCategory.toLowerCase().includes(filterText.toLowerCase()) ||
          db.topic.toLowerCase().includes(filterText.toLowerCase())
      )
    : databases;

  if (!isLoading && databases.length === 0) return null;

  return (
    <section
      ref={sectionRef}
      className="bg-surface-container-low py-14 sm:py-20"
      style={{
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? "translateY(0)" : "translateY(28px)",
        transition: "opacity 0.7s ease, transform 0.7s cubic-bezier(0.16,1,0.3,1)",
      }}
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6">

        {/* Header */}
        <div
          className="mb-8"
          style={{
            opacity: isVisible ? 1 : 0,
            transform: isVisible ? "translateY(0)" : "translateY(16px)",
            transition: "opacity 0.55s 80ms ease, transform 0.55s 80ms ease",
          }}
        >
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-outline mb-2">
                Available Databases
              </p>
              <h2 className="text-2xl sm:text-3xl font-bold text-on-surface" style={{ fontFamily: "Fredoka, sans-serif" }}>
                Browse Certificate Databases
              </h2>
              <p className="text-sm text-on-surface-variant mt-1">
                Select a database to scope your search
              </p>
            </div>

            {/* Search filter */}
            <div className="relative sm:w-56">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-base pointer-events-none" style={{ color: "#94a3b8" }}>
                filter_list
              </span>
              <input
                type="text"
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
                placeholder="Filter databases..."
                className="w-full h-10 pl-9 pr-4 rounded-xl text-xs outline-none"
                style={{
                  background: "#fff",
                  border: "1.5px solid #d1fae5",
                  color: "#0d2b1a",
                }}
                onFocus={(e) => (e.currentTarget.style.borderColor = "#40916c")}
                onBlur={(e) => (e.currentTarget.style.borderColor = "#d1fae5")}
              />
            </div>
          </div>
        </div>

        {/* Loading skeletons */}
        {isLoading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="rounded-[1.25rem] overflow-hidden"
                style={{ border: "1.5px solid #d1fae5", animation: `slideUpFade 0.4s ease ${i * 80}ms both` }}
              >
                <div className="h-1 animate-pulse" style={{ background: "linear-gradient(90deg,#40916c,#74c69d)" }} />
                <div className="p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="w-11 h-11 rounded-xl animate-pulse" style={{ background: "#d1fae5" }} />
                    <div className="h-5 w-16 rounded-full animate-pulse" style={{ background: "#d1fae5" }} />
                  </div>
                  <div className="h-5 rounded-lg animate-pulse w-3/4" style={{ background: "#d1fae5" }} />
                  <div className="h-3 rounded animate-pulse w-1/2" style={{ background: "#ecfdf5" }} />
                  <div className="h-9 rounded-xl animate-pulse" style={{ background: "#ecfdf5" }} />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty filtered state */}
        {!isLoading && filtered.length === 0 && filterText && (
          <div className="text-center py-16">
            <span className="material-symbols-outlined text-4xl mb-3 block" style={{ color: "#d1fae5" }}>search_off</span>
            <p className="text-sm text-on-surface-variant">No databases match "{filterText}"</p>
          </div>
        )}

        {/* Cards */}
        {!isLoading && filtered.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filtered.map((db, i) => (
              <DatabaseCard
                key={db.id}
                db={db}
                index={i}
                isVisible={isVisible}
                onSelect={onDatabaseSelect}
              />
            ))}
          </div>
        )}

        {/* Count */}
        {!isLoading && databases.length > 0 && (
          <p
            className="text-center text-xs mt-8"
            style={{
              color: "#94a3b8",
              opacity: isVisible ? 1 : 0,
              transition: "opacity 0.6s 400ms ease",
            }}
          >
            {filtered.length} of {databases.length} database{databases.length !== 1 ? "s" : ""} shown · most recent first
          </p>
        )}
      </div>
    </section>
  );
}
