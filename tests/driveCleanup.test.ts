import { describe, it, expect } from "vitest";
import { fileIdFromLink, resolveDriveFileId } from "@/lib/driveCleanup";

describe("fileIdFromLink", () => {
  it("parses the /file/d/<id>/ share link shape", () => {
    expect(
      fileIdFromLink("https://drive.google.com/file/d/1AbC-dEf_2GhI/view?usp=sharing")
    ).toBe("1AbC-dEf_2GhI");
  });

  it("parses the ?id=<id> shape", () => {
    expect(
      fileIdFromLink("https://drive.google.com/uc?id=1AbC-dEf_2GhI&export=download")
    ).toBe("1AbC-dEf_2GhI");
  });

  it("parses the real stored share link shape (?usp=drivesdk)", () => {
    expect(
      fileIdFromLink("https://drive.google.com/file/d/1Abc-DEF_ghi/view?usp=drivesdk")
    ).toBe("1Abc-DEF_ghi");
  });

  it("returns null for a folder URL (no file id to extract)", () => {
    expect(fileIdFromLink("https://drive.google.com/drive/folders/1Xyz")).toBeNull();
  });

  it("returns null for junk or empty input", () => {
    expect(fileIdFromLink("")).toBeNull();
    expect(fileIdFromLink(null)).toBeNull();
    expect(fileIdFromLink(undefined)).toBeNull();
    expect(fileIdFromLink("https://example.com/nope")).toBeNull();
  });
});

describe("resolveDriveFileId", () => {
  it("prefers the stored driveFileId over the link", () => {
    expect(
      resolveDriveFileId({ driveFileId: "STORED_ID", driveLink: "https://drive.google.com/file/d/LINK_ID/view" })
    ).toBe("STORED_ID");
  });

  it("falls back to parsing the /file/d/<id>/view link", () => {
    expect(
      resolveDriveFileId({ driveLink: "https://drive.google.com/file/d/1Abc-DEF_ghi/view?usp=drivesdk" })
    ).toBe("1Abc-DEF_ghi");
  });

  it("falls back to parsing the ?id=<id> link", () => {
    expect(
      resolveDriveFileId({ driveLink: "https://drive.google.com/uc?id=1Abc-DEF_ghi&export=download" })
    ).toBe("1Abc-DEF_ghi");
  });

  it("returns null when there is nothing usable", () => {
    expect(resolveDriveFileId({})).toBeNull();
    expect(resolveDriveFileId({ driveFileId: "", driveLink: "" })).toBeNull();
    expect(resolveDriveFileId({ driveLink: "https://drive.google.com/drive/folders/1Xyz" })).toBeNull();
  });
});
