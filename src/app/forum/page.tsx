import { redirect } from "next/navigation";

/**
 * The forum and the fund now share one page. Keep the old links working.
 */
export default async function ForumPage({
  searchParams,
}: {
  searchParams: Promise<{ to?: string | string[]; c?: string | string[] }>;
}) {
  const params = await searchParams;
  const query = new URLSearchParams();

  const to = Array.isArray(params.to) ? params.to[0] : params.to;
  if (to) query.set("to", to);
  const c = Array.isArray(params.c) ? params.c[0] : params.c;
  if (c) query.set("c", c);

  const suffix = query.toString();
  redirect(`/resistance${suffix ? `?${suffix}` : ""}`);
}