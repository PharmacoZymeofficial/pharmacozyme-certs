import { describe, it, expect, vi, beforeEach } from "vitest";

// Observe the collaborators without touching Firestore / the Apps Script bridge.
const mocks = vi.hoisted(() => ({
  getAdminDb: vi.fn(),
  deleteDriveFile: vi.fn(),
  fileIdFromLink: vi.fn(),
  callAppsScript: vi.fn(),
  appsScriptConfigured: vi.fn(),
}));

vi.mock("@/lib/firebase.admin", () => ({ getAdminDb: mocks.getAdminDb }));
vi.mock("@/lib/driveCleanup", () => ({
  deleteDriveFile: mocks.deleteDriveFile,
  fileIdFromLink: mocks.fileIdFromLink,
}));
vi.mock("@/lib/appsScript", () => ({
  callAppsScript: mocks.callAppsScript,
  appsScriptConfigured: mocks.appsScriptConfigured,
}));

import { deleteCertificateCascade } from "@/lib/certCascade";

type BuildOpts = {
  certData: Record<string, unknown>;
  participantExists?: boolean;
  participantData?: Record<string, unknown>;
  dbData?: Record<string, unknown>;
};

/** A hand-built fake matching exactly the call chain deleteCertificateCascade walks. */
function buildDb(opts: BuildOpts, calls: string[]) {
  const certRef = {
    delete: vi.fn(async () => {
      calls.push("cert.delete");
    }),
  };
  const certDoc = {
    exists: true,
    id: "certDoc1",
    data: () => opts.certData,
    ref: certRef,
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- typed so mock.calls[0][0] narrows
  const participantUpdate = vi.fn(async (payload: Record<string, unknown>) => {
    calls.push("participant.update");
  });
  const pRef = {
    get: async () => ({
      exists: opts.participantExists ?? true,
      data: () => opts.participantData ?? {},
    }),
    update: participantUpdate,
  };

  const dbDocSnap = { exists: true, data: () => opts.dbData ?? {} };

  const db = {
    collection: (name: string) => {
      if (name === "certificates") {
        return {
          doc: () => ({ get: async () => certDoc }),
          where: () => ({ get: async () => ({ docs: [certDoc] }) }),
        };
      }
      if (name === "databases") {
        return {
          doc: () => ({
            get: async () => dbDocSnap,
            collection: () => ({ doc: () => pRef }),
          }),
        };
      }
      throw new Error(`unexpected collection: ${name}`);
    },
  };

  return { db, certRef, participantUpdate };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.deleteDriveFile.mockResolvedValue(true);
  mocks.fileIdFromLink.mockReturnValue(null);
  mocks.callAppsScript.mockResolvedValue({ success: true });
  mocks.appsScriptConfigured.mockReturnValue(true);
});

describe("deleteCertificateCascade", () => {
  it("resets the participant BEFORE deleting the cert doc", async () => {
    const calls: string[] = [];
    const { db } = buildDb(
      {
        certData: { databaseId: "db1", participantId: "p1", driveFileId: "file-1" },
        participantData: { email: "a@b.com" },
        dbData: { sheetId: "sheet-1" },
      },
      calls
    );
    mocks.getAdminDb.mockReturnValue(db);

    const res = await deleteCertificateCascade({ uniqueCertId: "PZ-1" });

    expect(calls).toEqual(["participant.update", "cert.delete"]);
    expect(res.participantCleared).toBe(true);
    expect(res.deletedCertDocs).toBe(1);
  });

  it("clearParticipant:false skips the participant .update entirely", async () => {
    const calls: string[] = [];
    const { db, participantUpdate } = buildDb(
      { certData: { databaseId: "db1", participantId: "p1", driveFileId: "file-1" } },
      calls
    );
    mocks.getAdminDb.mockReturnValue(db);

    const res = await deleteCertificateCascade({
      uniqueCertId: "PZ-1",
      clearParticipant: false,
    });

    expect(participantUpdate).not.toHaveBeenCalled();
    expect(calls).toEqual(["cert.delete"]);
    expect(res.participantCleared).toBe(false);
  });

  it("deleteDriveFile:false — no Drive delete, and PDF pointers stay in the reset payload", async () => {
    const calls: string[] = [];
    const { db, participantUpdate } = buildDb(
      {
        certData: { databaseId: "db1", participantId: "p1", driveFileId: "file-1" },
        participantData: { email: "a@b.com" },
      },
      calls
    );
    mocks.getAdminDb.mockReturnValue(db);

    const res = await deleteCertificateCascade({
      uniqueCertId: "PZ-1",
      deleteDriveFile: false,
    });

    expect(mocks.deleteDriveFile).not.toHaveBeenCalled();
    expect(res.driveFileDeleted).toBe(false);

    const payload = participantUpdate.mock.calls[0][0];
    expect(payload).not.toHaveProperty("driveLink");
    expect(payload).not.toHaveProperty("driveFileId");
    expect(payload.certificateId).toBe("");
    expect(payload.certificateUrl).toBe("");
    expect(payload.verificationUrl).toBe("");
    expect(payload.status).toBe("pending");
  });

  it("default path deletes the Drive file by driveFileId when present", async () => {
    const calls: string[] = [];
    const { db } = buildDb(
      { certData: { driveFileId: "file-abc", driveLink: "https://drive/x" } },
      calls
    );
    mocks.getAdminDb.mockReturnValue(db);

    await deleteCertificateCascade({ uniqueCertId: "PZ-1" });

    expect(mocks.deleteDriveFile).toHaveBeenCalledTimes(1);
    expect(mocks.deleteDriveFile).toHaveBeenCalledWith("file-abc");
  });

  it("default path falls back to fileIdFromLink(driveLink) when no driveFileId", async () => {
    const calls: string[] = [];
    const { db } = buildDb(
      { certData: { driveLink: "https://drive.google.com/file/d/parsed-id/view" } },
      calls
    );
    mocks.getAdminDb.mockReturnValue(db);
    mocks.fileIdFromLink.mockReturnValue("parsed-id");

    await deleteCertificateCascade({ uniqueCertId: "PZ-1" });

    expect(mocks.deleteDriveFile).toHaveBeenCalledWith("parsed-id");
  });

  it("puts emailSent:false in the participant reset payload", async () => {
    const calls: string[] = [];
    const { db, participantUpdate } = buildDb(
      {
        certData: { databaseId: "db1", participantId: "p1", driveFileId: "file-1" },
        participantData: { email: "a@b.com" },
      },
      calls
    );
    mocks.getAdminDb.mockReturnValue(db);

    await deleteCertificateCascade({ uniqueCertId: "PZ-1" });

    const payload = participantUpdate.mock.calls[0][0];
    expect(payload.emailSent).toBe(false);
    expect(payload.driveLink).toBe("");
    expect(payload.driveFileId).toBe("");
  });

  it("reports driveFileDeleted:false when the bridge reports failure", async () => {
    const calls: string[] = [];
    const { db } = buildDb({ certData: { driveFileId: "file-abc" } }, calls);
    mocks.getAdminDb.mockReturnValue(db);
    mocks.deleteDriveFile.mockResolvedValue(false);

    const res = await deleteCertificateCascade({ uniqueCertId: "PZ-1" });

    expect(res.driveFileDeleted).toBe(false);
  });
});
