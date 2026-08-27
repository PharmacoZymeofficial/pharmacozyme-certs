import { describe, it, expect } from "vitest";
import { fileIdFromLink } from "@/lib/driveCleanup";

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
