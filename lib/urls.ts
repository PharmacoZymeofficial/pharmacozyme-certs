/**
 * Canonical certificate URL builders.
 *
 * Three different shapes were previously in circulation, one of which 404s:
 *   - `/verify/{id}`      — minted by the old generate route; NO such route existed
 *   - `/verify?certId=`   — what app/verify/page.tsx actually reads
 *   - `/claim?id=`        — what the client-side generator encodes into QR codes
 *
 * Everything now goes through these helpers so the shapes cannot drift apart again.
 */

export function baseUrl(): string {
  return (process.env.NEXT_PUBLIC_BASE_URL || "https://cert.pharmacozyme.com").replace(/\/+$/, "");
}

/** Public verification page for a certificate. This is what QR codes encode. */
export function buildVerificationUrl(certId: string): string {
  return `${baseUrl()}/verify?certId=${encodeURIComponent(certId)}`;
}

/** Recipient-facing certificate page (claim/download view). */
export function buildCertificateUrl(certId: string): string {
  return `${baseUrl()}/certificate?certId=${encodeURIComponent(certId)}`;
}
