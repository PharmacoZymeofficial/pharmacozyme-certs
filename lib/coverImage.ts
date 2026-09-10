import type { Database } from "@/lib/types";

export const COVER_W = 1600;
export const COVER_H = 900;
const RATIO = 16 / 9;

/**
 * The source rectangle to sample so that drawing it into a 16:9 target
 * produces a center crop (no distortion, no letterboxing).
 */
export function centerCrop16x9(
  srcW: number,
  srcH: number
): { sx: number; sy: number; sw: number; sh: number } {
  const srcRatio = srcW / srcH;
  if (srcRatio > RATIO) {
    // too wide — full height, crop the sides
    const sw = srcH * RATIO;
    return { sx: (srcW - sw) / 2, sy: 0, sw, sh: srcH };
  }
  if (srcRatio < RATIO) {
    // too tall — full width, crop top/bottom
    const sh = srcW / RATIO;
    return { sx: 0, sy: (srcH - sh) / 2, sw: srcW, sh };
  }
  return { sx: 0, sy: 0, sw: srcW, sh: srcH };
}

/**
 * URL for the public cover-serving proxy, cache-busted by the last write.
 * null when the database has no cover — callers render the icon/gradient
 * fallback instead.
 */
export function coverUrl(
  db: Pick<Database, "id" | "coverImageId" | "coverUpdatedAt">
): string | null {
  if (!db.id || !db.coverImageId) return null;
  return `/api/databases/${db.id}/cover?v=${encodeURIComponent(db.coverUpdatedAt ?? "")}`;
}
