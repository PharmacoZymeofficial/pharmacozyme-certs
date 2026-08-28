import { describe, it, expect } from "vitest";
import { tallyEmailOutcomes } from "@/lib/emailOutcome";

describe("tallyEmailOutcomes", () => {
  it("counts sent, failed, queued distinctly", () => {
    expect(
      tallyEmailOutcomes([
        { email: "a@x.com", ok: true },
        { email: "b@x.com", ok: false, error: "550 rejected" },
        { email: "c@x.com", ok: false, queued: true },
        { email: "d@x.com", ok: true },
      ])
    ).toEqual({ sent: 2, failed: 1, queued: 1 });
  });

  it("a queued recipient is never also counted as failed", () => {
    const t = tallyEmailOutcomes([{ email: "a@x.com", ok: false, queued: true }]);
    expect(t.failed).toBe(0);
    expect(t.queued).toBe(1);
  });

  it("empty input is all zeros", () => {
    expect(tallyEmailOutcomes([])).toEqual({ sent: 0, failed: 0, queued: 0 });
  });
});
