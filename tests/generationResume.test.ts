import { describe, it, expect } from "vitest";
import { remainingToGenerate } from "@/lib/generationResume";

describe("remainingToGenerate", () => {
  const ps = [
    { id: "a", certificateId: "" },
    { id: "b", certificateId: "" },
    { id: "c", certificateId: "PZ-2026-DEADBEEF" }, // already has a cert
    { id: "d", certificateId: "" },
  ];

  it("excludes completed ids and participants that already hold a certificateId", () => {
    expect(remainingToGenerate(ps, ["a"])).toEqual(["b", "d"]);
  });

  it("returns everything eligible when nothing is completed", () => {
    expect(remainingToGenerate(ps, [])).toEqual(["a", "b", "d"]);
  });

  it("returns [] when all are done", () => {
    expect(remainingToGenerate(ps, ["a", "b", "d"])).toEqual([]);
  });

  it("ignores participants without an id", () => {
    expect(remainingToGenerate([{ id: undefined, certificateId: "" }], [])).toEqual([]);
  });
});
