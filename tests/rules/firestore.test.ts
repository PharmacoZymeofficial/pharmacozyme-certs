/**
 * Firestore security rules tests, against the Firestore emulator.
 *
 * These require a JVM (the emulator is Java) and are NOT run by `npm test` --
 * run them explicitly with `npm run test:rules`. They were written and reviewed
 * line-by-line against every Firestore call made by the four client components that
 * still talk to Firestore directly (app/admin/login, app/admin/reports,
 * app/admin/settings, components/AdminSidebar), but could not be executed in the
 * environment this migration was done in (no Java available) -- run them before
 * deploying these rules to production.
 */
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
  RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, updateDoc, deleteDoc, collection, getDocs } from "firebase/firestore";

const SUPER_ADMIN_EMAIL = "pharmacozymeofficial@gmail.com";

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: "pz-certs-rules-test",
    firestore: {
      rules: fs.readFileSync(path.resolve(__dirname, "../../firestore.rules"), "utf8"),
    },
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
});

describe("admins/{uid}", () => {
  it("lets a signed-in user create their own pending admin doc", async () => {
    const alice = testEnv.authenticatedContext("alice", { email: "alice@example.com" }).firestore();
    await assertSucceeds(
      setDoc(doc(alice, "admins", "alice"), {
        email: "alice@example.com",
        displayName: "Alice",
        role: "admin",
        status: "pending",
        createdAt: new Date().toISOString(),
      })
    );
  });

  it("refuses self-registration as super_admin/approved for a non-super-admin email", async () => {
    const alice = testEnv.authenticatedContext("alice", { email: "alice@example.com" }).firestore();
    await assertFails(
      setDoc(doc(alice, "admins", "alice"), {
        email: "alice@example.com",
        displayName: "Alice",
        role: "super_admin",
        status: "approved",
        createdAt: new Date().toISOString(),
      })
    );
  });

  it("lets the super admin email self-register as approved super_admin", async () => {
    const owner = testEnv.authenticatedContext("owner", { email: SUPER_ADMIN_EMAIL }).firestore();
    await assertSucceeds(
      setDoc(doc(owner, "admins", "owner"), {
        email: SUPER_ADMIN_EMAIL,
        displayName: "Owner",
        role: "super_admin",
        status: "approved",
        createdAt: new Date().toISOString(),
      })
    );
  });

  it("refuses a doc where the email field does not match the auth token", async () => {
    const alice = testEnv.authenticatedContext("alice", { email: "alice@example.com" }).firestore();
    await assertFails(
      setDoc(doc(alice, "admins", "alice"), {
        email: SUPER_ADMIN_EMAIL, // spoofed
        displayName: "Alice",
        role: "admin",
        status: "pending",
        createdAt: new Date().toISOString(),
      })
    );
  });

  it("lets a user read their own doc regardless of status", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "admins", "alice"), {
        email: "alice@example.com",
        role: "admin",
        status: "rejected",
      });
    });
    const alice = testEnv.authenticatedContext("alice", { email: "alice@example.com" }).firestore();
    await assertSucceeds(getDoc(doc(alice, "admins", "alice")));
  });

  it("refuses a non-super-admin reading another admin's doc", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "admins", "bob"), {
        email: "bob@example.com",
        role: "admin",
        status: "approved",
      });
    });
    const alice = testEnv.authenticatedContext("alice", { email: "alice@example.com" }).firestore();
    await assertFails(getDoc(doc(alice, "admins", "bob")));
  });

  it("refuses a user self-approving via update", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "admins", "alice"), {
        email: "alice@example.com",
        role: "admin",
        status: "pending",
      });
    });
    const alice = testEnv.authenticatedContext("alice", { email: "alice@example.com" }).firestore();
    await assertFails(updateDoc(doc(alice, "admins", "alice"), { status: "approved" }));
  });

  it("lets a user resubmit after rejection (status -> pending)", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "admins", "alice"), {
        email: "alice@example.com",
        role: "admin",
        status: "rejected",
      });
    });
    const alice = testEnv.authenticatedContext("alice", { email: "alice@example.com" }).firestore();
    await assertSucceeds(
      updateDoc(doc(alice, "admins", "alice"), { status: "pending", updatedAt: new Date().toISOString() })
    );
  });

  it("lets an approved super admin approve another admin and list all admins", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "admins", "owner"), {
        email: SUPER_ADMIN_EMAIL,
        role: "super_admin",
        status: "approved",
      });
      await setDoc(doc(ctx.firestore(), "admins", "alice"), {
        email: "alice@example.com",
        role: "admin",
        status: "pending",
      });
    });
    const owner = testEnv.authenticatedContext("owner", { email: SUPER_ADMIN_EMAIL }).firestore();
    await assertSucceeds(
      updateDoc(doc(owner, "admins", "alice"), { status: "approved", updatedAt: new Date().toISOString() })
    );
    await assertSucceeds(getDocs(collection(owner, "admins")));
    await assertSucceeds(deleteDoc(doc(owner, "admins", "alice")));
  });

  it("refuses a pending (unapproved) admin listing all admins", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "admins", "alice"), {
        email: "alice@example.com",
        role: "admin",
        status: "pending",
      });
    });
    const alice = testEnv.authenticatedContext("alice", { email: "alice@example.com" }).firestore();
    await assertFails(getDocs(collection(alice, "admins")));
  });

  it("refuses an unauthenticated read", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "admins", "alice"), { email: "alice@example.com" });
    });
    const anon = testEnv.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(anon, "admins", "alice")));
  });
});

describe("certificates", () => {
  it("refuses an unauthenticated read -- this was the open full-PII listing", async () => {
    const anon = testEnv.unauthenticatedContext().firestore();
    await assertFails(getDocs(collection(anon, "certificates")));
  });

  it("refuses a write from any client, approved admin or not", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "admins", "owner"), {
        email: SUPER_ADMIN_EMAIL,
        role: "super_admin",
        status: "approved",
      });
    });
    const owner = testEnv.authenticatedContext("owner", { email: SUPER_ADMIN_EMAIL }).firestore();
    await assertFails(setDoc(doc(owner, "certificates", "c1"), { recipientName: "x" }));
  });

  it("lets an approved admin read the certificates list", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "admins", "owner"), {
        email: SUPER_ADMIN_EMAIL,
        role: "super_admin",
        status: "approved",
      });
    });
    const owner = testEnv.authenticatedContext("owner", { email: SUPER_ADMIN_EMAIL }).firestore();
    await assertSucceeds(getDocs(collection(owner, "certificates")));
  });
});

describe("settings/global", () => {
  it("lets any approved admin (not just super admin) read and write settings", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "admins", "alice"), {
        email: "alice@example.com",
        role: "admin",
        status: "approved",
      });
    });
    const alice = testEnv.authenticatedContext("alice", { email: "alice@example.com" }).firestore();
    await assertSucceeds(setDoc(doc(alice, "settings", "global"), { orgName: "PharmacoZyme" }, { merge: true }));
    await assertSucceeds(getDoc(doc(alice, "settings", "global")));
  });

  it("refuses an unapproved admin", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "admins", "alice"), {
        email: "alice@example.com",
        role: "admin",
        status: "pending",
      });
    });
    const alice = testEnv.authenticatedContext("alice", { email: "alice@example.com" }).firestore();
    await assertFails(getDoc(doc(alice, "settings", "global")));
  });
});

describe("everything else the app writes only through the Admin SDK", () => {
  it("denies direct client access to databases/participants", async () => {
    const anon = testEnv.unauthenticatedContext().firestore();
    await assertFails(getDocs(collection(anon, "databases")));
  });
});
