import { redirect } from "next/navigation";

/**
 * The fund is a side panel now, opened over the forum it belongs to.
 */
export default async function ResistancePage({
  searchParams,
}: {
  searchParams: Promise<{ to?: string | string[]; c?: string | string[] }>;
}) {
  const params = await searchParams;
  const query = new URLSearchParams();

  const c = Array.isArray(params.c) ? params.c[0] : params.c;
  if (c) query.set("c", c);
  const to = Array.isArray(params.to) ? params.to[0] : params.to;
  if (to) query.set("to", to);
  query.set("fund", "1");

  redirect(`/forum?${query.toString()}`);
}