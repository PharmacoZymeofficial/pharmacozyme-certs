import { redirect } from "next/navigation";

/**
 * Legacy URL shape support.
 *
 * `PZ-{year}-{hex}` certificates minted by the old (now-deleted)
 * `/api/certificates/generate` route encoded their verification URL as
 * `/verify/{certId}` — a path that never existed as a page, so following it 404'd.
 * The actual verify page reads `?certId=` (see app/verify/page.tsx). This route exists
 * only so any certificate already carrying that broken URL still resolves.
 */
export default async function LegacyVerifyRedirect({
  params,
}: {
  params: Promise<{ certId: string }>;
}) {
  const { certId } = await params;
  redirect(`/verify?certId=${encodeURIComponent(certId)}`);
}
