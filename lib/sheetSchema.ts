/**
 * The single definition of which Google-Sheet columns the app manages vs. which
 * are free-form custom fields. Used by the sheet-sync route and CSV import so the
 * managed/custom split lives in exactly one place. A hand-kept JS port of
 * `normalizeHeader` + `resolveManagedField` also lives in `apps-script.js` — keep
 * the two in sync (the alias table below is the source of truth).
 *
 * Pure module: no imports.
 */

export const MANAGED_FIELDS = [
  "name", "email", "certificateId", "certificateUrl",
  "status", "issueDate", "emailSent", "driveLink", "createdAt",
] as const;
export type ManagedField = (typeof MANAGED_FIELDS)[number];

/** The header label the app writes when it has to CREATE a managed column. */
export const MANAGED_LABELS: Record<ManagedField, string> = {
  name: "Name",
  email: "Email",
  certificateId: "Certificate ID",
  certificateUrl: "Certificate URL",
  status: "Status",
  issueDate: "Issue Date",
  emailSent: "Emailed",
  driveLink: "Drive Link",
  createdAt: "Created At",
};

/** normalized header text -> managed field. Every canonical label is included. */
const ALIASES: Record<string, ManagedField> = {
  "name": "name",
  "recipient name": "name",
  "recipient": "name",
  "full name": "name",
  "email": "email",
  "email address": "email",
  "active email address": "email",
  "e-mail": "email",
  "mail": "email",
  "certificate id": "certificateId",
  "certificateid": "certificateId",
  "cert id": "certificateId",
  "certificate no": "certificateId",
  "certificate number": "certificateId",
  "certificate url": "certificateUrl",
  "certificate link": "certificateUrl",
  "verification url": "certificateUrl",
  "verify url": "certificateUrl",
  "status": "status",
  "issue date": "issueDate",
  "issuedate": "issueDate",
  "issued": "issueDate",
  "date issued": "issueDate",
  "issued on": "issueDate",
  "emailed": "emailSent",
  "email sent": "emailSent",
  "email status": "emailSent",
  "drive link": "driveLink",
  "drive url": "driveLink",
  "pdf link": "driveLink",
  "certificate pdf": "driveLink",
  "created at": "createdAt",
  "created": "createdAt",
  "date created": "createdAt",
};

export function normalizeHeader(h: string): string {
  return String(h ?? "")
    .replace(/\*+$/, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

export function resolveManagedField(h: string): ManagedField | null {
  const n = normalizeHeader(h);
  if (!n) return null;
  return Object.prototype.hasOwnProperty.call(ALIASES, n) ? ALIASES[n] : null;
}

/**
 * Split one imported CSV/Excel row (header -> cell value) into managed fields and
 * free-form custom fields, using the exact same header resolution as the Google
 * Sheets sync path. A header the app doesn't recognize (`resolveManagedField`
 * returns null) becomes a `customFields` entry keyed by its trimmed header text.
 *
 * - Managed values: first non-empty value wins (matches `buildHeaderMap` order).
 * - Custom values: trimmed; empty cells are dropped.
 */
export function splitImportedRow(row: Record<string, unknown>): {
  fields: Partial<Record<ManagedField, string>>;
  customFields: Record<string, string>;
} {
  const fields: Partial<Record<ManagedField, string>> = {};
  const customFields: Record<string, string> = {};

  for (const [rawKey, rawVal] of Object.entries(row ?? {})) {
    const header = String(rawKey ?? "").trim();
    if (!header) continue;
    const value = rawVal === undefined || rawVal === null ? "" : String(rawVal).trim();

    const mf = resolveManagedField(header);
    if (mf) {
      if (!fields[mf] && value) fields[mf] = value;
    } else if (value) {
      customFields[header] = value;
    }
  }

  return { fields, customFields };
}

export function buildHeaderMap(headerRow: unknown[]): {
  managed: Partial<Record<ManagedField, number>>;
  custom: Record<string, number>;
} {
  const managed: Partial<Record<ManagedField, number>> = {};
  const custom: Record<string, number> = {};
  headerRow.forEach((raw, i) => {
    const header = String(raw ?? "").trim();
    if (!header) return;
    const mf = resolveManagedField(header);
    if (mf) {
      if (managed[mf] === undefined) managed[mf] = i;
    } else if (custom[header] === undefined) {
      custom[header] = i;
    }
  });
  return { managed, custom };
}

/**
 * Case-insensitive, trim-tolerant lookup of a bound custom-field value.
 * Used by the certificate renderer and the pre-generation "missing values"
 * check so a template's sourceField matches a sheet/CSV header regardless of
 * capitalisation or surrounding whitespace.
 */
export function lookupBoundValue(
  values: Record<string, string> | undefined | null,
  sourceField: string | undefined | null
): string {
  if (!values || !sourceField) return "";
  const want = normalizeHeader(sourceField);
  if (!want) return "";
  for (const key of Object.keys(values)) {
    if (normalizeHeader(key) === want) return values[key] ?? "";
  }
  return "";
}
