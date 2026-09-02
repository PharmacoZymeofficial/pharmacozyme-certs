import { describe, it, expect } from "vitest";
import { buildKeepFileIds } from "@/lib/drivePrune";

describe("buildKeepFileIds", () => {
  it("collects stored driveFileId values", () => {
    expect(
      buildKeepFileIds([{ driveFileId: "A" }, { driveFileId: "B" }])
    ).toEqual(["A", "B"]);
  });

  it("falls back to parsing driveLink when driveFileId is absent", () => {
    expect(
      buildKeepFileIds([
        { driveLink: "https://drive.google.com/file/d/LINK_ID/view?usp=drivesdk" },
      ])
    ).toEqual(["LINK_ID"]);
  });

  it("dedupes ids shared by more than one participant record", () => {
    expect(
      buildKeepFileIds([
        { driveFileId: "DUP" },
        { driveFileId: "DUP" },
        { driveLink: "https://drive.google.com/file/d/DUP/view" },
      ])
    ).toEqual(["DUP"]);
  });

  it("skips participants with no usable file id", () => {
    expect(
      buildKeepFileIds([
        { driveFileId: "KEEP" },
        {},
        { driveFileId: "", driveLink: "" },
        { driveLink: "https://drive.google.com/drive/folders/NOT_A_FILE" },
      ])
    ).toEqual(["KEEP"]);
  });

  it("returns an empty array when nothing is linked (caller must refuse to prune)", () => {
    expect(buildKeepFileIds([{}, { driveFileId: "" }])).toEqual([]);
  });
});
