import { redirect } from "next/navigation";

export default async function ClaimByIdPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/claim?id=${encodeURIComponent(id)}`);
}
