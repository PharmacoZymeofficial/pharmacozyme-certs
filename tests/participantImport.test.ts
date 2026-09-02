import { describe, it, expect } from "vitest";
import { splitImportedRow } from "@/lib/sheetSchema";

describe("splitImportedRow", () => {
  it("keeps unknown columns as custom, keyed by exact header", () => {
    const { customFields } = splitImportedRow({
      Name: "A",
      Email: "b@c.d",
      Designation: "Lead",
      "Start Date": "2025",
    });
    expect(customFields).toEqual({ Designation: "Lead", "Start Date": "2025" });
  });

  it("routes managed headers (incl. aliases) into fields, not customFields", () => {
    const { fields, customFields } = splitImportedRow({
      "Full Name": "Ada Lovelace",
      "Active Email Address": "ada@example.com",
      "Cert ID": "PZ-001",
      "Issue Date": "2025-01-02",
      Department: "R&D",
    });
    expect(fields).toEqual({
      name: "Ada Lovelace",
      email: "ada@example.com",
      certificateId: "PZ-001",
      issueDate: "2025-01-02",
    });
    expect(customFields).toEqual({ Department: "R&D" });
  });

  it("trims values and drops empty custom cells", () => {
    const { fields, customFields } = splitImportedRow({
      Name: "  Bob  ",
      Email: " bob@x.io ",
      Notes: "   ",
      Role: " Speaker ",
    });
    expect(fields.name).toBe("Bob");
    expect(fields.email).toBe("bob@x.io");
    expect(customFields).toEqual({ Role: "Speaker" });
  });

  it("first non-empty value wins for a duplicated managed field", () => {
    const { fields } = splitImportedRow({ Name: "", name: "Grace" });
    expect(fields.name).toBe("Grace");
  });

  it("handles non-string cell values", () => {
    const { fields, customFields } = splitImportedRow({
      Name: "Carl",
      Email: "carl@x.io",
      Score: 42,
    });
    expect(fields.name).toBe("Carl");
    expect(customFields).toEqual({ Score: "42" });
  });
});
