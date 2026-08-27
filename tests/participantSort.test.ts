import { describe, it, expect } from "vitest";
import { sortParticipantsForSheet, legacySerial } from "@/lib/participantSort";

const at = (iso: string) => new Date(iso).toISOString();

describe("participant sheet ordering", () => {
  it("orders current hex ids by createdAt, not by a trailing digit", () => {
    // The old getSerial returned 0 for all three of these, so ordering was arbitrary.
    const rows = [
      { name: "Third", certificateId: "PZ-2026-A1B2C3D4", createdAt: at("2026-03-01") },
      { name: "First", certificateId: "PZ-2026-FFFFAAAA", createdAt: at("2026-01-01") },
      { name: "Second", certificateId: "PZ-2026-0000BBBB", createdAt: at("2026-02-01") },
    ];

    expect(sortParticipantsForSheet(rows).map((r) => r.name)).toEqual(["First", "Second", "Third"]);
  });

  it("still honours legacy trailing-serial ids", () => {
    const rows = [
      { name: "C", certificateId: "Hamza-MDC-003", createdAt: at("2026-01-01") },
      { name: "A", certificateId: "Hamza-MDC-001", createdAt: at("2026-06-01") },
      { name: "B", certificateId: "Hamza-MDC-002", createdAt: at("2026-03-01") },
    ];

    expect(sortParticipantsForSheet(rows).map((r) => r.name)).toEqual(["A", "B", "C"]);
  });

  it("sinks rows with no usable timestamp to the bottom", () => {
    const rows = [
      { name: "NoDate", certificateId: "PZ-2026-AAAAAAAA" },
      { name: "Dated", certificateId: "PZ-2026-BBBBBBBB", createdAt: at("2026-01-01") },
      { name: "BadDate", certificateId: "PZ-2026-CCCCCCCC", createdAt: "not-a-date" },
    ];

    expect(sortParticipantsForSheet(rows)[0].name).toBe("Dated");
  });

  it("does not mutate the input array", () => {
    const rows = [
      { name: "B", createdAt: at("2026-02-01") },
      { name: "A", createdAt: at("2026-01-01") },
    ];
    const copy = [...rows];
    sortParticipantsForSheet(rows);
    expect(rows).toEqual(copy);
  });

  it("extracts legacy serials only when present", () => {
    expect(legacySerial("Hamza-MDC-001")).toBe(1);
    expect(legacySerial(undefined)).toBeNull();
    expect(legacySerial("")).toBeNull();
  });

  it("does not mistake a current hex id for a legacy serial", () => {
    // The old regex pulled the trailing "4" out of this and sorted on it.
    expect(legacySerial("PZ-2026-A1B2C3D4")).toBeNull();
    // ...and tied every id ending in a letter at 0.
    expect(legacySerial("PZ-2026-A1B2C3DA")).toBeNull();
    // An all-digit hex block is still a current id, not a serial.
    expect(legacySerial("PZ-2026-12345678")).toBeNull();
  });
});
