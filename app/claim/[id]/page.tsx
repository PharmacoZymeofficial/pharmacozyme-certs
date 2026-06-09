import { ClaimContent } from "../ClaimContent";

export default async function ClaimByIdPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ClaimContent certId={decodeURIComponent(id)} />;
}
