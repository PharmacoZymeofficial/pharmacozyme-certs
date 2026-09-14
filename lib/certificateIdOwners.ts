import { getAdminDb } from "@/lib/firebase.admin";

// Firestore 'in' queries accept at most 30 values.
const IN_CHUNK = 30;

/**
 * Finds who currently owns each candidate certificate ID, across every database's
 * participants (not just the one being edited) and the top-level certificates
 * collection. The two mint sites (bulk "Generate IDs" and the manual single-ID
 * edit) both call this — root cause of the 2026-09-13 COE-MDC3/COP-MDC3 collision
 * was that uniqueness was only ever checked within the database being edited.
 */
export async function findExistingCertIdOwners(certIds: string[]): Promise<Map<string, string>> {
  const adminDb = getAdminDb();
  const owners = new Map<string, string>();
  const unique = [...new Set(certIds)];

  for (let i = 0; i < unique.length; i += IN_CHUNK) {
    const chunk = unique.slice(i, i + IN_CHUNK);

    const certSnap = await adminDb.collection("certificates").where("uniqueCertId", "in", chunk).get();
    certSnap.forEach((d) => owners.set(d.data().uniqueCertId, d.ref.path));

    const partSnap = await adminDb.collectionGroup("participants").where("certificateId", "in", chunk).get();
    partSnap.forEach((d) => {
      if (!owners.has(d.data().certificateId)) owners.set(d.data().certificateId, d.ref.path);
    });
  }

  return owners;
}
