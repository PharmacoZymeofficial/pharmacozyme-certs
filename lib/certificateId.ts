import { v4 as uuidv4 } from "uuid";

/**
 * Canonical certificate ID: `PZ-{year}-{8 hex chars}`.
 *
 * Kept in one place because the two mint sites had drifted: the generate route used 8
 * characters while the CSV import route still used 4 (`uuidv4().slice(0, 4)`), which is
 * only 65k values — a birthday collision becomes likely in the low hundreds of imports.
 */
export function newCertificateId(year: number = new Date().getFullYear()): string {
  return `PZ-${year}-${uuidv4().split("-")[0].toUpperCase()}`;
}

/** Cosmetic integrity hash shown on the certificate. Not an actual blockchain. */
export function newBlockchainHash(): string {
  return `0x${uuidv4().replace(/-/g, "")}`;
}

/**
 * Certificate IDs are compared case-insensitively. Storing a normalized copy lets
 * verification do one indexed lookup instead of scanning every database's participants
 * subcollection across four case variants.
 */
export function normalizeCertId(id: string): string {
  return (id || "").trim().toUpperCase();
}

/**
 * Bumps the trailing serial of a custom (non-UUID) certificate ID, e.g.
 * `PZ-MDC-B3-001` -> `PZ-MDC-B3-002`, preserving zero-padding width. Falls back to
 * an appended `-2` when the trailing segment isn't numeric.
 */
export function bumpCertificateSerial(id: string): string {
  const parts = id.split("-");
  const last = parts[parts.length - 1];
  const num = parseInt(last, 10);
  if (Number.isNaN(num)) return `${id}-2`;
  parts[parts.length - 1] = String(num + 1).padStart(last.length, "0");
  return parts.join("-");
}

/**
 * Resolves a batch of candidate certificate IDs against IDs already claimed
 * elsewhere, bumping the trailing serial past any collision.
 *
 * `takenBy` maps a certificate ID to the doc path that currently owns it (fetched
 * from Firestore before calling this). A candidate is only bumped when it's claimed
 * by a DIFFERENT owner path than the one requesting it — so a participant keeping
 * its own existing ID is never treated as a self-collision. `takenBy` is mutated in
 * place so collisions created earlier in the same batch are seen by later entries.
 *
 * Root cause this guards against: ID generation used to check uniqueness only
 * within the database being edited, so two databases minting IDs with the same
 * course prefix (e.g. two cert batches for one course) could independently start
 * numbering at 001 and collide — see the 2026-09-13 COE-MDC3/COP-MDC3 incident.
 */
export function resolveUniqueCertificateIds(
  entries: { ownerPath: string; certificateId: string }[],
  takenBy: Map<string, string>
): Map<string, string> {
  const resolved = new Map<string, string>();
  for (const { ownerPath, certificateId } of entries) {
    let candidate = certificateId;
    while (takenBy.has(candidate) && takenBy.get(candidate) !== ownerPath) {
      candidate = bumpCertificateSerial(candidate);
    }
    takenBy.set(candidate, ownerPath);
    resolved.set(ownerPath, candidate);
  }
  return resolved;
}
