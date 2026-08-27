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
