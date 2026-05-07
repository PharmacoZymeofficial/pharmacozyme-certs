"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { sfx } from "@/lib/sfx";

// ── Types ─────────────────────────────────────────────────────────────────────

interface SearchResult {
  id: string;
  uniqueCertId: string;
  recipientName: string;
  category: string;
  subCategory: string;
  topic: string;
  certType: string;
  issueDate: string;
  status: string;
}

interface PublicDatabase {
  id: string;
  name: string;
  category: string;
  subCategory: string;
  topic: string;
  participantCount: number;
}

export interface Props {
  onVerify: (certId: string, category?: string, subCategory?: string) => void;
  isLoading: boolean;
  defaultCertId?: string;
  preselectedDbId?: string | null;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const SUB_CATS = [
  "Courses",
  "Workshops",
  "Webinars",
  "MED-Q",
  "Central Team",
  "Sub Team",
  "Ambassadors",
  "Affiliates",
  "Mentors",
];

const AVATAR_GRADIENTS = [
  "linear-gradient(135deg,#52b788,#1b4332)",
  "linear-gradient(135deg,#40916c,#1b4332)",
  "linear-gradient(135deg,#22c55e,#166534)",
  "linear-gradient(135deg,#4ade80,#15803d)",
  "linear-gradient(135deg,#86efac,#166534)",
  "linear-gradient(135deg,#34d399,#065f46)",
];

function avatarGradient(name: string) {
  return AVATAR_GRADIENTS[(name.charCodeAt(0) || 0) % AVATAR_GRADIENTS.length];
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase();
}

function fmtDate(d: string) {
  if (!d) return "—";
  try {
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return d;
    return dt.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return d;
  }
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SkeletonCard({ delay }: { delay: number }) {
  return (
    <div
      className="rounded-2xl p-5 relative overflow-hidden bg-white border border-gray-100"
      style={{
        boxShadow: "0 1px 4px rgba(15,46,28,0.04)",
        animation: `slideUpFade 0.35s ease ${delay}ms both`,
      }}
    >
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl animate-pulse flex-shrink-0 bg-gray-100" />
        <div className="flex-1 space-y-2">
          <div className="h-3 rounded-full animate-pulse w-3/4 bg-gray-100" />
          <div className="h-2 rounded-full animate-pulse w-1/2 bg-gray-100" />
        </div>
      </div>
      <div className="h-8 rounded-lg animate-pulse mb-3 bg-gray-50" />
      <div className="h-9 rounded-xl animate-pulse bg-gray-50" />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: "linear-gradient(90deg,transparent,rgba(82,183,136,0.06),transparent)",
          animation: "shimmerSlide 1.6s ease infinite",
        }}
      />
    </div>
  );
}

function ResultCard({
  result,
  index,
  onSelect,
}: {
  result: SearchResult;
  index: number;
  onSelect: (id: string) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const label = result.topic || result.certType || result.subCategory || result.category;
  const isActive = result.status === "generated" || result.status === "sent";

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect(result.uniqueCertId)}
      onKeyDown={(e) => e.key === "Enter" && onSelect(result.uniqueCertId)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="rounded-2xl p-5 flex flex-col gap-3 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-grass-green/50"
      style={{
        background: "#ffffff",
        border: hovered ? "1px solid #52b788" : "1px solid #e5ebe5",
        boxShadow: hovered
          ? "0 12px 32px rgba(27,67,50,0.10),0 0 0 1px rgba(82,183,136,0.20)"
          : "0 1px 4px rgba(15,46,28,0.04)",
        transform: hovered ? "translateY(-4px)" : "translateY(0)",
        transition: "all 0.22s cubic-bezier(0.16,1,0.3,1)",
        animation: `slideUpFade 0.4s cubic-bezier(0.16,1,0.3,1) ${index * 65}ms both`,
      }}
    >
      <div className="flex items-center gap-3">
        <div
          className="w-10 h-10 rounded-xl flex-shrink-0 flex items-center justify-center text-sm font-bold text-white"
          style={{ background: avatarGradient(result.recipientName), boxShadow: "0 2px 6px rgba(27,67,50,0.20)" }}
        >
          {initials(result.recipientName)}
        </div>
        <div className="min-w-0">
          <p className="text-brand-dark-green font-semibold text-sm leading-tight truncate">{result.recipientName}</p>
          <p className="text-xs text-gray-500 truncate mt-0.5">
            {label || "Certificate"}
          </p>
        </div>
      </div>

      <div className="px-3 py-2 rounded-xl bg-green-50 border border-green-100">
        <p className="text-[9px] uppercase tracking-widest mb-0.5 text-brand-grass-green/70 font-bold">
          Certificate ID
        </p>
        <p className="text-xs font-mono truncate text-brand-dark-green">
          {result.uniqueCertId || "—"}
        </p>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <p className="text-[9px] uppercase tracking-widest text-gray-400 font-bold">Issued</p>
          <p className="text-xs text-gray-600">{fmtDate(result.issueDate)}</p>
        </div>
        <div className="flex items-center gap-1.5">
          <div
            className="w-1.5 h-1.5 rounded-full"
            style={{ background: isActive ? "#22c55e" : "#94a3b8", boxShadow: isActive ? "0 0 6px rgba(34,197,94,0.6)" : "none" }}
          />
          <span className="text-[10px] font-medium" style={{ color: isActive ? "#16a34a" : "#94a3b8" }}>
            {isActive ? "Issued" : result.status}
          </span>
        </div>
      </div>

      <div
        className="w-full py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5"
        style={{
          background: hovered ? "linear-gradient(135deg,#22c55e,#16a34a)" : "#f3f7f3",
          color: hovered ? "#fff" : "#1b4332",
          border: hovered ? "1px solid #16a34a" : "1px solid #e5ebe5",
          boxShadow: hovered ? "0 4px 14px rgba(34,197,94,0.30)" : "none",
          transition: "all 0.2s cubic-bezier(0.16,1,0.3,1)",
        }}
      >
        <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>
        Verify Certificate
        <span className="material-symbols-outlined text-sm">arrow_forward</span>
      </div>
    </div>
  );
}

function IdlePlaceholder() {
  const pairs = [["AK", 0], ["BM", 1], ["JD", 2], ["RS", 3], ["TL", 4]] as [string, number][];
  return (
    <div className="text-center py-12">
      <div className="flex justify-center items-end gap-2 mb-5 h-14">
        {pairs.map(([init, i]) => (
          <div
            key={i}
            className="rounded-xl flex items-center justify-center text-xs font-bold text-white"
            style={{
              background: AVATAR_GRADIENTS[i % AVATAR_GRADIENTS.length],
              opacity: 0.35 + i * 0.10,
              width: 32 + i * 4,
              height: 32 + i * 4,
              transform: `translateY(${i % 2 === 0 ? -4 : 4}px)`,
              filter: `blur(${i === 2 ? 0 : 0.6}px)`,
              animation: `orbFloat ${5 + i * 1.5}s ease-in-out ${i * 300}ms infinite`,
            }}
          >
            {init}
          </div>
        ))}
      </div>
      <p className="text-sm text-gray-400">
        Type a name to find matching certificates
      </p>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function VerifySearch({
  onVerify,
  isLoading,
  defaultCertId = "",
  preselectedDbId,
}: Props) {
  const [mode, setMode] = useState<"id" | "name">("name");
  const [certIdInput, setCertIdInput] = useState(defaultCertId);
  const [nameInput, setNameInput] = useState("");
  const [selectedDbId, setSelectedDbId] = useState(preselectedDbId || "");
  const [selectedSubCat, setSelectedSubCat] = useState("");
  const [databases, setDatabases] = useState<PublicDatabase[]>([]);
  const [loadingDbs, setLoadingDbs] = useState(true);
  const [nameResults, setNameResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [dbDropdownOpen, setDbDropdownOpen] = useState(false);
  const [showSubCatHint, setShowSubCatHint] = useState(true);
  const [subCatHintDismissed, setSubCatHintDismissed] = useState(false);
  const [dbFocusedIndex, setDbFocusedIndex] = useState(-1);

  const sectionRef = useRef<HTMLElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dbDropdownRef = useRef<HTMLDivElement>(null);
  const dbDropdownListRef = useRef<HTMLDivElement>(null);
  const subCatScrollRef = useRef<HTMLDivElement>(null);

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

  // Close dropdown on outside click
  useEffect(() => {
    if (!dbDropdownOpen) return;
    const handler = (e: MouseEvent) => {
      if (!dbDropdownRef.current?.contains(e.target as Node)) setDbDropdownOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [dbDropdownOpen]);

  // Cycle hint: show 3 s, hide 4 s, repeat — stops permanently once user picks a chip
  useEffect(() => {
    if (subCatHintDismissed) return;
    const tids: ReturnType<typeof setTimeout>[] = [];
    const cycle = () => {
      setShowSubCatHint(true);
      const t1 = setTimeout(() => {
        setShowSubCatHint(false);
        const t2 = setTimeout(cycle, 4000);
        tids.push(t2);
      }, 3000);
      tids.push(t1);
    };
    cycle();
    return () => tids.forEach(clearTimeout);
  }, [subCatHintDismissed]);

  // Scroll keyboard-focused dropdown item into view
  useEffect(() => {
    if (!dbDropdownOpen || dbFocusedIndex < 0) return;
    const item = dbDropdownListRef.current?.querySelector<HTMLElement>(`[data-dbindex="${dbFocusedIndex}"]`);
    item?.scrollIntoView({ block: "nearest" });
  }, [dbFocusedIndex, dbDropdownOpen]);

  // Fetch live databases for dropdown
  useEffect(() => {
    fetch("/api/databases/public")
      .then((r) => r.json())
      .then((d) => setDatabases(d.databases || []))
      .catch(() => {})
      .finally(() => setLoadingDbs(false));
  }, []);

  // Sync preselectedDbId from parent (card click)
  useEffect(() => {
    if (preselectedDbId !== undefined && preselectedDbId !== null) {
      setSelectedDbId(preselectedDbId);
      setSelectedSubCat("");
    }
  }, [preselectedDbId]);

  // Name search
  const search = useCallback(async (name: string, dbId: string, subCat: string) => {
    if (name.length < 2) {
      setNameResults([]);
      setHasSearched(false);
      setSearchError(null);
      return;
    }
    setIsSearching(true);
    setSearchError(null);
    try {
      const params = new URLSearchParams({ name });
      if (dbId) params.set("databaseId", dbId);
      if (subCat) params.set("subCategory", subCat);
      const res = await fetch(`/api/search-name?${params}`);
      const data = await res.json();
      if (res.status === 429) {
        setSearchError(data.error || "Too many requests.");
        return;
      }
      if (!res.ok) throw new Error(data.error || "Search failed");
      const items: SearchResult[] = data.results || [];
      setNameResults(items);
      setHasSearched(true);
      if (items.length > 0) sfx.pop();
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setIsSearching(false);
    }
  }, []);

  const triggerSearch = (name: string, dbId: string, subCat: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(name, dbId, subCat), 450);
  };

  const handleNameInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setNameInput(val);
    triggerSearch(val, selectedDbId, selectedSubCat);
  };

  const handleDbChange = (dbId: string) => {
    setSelectedDbId(dbId);
    setSelectedSubCat("");
    if (mode === "name" && nameInput.length >= 2) triggerSearch(nameInput, dbId, "");
  };

  const handleSubCatToggle = (sub: string) => {
    setSubCatHintDismissed(true);
    setShowSubCatHint(false);
    const next = selectedSubCat === sub ? "" : sub;
    setSelectedSubCat(next);
    if (mode === "name" && nameInput.length >= 2) triggerSearch(nameInput, selectedDbId, next);
  };

  const handleModeSwitch = (m: "id" | "name") => {
    setMode(m);
    setNameResults([]);
    setHasSearched(false);
    setSearchError(null);
    setTimeout(() => inputRef.current?.focus(), 80);
  };

  const allDbOptions = [{ id: "", name: "All Databases" }, ...databases];

  const handleDropdownKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!dbDropdownOpen) {
        setDbDropdownOpen(true);
        setDbFocusedIndex(allDbOptions.findIndex((d) => d.id === selectedDbId));
      } else {
        setDbFocusedIndex((i) => Math.min(i + 1, allDbOptions.length - 1));
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setDbFocusedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && dbDropdownOpen) {
      e.preventDefault();
      if (dbFocusedIndex >= 0 && dbFocusedIndex < allDbOptions.length) {
        handleDbChange(allDbOptions[dbFocusedIndex].id);
        setDbDropdownOpen(false);
        setDbFocusedIndex(-1);
      }
    } else if (e.key === "Escape" || e.key === "Tab") {
      setDbDropdownOpen(false);
      setDbFocusedIndex(-1);
    }
  };

  const selectedDb = databases.find((d) => d.id === selectedDbId) || null;

  const handleIdSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!certIdInput.trim() || isLoading) return;
    sfx.click();
    const cat = selectedDb?.category;
    const sub = selectedDb?.subCategory || selectedSubCat || undefined;
    onVerify(certIdInput.trim(), cat, sub);
  };

  const handleResultSelect = (certId: string) => {
    sfx.click();
    onVerify(certId);
  };

  const showIdle = mode === "name" && !isSearching && !hasSearched && !searchError;
  const showEmpty = mode === "name" && !isSearching && !searchError && hasSearched && nameResults.length === 0;
  const showResults = mode === "name" && !isSearching && !searchError && nameResults.length > 0;

  const visStyle = (delay: number, extra?: React.CSSProperties): React.CSSProperties => ({
    opacity: isVisible ? 1 : 0,
    transform: isVisible ? "translateY(0)" : "translateY(22px)",
    transition: `opacity 0.65s ${delay}ms ease, transform 0.65s ${delay}ms ease`,
    ...extra,
  });

  return (
    <section
      ref={sectionRef}
      id="verify-search"
      className="relative overflow-hidden"
      style={{
        background: "linear-gradient(180deg,#ffffff 0%,#f6faf7 50%,#eef5f0 100%)",
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? "translateY(0)" : "translateY(30px)",
        transition: "opacity 0.75s cubic-bezier(0.16,1,0.3,1), transform 0.75s cubic-bezier(0.16,1,0.3,1)",
      }}
    >
      {/* Subtle grid overlay */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `linear-gradient(rgba(27,67,50,0.025) 1px,transparent 1px),linear-gradient(90deg,rgba(27,67,50,0.025) 1px,transparent 1px)`,
          backgroundSize: "48px 48px",
        }}
      />

      {/* Soft top spotlight */}
      <div
        className="absolute pointer-events-none"
        style={{
          top: 0, left: "50%", transform: "translateX(-50%)",
          width: 600, height: 300,
          background: "radial-gradient(ellipse at top,rgba(82,183,136,0.10) 0%,transparent 70%)",
        }}
      />

      {/* Soft orbs */}
      <div className="absolute -top-40 -left-40 w-96 h-96 rounded-full pointer-events-none" style={{ background: "radial-gradient(circle,rgba(82,183,136,0.08) 0%,transparent 70%)", animation: "orbFloat 10s ease-in-out infinite" }} />
      <div className="absolute -bottom-40 -right-40 w-[28rem] h-[28rem] rounded-full pointer-events-none" style={{ background: "radial-gradient(circle,rgba(34,197,94,0.06) 0%,transparent 70%)", animation: "orbFloat 14s ease-in-out 2s infinite reverse" }} />

      <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 py-14 sm:py-20">

        {/* ── Header ── */}
        <div className="text-center mb-10" style={visStyle(100)}>
          {/* Pill badge */}
          <div
            className="inline-flex items-center gap-2 mb-5 px-5 py-2 rounded-full"
            style={{
              background: "linear-gradient(135deg,#dcfce7,#bbf7d0)",
              border: "1px solid #86efac",
              boxShadow: "0 2px 12px rgba(34,197,94,0.10)",
            }}
          >
            <span className="material-symbols-outlined text-sm" style={{ color: "#16a34a", fontVariationSettings: "'FILL' 1" }}>verified</span>
            <span className="text-xs font-bold tracking-widest uppercase text-brand-dark-green" style={{ letterSpacing: "0.15em" }}>Certificate Lookup</span>
          </div>

          {/* Gradient title — dark to vivid green */}
          <h2
            className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-3"
            style={{
              fontFamily: "Fredoka, sans-serif",
              background: "linear-gradient(135deg,#1b4332 0%,#2d6a4f 50%,#52b788 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            Find Your Certificate
          </h2>

          <p className="text-sm sm:text-base max-w-md mx-auto text-gray-600">
            Search by name or certificate ID across all PharmacoZyme databases
          </p>

          {/* Decorative divider */}
          <div className="flex items-center justify-center gap-3 mt-6">
            <div style={{ width: 40, height: 1, background: "linear-gradient(90deg,transparent,rgba(82,183,136,0.4))" }} />
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#52b788", boxShadow: "0 0 8px rgba(82,183,136,0.5)" }} />
            <div style={{ width: 40, height: 1, background: "linear-gradient(90deg,rgba(82,183,136,0.4),transparent)" }} />
          </div>
        </div>

        {/* ── Search card ── */}
        <div
          style={{
            ...visStyle(180),
            borderRadius: "1.5rem",
            background: "#ffffff",
            border: "1px solid #e5ebe5",
            boxShadow: "0 12px 40px rgba(15,46,28,0.08), 0 2px 8px rgba(15,46,28,0.04)",
            position: "relative",
            overflow: "hidden",
          }}
        >
          {/* Card top accent */}
          <div
            style={{
              position: "absolute", top: 0, left: "10%", right: "10%", height: 2,
              background: "linear-gradient(90deg,transparent,#52b788,transparent)",
              pointerEvents: "none",
            }}
          />
          <div className="p-5 sm:p-7">

            {/* Mode tabs */}
            <div className="flex items-center gap-1.5 mb-5 p-1 rounded-xl w-fit bg-gray-50 border border-gray-100">
              {(["name", "id"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => handleModeSwitch(m)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer"
                  style={{
                    background: mode === m
                      ? "linear-gradient(135deg,#22c55e,#16a34a)"
                      : "transparent",
                    color: mode === m ? "#fff" : "#4b5563",
                    boxShadow: mode === m ? "0 2px 10px rgba(34,197,94,0.30)" : "none",
                    transition: "all 0.2s cubic-bezier(0.16,1,0.3,1)",
                  }}
                >
                  <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: mode === m ? "'FILL' 1" : "'FILL' 0" }}>
                    {m === "id" ? "badge" : "person_search"}
                  </span>
                  {m === "id" ? "By Certificate ID" : "By Name"}
                </button>
              ))}
            </div>

            {/* Filters row */}
            <div className="flex flex-col sm:flex-row gap-3 mb-4">
              {/* Database dropdown — custom */}
              <div ref={dbDropdownRef} className="relative flex-shrink-0 sm:w-56">
                <span
                  className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-base pointer-events-none z-10"
                  style={{ color: "#52b788", fontVariationSettings: "'FILL' 1" }}
                >
                  database
                </span>
                <button
                  type="button"
                  onClick={() => {
                    if (loadingDbs) return;
                    if (!dbDropdownOpen) setDbFocusedIndex(allDbOptions.findIndex((d) => d.id === selectedDbId));
                    setDbDropdownOpen((o) => !o);
                  }}
                  onKeyDown={handleDropdownKeyDown}
                  disabled={loadingDbs}
                  className="w-full h-10 pl-9 pr-8 rounded-xl text-xs font-medium text-left outline-none cursor-pointer truncate"
                  style={{
                    background: "#ffffff",
                    border: selectedDbId ? "1px solid #52b788" : "1px solid #e5ebe5",
                    color: selectedDbId ? "#1b4332" : "#6b7280",
                    boxShadow: selectedDbId ? "0 0 0 3px rgba(82,183,136,0.10)" : "none",
                  }}
                >
                  {loadingDbs
                    ? "Loading..."
                    : selectedDbId
                    ? databases.find((d) => d.id === selectedDbId)?.name || "All Databases"
                    : "All Databases"}
                </button>
                <span
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 material-symbols-outlined text-sm pointer-events-none"
                  style={{
                    color: "#9ca3af",
                    transition: "transform 0.18s ease",
                    transform: dbDropdownOpen ? "rotate(180deg)" : "rotate(0deg)",
                  }}
                >
                  expand_more
                </span>

                {dbDropdownOpen && (
                  <div
                    className="absolute top-full left-0 right-0 mt-1.5 rounded-xl overflow-hidden z-50"
                    style={{
                      background: "#ffffff",
                      border: "1px solid #e5ebe5",
                      boxShadow: "0 12px 32px rgba(15,46,28,0.12)",
                      animation: "slideUpFade 0.15s ease both",
                    }}
                  >
                    <div ref={dbDropdownListRef} className="max-h-52 overflow-y-auto" style={{ scrollbarWidth: "thin", scrollbarColor: "#cbd5d6 transparent" }}>
                      {allDbOptions.map((opt, idx) => {
                        const isSelected = opt.id === selectedDbId;
                        const isFocused = dbFocusedIndex === idx;
                        return (
                          <button
                            type="button"
                            key={opt.id || "__all__"}
                            data-dbindex={idx}
                            onClick={() => { handleDbChange(opt.id); setDbDropdownOpen(false); setDbFocusedIndex(-1); }}
                            onMouseEnter={() => setDbFocusedIndex(idx)}
                            className="w-full px-4 py-2.5 text-left text-xs font-medium cursor-pointer flex items-center gap-2"
                            style={{
                              color: isSelected ? "#1b4332" : "#374151",
                              background: isFocused
                                ? "#f3f7f3"
                                : isSelected
                                ? "#dcfce7"
                                : "transparent",
                              outline: "none",
                            }}
                          >
                            {isSelected && <span className="material-symbols-outlined text-sm" style={{ color: "#16a34a" }}>check</span>}
                            <span className="truncate">{opt.name}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Subcategory chips — only when no specific DB selected */}
              {!selectedDbId && (
                <div className="relative flex-1 min-w-0 flex items-center">
                  {/* Scrollable chips */}
                  <div
                    ref={subCatScrollRef}
                    className="flex items-center gap-2 overflow-x-auto pb-0.5 flex-1 min-w-0 pr-9"
                    style={{ scrollbarWidth: "none" }}
                  >
                    {showSubCatHint && (
                      <div
                        className="flex items-center gap-1 flex-shrink-0 pointer-events-none select-none"
                        style={{ animation: "slideUpFade 0.25s ease both" }}
                      >
                        <span className="text-[10px] font-semibold whitespace-nowrap text-brand-grass-green">Filter</span>
                        <span
                          className="material-symbols-outlined text-base"
                          style={{ color: "#52b788", animation: "arrowNudge 0.9s ease-in-out infinite" }}
                        >
                          arrow_forward
                        </span>
                      </div>
                    )}
                    {SUB_CATS.map((sub) => (
                      <button
                        key={sub}
                        onClick={() => handleSubCatToggle(sub)}
                        className="flex-shrink-0 px-3 py-1.5 rounded-lg text-[11px] font-medium cursor-pointer transition-all whitespace-nowrap"
                        style={{
                          background: selectedSubCat === sub ? "#dcfce7" : "#ffffff",
                          border: selectedSubCat === sub ? "1px solid #52b788" : "1px solid #e5ebe5",
                          color: selectedSubCat === sub ? "#16a34a" : "#4b5563",
                        }}
                      >
                        {sub}
                      </button>
                    ))}
                  </div>

                  {/* Right fade + scroll button */}
                  <div
                    className="absolute right-0 top-0 bottom-0 flex items-center pointer-events-none"
                    style={{ width: 48, background: "linear-gradient(90deg,transparent,#ffffff)" }}
                  />
                  <button
                    type="button"
                    onClick={() => subCatScrollRef.current?.scrollBy({ left: 110, behavior: "smooth" })}
                    className="absolute right-0 flex-shrink-0 flex items-center justify-center cursor-pointer"
                    style={{
                      width: 28, height: 28, borderRadius: "50%",
                      background: "linear-gradient(135deg,#22c55e,#16a34a)",
                      color: "#ffffff",
                      boxShadow: "0 2px 8px rgba(34,197,94,0.25)",
                    }}
                    aria-label="Scroll categories"
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>chevron_right</span>
                  </button>
                </div>
              )}

              {/* Selected DB badge */}
              {selectedDb && (
                <div
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium self-center"
                  style={{ background: "#dcfce7", border: "1px solid #86efac", color: "#16a34a" }}
                >
                  <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>folder</span>
                  {selectedDb.subCategory} · {selectedDb.topic || selectedDb.name}
                </div>
              )}
            </div>

            {/* Input */}
            {mode === "id" ? (
              <form onSubmit={handleIdSubmit}>
                <div className="flex gap-3">
                  <div
                    className="flex-1 relative"
                    style={{
                      borderRadius: "0.875rem",
                      background: "#fafcfa",
                      border: isFocused ? "1.5px solid #52b788" : "1.5px solid #e5ebe5",
                      boxShadow: isFocused
                        ? "0 0 0 4px rgba(82,183,136,0.12)"
                        : "none",
                      transition: "border-color 0.2s,box-shadow 0.2s",
                    }}
                  >
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-lg pointer-events-none" style={{ color: "#52b788" }}>badge</span>
                    <input
                      ref={inputRef}
                      type="text"
                      value={certIdInput}
                      onChange={(e) => setCertIdInput(e.target.value)}
                      onFocus={() => setIsFocused(true)}
                      onBlur={() => setIsFocused(false)}
                      placeholder="e.g. PZ-2024-XXXX-9821"
                      className="w-full bg-transparent text-brand-dark-green placeholder-gray-400 outline-none pl-11 pr-4 py-3.5 text-sm font-mono"
                      style={{ caretColor: "#52b788" }}
                      aria-label="Certificate ID"
                      autoComplete="off"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={!certIdInput.trim() || isLoading}
                    className="flex-shrink-0 px-5 py-3.5 rounded-[0.875rem] text-sm font-bold flex items-center gap-2 transition-all"
                    style={{
                      background: certIdInput.trim() && !isLoading
                        ? "linear-gradient(135deg,#22c55e,#16a34a)"
                        : "#f3f4f6",
                      color: certIdInput.trim() && !isLoading ? "#fff" : "#9ca3af",
                      boxShadow: certIdInput.trim() && !isLoading ? "0 4px 16px rgba(34,197,94,0.30)" : "none",
                      cursor: certIdInput.trim() && !isLoading ? "pointer" : "not-allowed",
                      transition: "all 0.2s cubic-bezier(0.16,1,0.3,1)",
                    }}
                  >
                    {isLoading ? (
                      <span className="material-symbols-outlined animate-spin text-lg">progress_activity</span>
                    ) : (
                      <>
                        <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>
                        Verify
                      </>
                    )}
                  </button>
                </div>
              </form>
            ) : (
              <div
                className="relative"
                style={{
                  borderRadius: "0.875rem",
                  background: "#fafcfa",
                  border: isFocused ? "1.5px solid #52b788" : "1.5px solid #e5ebe5",
                  boxShadow: isFocused
                    ? "0 0 0 4px rgba(82,183,136,0.12)"
                    : "none",
                  transition: "border-color 0.2s,box-shadow 0.2s",
                }}
              >
                <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none">
                  {isSearching ? (
                    <div className="w-5 h-5 rounded-full border-2 animate-spin" style={{ borderColor: "rgba(82,183,136,0.2)", borderTopColor: "#52b788" }} />
                  ) : (
                    <span className="material-symbols-outlined text-lg" style={{ color: "#52b788" }}>person_search</span>
                  )}
                </div>
                <input
                  ref={inputRef}
                  type="text"
                  value={nameInput}
                  onChange={handleNameInput}
                  onFocus={() => setIsFocused(true)}
                  onBlur={() => setIsFocused(false)}
                  placeholder="Type your full name..."
                  className="w-full bg-transparent text-brand-dark-green placeholder-gray-400 outline-none pl-11 pr-10 py-3.5 text-sm"
                  style={{ caretColor: "#52b788", fontFamily: "Poppins, sans-serif" }}
                  aria-label="Search certificate by name"
                  autoComplete="off"
                />
                {nameInput && (
                  <button
                    onClick={() => { setNameInput(""); setNameResults([]); setHasSearched(false); setSearchError(null); inputRef.current?.focus(); }}
                    aria-label="Clear"
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full flex items-center justify-center cursor-pointer transition-colors"
                    style={{ background: "#f3f4f6", color: "#52b788" }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "#dcfce7")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "#f3f4f6")}
                  >
                    <span className="material-symbols-outlined text-sm">close</span>
                  </button>
                )}
              </div>
            )}

            {/* Status hint */}
            <div className="mt-2.5 h-4">
              {mode === "name" && !hasSearched && !isSearching && (
                <span className="text-[11px] text-gray-400">Enter at least 2 characters to search</span>
              )}
              {mode === "name" && hasSearched && nameResults.length > 0 && !isSearching && (
                <span className="text-[11px] text-brand-grass-green font-medium">
                  {nameResults.length} result{nameResults.length !== 1 ? "s" : ""} · click a card to verify
                </span>
              )}
            </div>

            {/* How-to guide */}
            <div className="mt-4 pt-4 border-t border-gray-100">
              <div className="flex flex-wrap gap-x-6 gap-y-2.5">
                {[
                  { icon: "database", text: "Select a database (optional)" },
                  { icon: mode === "id" ? "badge" : "person_search", text: mode === "id" ? "Enter your certificate ID" : "Type your full name" },
                  { icon: "verified", text: mode === "id" ? "Click Verify to confirm" : "Click a result to verify" },
                ].map(({ icon, text }, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span
                      className="text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-white"
                      style={{
                        background: "linear-gradient(135deg,#22c55e,#16a34a)",
                        boxShadow: "0 1px 4px rgba(34,197,94,0.30)",
                      }}
                    >
                      {i + 1}
                    </span>
                    <span className="material-symbols-outlined text-sm text-brand-grass-green" style={{ fontVariationSettings: "'FILL' 1" }}>{icon}</span>
                    <span className="text-[11px] text-gray-600">{text}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── Name search results ── */}
        {mode === "name" && (
          <div className="mt-6">
            {isSearching && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {[0, 1, 2].map((i) => <SkeletonCard key={i} delay={i * 80} />)}
              </div>
            )}

            {!isSearching && searchError && (
              <div className="text-center py-10">
                <div className="w-12 h-12 rounded-2xl mx-auto mb-4 flex items-center justify-center" style={{ background: "#fef2f2", border: "1px solid #fecaca" }}>
                  <span className="material-symbols-outlined text-red-500" style={{ fontVariationSettings: "'FILL' 1" }}>error</span>
                </div>
                <p className="text-red-600 text-sm">{searchError}</p>
              </div>
            )}

            {showEmpty && (
              <div className="text-center py-12" style={{ animation: "slideUpFade 0.35s ease both" }}>
                <div className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center" style={{ background: "#f3f7f3", border: "1px solid #e5ebe5" }}>
                  <span className="material-symbols-outlined text-2xl" style={{ color: "#52b788" }}>search_off</span>
                </div>
                <p className="text-sm mb-1 text-gray-700">
                  No certificates found for{" "}
                  <span className="text-brand-grass-green font-medium">"{nameInput}"</span>
                </p>
                <p className="text-xs text-gray-400">Try a different name or check spelling</p>
              </div>
            )}

            {showResults && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {nameResults.map((r, i) => (
                  <ResultCard key={r.id} result={r} index={i} onSelect={handleResultSelect} />
                ))}
              </div>
            )}

            {showIdle && <IdlePlaceholder />}
          </div>
        )}
      </div>
    </section>
  );
}
