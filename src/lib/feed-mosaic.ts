import type { FeedItem } from "./feed";

/** One stable front-page selection, not a second feed-ranking system. */
export function mosaicItems(items: FeedItem[], limit = 10, now = Date.now()): FeedItem[] {
  const ids = new Set<string>();
  const urls = new Set<string>();
  const clusters = new Set<string>();
  const unique = items.filter(item => {
    if (!item || !item.id || !item.title || !["wire", "record", "charge"].includes(item.kind)) return false;
    // A tile with no analysis is a headline and an outbound link. The claim
    // stays on its own page until Ada has said why it is here; the wire is
    // already filtered upstream when it has no take.
    if (item.kind === "charge" && !item.take) return false;
    // The feed's archive lane can contain months-old dispatches. Keep them in
    // /feed, but don't resurrect them as the homepage's featured editorial.
    if (item.source === "dispatch") {
      const age = now - Date.parse(item.publishedAt);
      if (!Number.isFinite(age) || age < 0 || age > 14 * 86_400_000) return false;
    }
    if (!/^(https?:\/\/|\/(?!\/))/.test(item.url)) return false;
    const url = item.url.replace(/^http:/, "https:").split("#")[0];
    if (ids.has(item.id) || urls.has(url) || (item.cluster && clusters.has(item.cluster))) return false;
    ids.add(item.id);
    urls.add(url);
    if (item.cluster) clusters.add(item.cluster);
    return true;
  });
  const lead = unique.find(item => item.kind === "wire") ?? unique[0];
  if (!lead) return [];
  const rest = unique.filter(item => item.id !== lead.id);
  const feature = rest.find(item => item.source === "receipt")
    ?? rest.find(item => item.source === "dispatch");
  return [lead, ...(feature ? [feature] : []), ...rest.filter(item => item.id !== feature?.id)]
    .slice(0, Math.max(0, limit));
}

export function mosaicDate(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString("en-GB", {
    day: "numeric", month: "short", timeZone: "UTC",
  });
}
