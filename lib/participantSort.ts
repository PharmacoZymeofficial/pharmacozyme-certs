export interface SortableParticipant {
  certificateId?: string;
  createdAt?: string;
  name?: string;
  // Participant docs carry arbitrary extra fields (customFields, driveLink, etc.)
  // that this sort never reads.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

/** Current-format certificate ID, e.g. "PZ-2026-A1B2C3D4". */
const CURRENT_ID_SHAPE = /^PZ-\d{4}-[0-9A-F]{8}$/i;

/**
 * A genuine legacy serial: a final dash/underscore-separated segment that is all digits,
 * as in "Hamza-MDC-001". Returns null for anything else.
 *
 * The previous `getSerial` helper matched any trailing run of decimal digits (`/(\d+)$/`).
 * Applied to a current ID such as "PZ-2026-A1B2C3D4" that picks up the trailing "4", so
 * rows were ordered by whichever digits happened to land at the end of a random hex
 * string, while every ID ending in a letter tied at 0. The result was an arbitrary
 * shuffle, not a sort.
 */
export function legacySerial(id: string | undefined): number | null {
  const value = (id || "").trim();
  if (!value || CURRENT_ID_SHAPE.test(value)) return null;

  const lastSegment = value.split(/[-_]/).pop() || "";
  if (!/^\d+$/.test(lastSegment)) return null;

  return parseInt(lastSegment, 10);
}

/**
 * Row order for Google Sheets writes.
 *
 * Order is `createdAt` ascending — the order participants were added, which is what the
 * sheet is expected to mirror. Genuine legacy serials are honoured first so existing
 * sheets keep their established numbering.
 */
export function sortParticipantsForSheet<T extends SortableParticipant>(participants: T[]): T[] {
  return [...participants].sort((a, b) => {
    const aSerial = legacySerial(a.certificateId);
    const bSerial = legacySerial(b.certificateId);

    // Both use the legacy numbered scheme — preserve that numbering.
    if (aSerial !== null && bSerial !== null && aSerial !== bSerial) {
      return aSerial - bSerial;
    }

    const aTime = a.createdAt ? new Date(a.createdAt).getTime() : NaN;
    const bTime = b.createdAt ? new Date(b.createdAt).getTime() : NaN;
    const aValid = !Number.isNaN(aTime);
    const bValid = !Number.isNaN(bTime);

    // Rows without a usable timestamp sink to the bottom rather than scrambling the rest.
    if (aValid && bValid && aTime !== bTime) return aTime - bTime;
    if (aValid !== bValid) return aValid ? -1 : 1;

    return (a.name || "").localeCompare(b.name || "");
  });
}
