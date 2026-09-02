import { describe, it, expect } from "vitest";
import { resolveManagedField, buildHeaderMap, MANAGED_LABELS } from "@/lib/sheetSchema";

describe("resolveManagedField", () => {
  it("maps canonical labels", () => {
    expect(resolveManagedField("Name")).toBe("name");
    expect(resolveManagedField("Certificate ID")).toBe("certificateId");
    expect(resolveManagedField("Drive Link")).toBe("driveLink");
    expect(resolveManagedField("Emailed")).toBe("emailSent");
  });
  it("is case- and whitespace-insensitive and strips a trailing *", () => {
    expect(resolveManagedField("  email address ")).toBe("email");
    expect(resolveManagedField("EMAIL")).toBe("email");
    expect(resolveManagedField("Name*")).toBe("name");
    expect(resolveManagedField("issue  date")).toBe("issueDate");
  });
  it("resolves known aliases", () => {
    expect(resolveManagedField("Recipient Name")).toBe("name");
    expect(resolveManagedField("Cert ID")).toBe("certificateId");
    expect(resolveManagedField("Date Issued")).toBe("issueDate");
    expect(resolveManagedField("Email Sent")).toBe("emailSent");
    expect(resolveManagedField("Verification URL")).toBe("certificateUrl");
  });
  it("returns null for custom columns", () => {
    expect(resolveManagedField("Designation/Role")).toBeNull();
    expect(resolveManagedField("Start Date")).toBeNull();
    expect(resolveManagedField("Department")).toBeNull();
    expect(resolveManagedField("")).toBeNull();
  });
});

describe("buildHeaderMap", () => {
  it("maps the user's hand-built layout: blank, Name, Email, then customs", () => {
    const map = buildHeaderMap(["", "Name", "Email", "Designation/Role", "Start Date", "Department"]);
    expect(map.managed).toEqual({ name: 1, email: 2 });
    expect(map.custom).toEqual({ "Designation/Role": 3, "Start Date": 4, "Department": 5 });
  });
  it("maps the standard 9-column layout", () => {
    const map = buildHeaderMap([
      "Certificate ID", "Name", "Email", "Certificate URL", "Status",
      "Issue Date", "Emailed", "Drive Link", "Created At",
    ]);
    expect(map.managed).toEqual({
      certificateId: 0, name: 1, email: 2, certificateUrl: 3, status: 4,
      issueDate: 5, emailSent: 6, driveLink: 7, createdAt: 8,
    });
    expect(map.custom).toEqual({});
  });
  it("first column wins on a duplicate header; blanks are skipped", () => {
    const map = buildHeaderMap(["Name", "Name", "", "Score"]);
    expect(map.managed.name).toBe(0);
    expect(map.custom).toEqual({ Score: 3 });
  });
  it("MANAGED_LABELS covers every managed field", () => {
    expect(Object.keys(MANAGED_LABELS).sort()).toEqual(
      ["certificateId","certificateUrl","createdAt","driveLink","email","emailSent","issueDate","name","status"]
    );
  });
});
