import { describe, it, expect } from "vitest";
import {
  classifyParticipant,
  deriveGenerationSummary,
  jobEffectiveStatus,
  STALE_JOB_MS,
} from "@/lib/generationState";

describe("classifyParticipant", () => {
  it("no certificateId -> needs-cert (undefined or empty string)", () => {
    expect(classifyParticipant({})).toBe("needs-cert");
    expect(classifyParticipant({ certificateId: "" })).toBe("needs-cert");
    expect(classifyParticipant({ certificateId: "   " })).toBe("needs-cert");
  });

  it("certificateId but no driveLink -> needs-pdf", () => {
    expect(classifyParticipant({ certificateId: "2026-PZ-CRS-0001" })).toBe("needs-pdf");
    expect(classifyParticipant({ certificateId: "2026-PZ-CRS-0001", driveLink: "" })).toBe("needs-pdf");
  });

  it("certificateId and driveLink -> complete", () => {
    expect(
      classifyParticipant({ certificateId: "2026-PZ-CRS-0001", driveLink: "https://drive.google.com/file/d/abc/view" })
    ).toBe("complete");
  });

  it("driveLink without a certificateId is still needs-cert", () => {
    expect(classifyParticipant({ driveLink: "https://drive.google.com/file/d/abc/view" })).toBe("needs-cert");
  });

  describe("requirePdf = false (non-linked-sheet databases)", () => {
    it("certificateId with no driveLink -> complete (not needs-pdf)", () => {
      expect(classifyParticipant({ certificateId: "X" }, false)).toBe("complete");
      expect(classifyParticipant({ certificateId: "2026-PZ-CRS-0001", driveLink: "" }, false)).toBe("complete");
    });

    it("still needs-cert when there is no certificateId", () => {
      expect(classifyParticipant({}, false)).toBe("needs-cert");
      expect(classifyParticipant({ certificateId: "   " }, false)).toBe("needs-cert");
    });
  });
});

describe("deriveGenerationSummary", () => {
  it("tallies a mixed roster", () => {
    const summary = deriveGenerationSummary([
      {},                                                                       // needs-cert
      { certificateId: "" },                                                     // needs-cert
      { certificateId: "X" },                                                    // needs-pdf
      { certificateId: "Y", driveLink: "" },                                     // needs-pdf
      { certificateId: "Z", driveLink: "https://drive.google.com/file/d/z/view" }, // complete
    ]);
    expect(summary).toEqual({ needsCert: 2, needsPdf: 2, complete: 1, total: 5 });
  });

  it("empty roster -> all zeroes", () => {
    expect(deriveGenerationSummary([])).toEqual({ needsCert: 0, needsPdf: 0, complete: 0, total: 0 });
  });

  it("requirePdf = false tallies a needs-pdf-looking participant as complete", () => {
    const summary = deriveGenerationSummary(
      [
        {},                              // needs-cert
        { certificateId: "X" },          // would be needs-pdf, now complete
        { certificateId: "Y", driveLink: "" }, // would be needs-pdf, now complete
        { certificateId: "Z", driveLink: "https://drive.google.com/file/d/z/view" }, // complete
      ],
      false
    );
    expect(summary).toEqual({ needsCert: 1, needsPdf: 0, complete: 3, total: 4 });
  });
});

describe("jobEffectiveStatus", () => {
  const base = Date.parse("2026-08-29T12:00:00.000Z");

  it("a fresh running job stays running", () => {
    expect(
      jobEffectiveStatus({ status: "running", startedAt: new Date(base - 60_000).toISOString() }, base)
    ).toBe("running");
  });

  it("a running job older than STALE_JOB_MS reads as interrupted", () => {
    expect(
      jobEffectiveStatus({ status: "running", startedAt: new Date(base - STALE_JOB_MS - 1).toISOString() }, base)
    ).toBe("interrupted");
  });

  it("an explicitly interrupted job stays interrupted regardless of age", () => {
    expect(
      jobEffectiveStatus({ status: "interrupted", startedAt: new Date(base - 60_000).toISOString() }, base)
    ).toBe("interrupted");
  });

  it("a missing or unparseable startedAt reads as interrupted", () => {
    expect(jobEffectiveStatus({ status: "running" }, base)).toBe("interrupted");
    expect(jobEffectiveStatus({ status: "running", startedAt: "not-a-date" }, base)).toBe("interrupted");
  });
});
