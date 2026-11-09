import { redirect } from "next/navigation";
import { FORUM_ENABLED } from "@/lib/constants";

/**
 * The old fund URL. With the forum closed the fund panel opens over the blade,
 * so this keeps every shared link working either way.
 */
export default async function ResistancePage({
  searchParams,
}: {
  searchParams: Promise<{ to?: string | string[]; c?: string | string[] }>;
}) {
  const params = await searchParams;

  if (!FORUM_ENABLED) redirect("/?fund=1");

  const query = new URLSearchParams();
  const c = Array.isArray(params.c) ? params.c[0] : params.c;
  if (c) query.set("c", c);
  const to = Array.isArray(params.to) ? params.to[0] : params.to;
  if (to) query.set("to", to);
  query.set("fund", "1");

  redirect(`/forum?${query.toString()}`);
}
