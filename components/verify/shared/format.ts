export const AVATAR_GRADIENTS = [
  "linear-gradient(135deg,#52b788,#1b4332)",
  "linear-gradient(135deg,#40916c,#1b4332)",
  "linear-gradient(135deg,#22c55e,#166534)",
  "linear-gradient(135deg,#4ade80,#15803d)",
  "linear-gradient(135deg,#86efac,#166534)",
  "linear-gradient(135deg,#34d399,#065f46)",
];

export function avatarGradient(name: string) {
  return AVATAR_GRADIENTS[(name.charCodeAt(0) || 0) % AVATAR_GRADIENTS.length];
}

export function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase();
}

export function fmtDate(d: string) {
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
