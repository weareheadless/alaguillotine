/**
 * Lemmy as the newsroom.
 *
 * The wire services are owned by the people the site is about, so the reporting
 * that reaches Ada now comes from federated, community-ranked communities
 * instead: no billionaire proprietor, no front page to protect.
 *
 * The Lemmy API is public and needs no key.
 */

interface Source {
  instance: string;
  name: string;
  /** Quiet communities have nothing in TopDay; Hot keeps them in the wire. */
  sort?: string;
}

// Two instances, so no single server decides what Ada reads.
const COMMUNITIES: Source[] = [
  { instance: "https://lemmy.world", name: "world" },
  { instance: "https://lemmy.world", name: "fuck_ai" },
  { instance: "https://lemmy.world", name: "politics" },
  { instance: "https://lemmy.world", name: "latestagecapitalism" },
  { instance: "https://lemmy.world", name: "aboringdystopia" },
  { instance: "https://lemmy.world", name: "enshittification" },
  { instance: "https://lemmy.world", name: "enoughmuskspam" },
  { instance: "https://lemmy.world", name: "eattherich" },
  { instance: "https://lemmy.ml", name: "worldnews" },
  { instance: "https://lemmy.ml", name: "nottheonion" },
  { instance: "https://lemmy.ml", name: "unions" },
  { instance: "https://sopuli.xyz", name: "collapse", sort: "Hot" },
];

export interface LemmyPost {
  topic: string;
  title: string;
  url: string;
  site: string;
  date: string | null;
  summary: string;
  authority: number;
}

interface ApiPost {
  post?: {
    name?: string;
    url?: string;
    body?: string;
    published?: string;
    ap_id?: string;
  };
  counts?: { score?: number; comments?: number };
}

const clip = (v: unknown, n: number) => String(v ?? "").trim().slice(0, n);

async function fetchCommunity({ instance, name, sort = "TopDay" }: Source): Promise<LemmyPost[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(
      `${instance}/api/v3/post/list?community_name=${encodeURIComponent(name)}&sort=${sort}&limit=12`,
      { signal: controller.signal, headers: { accept: "application/json" } },
    );
    if (!res.ok) return [];
    const data = (await res.json()) as { posts?: ApiPost[] };

    return (data.posts ?? []).flatMap((p) => {
      const post = p.post;
      if (!post?.name) return [];
      if (!post.url && !post.body) return [];
      const score = p.counts?.score ?? 0;
      return [
        {
          topic: name,
          title: clip(post.name, 180),
          url: clip(post.url || post.ap_id, 500),
          site: `c/${name}@${new URL(instance).hostname}`,
          date: post.published ?? null,
          summary: clip(post.body || post.name, 900),
          authority: Math.min(4, 1 + Math.floor(score / 50)),
        },
      ];
    });
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

/** Everything the communities are talking about today, highest ranked first. */
export async function fetchLemmyCandidates(): Promise<LemmyPost[]> {
  const results = await Promise.all(COMMUNITIES.map(fetchCommunity));
  const byUrl = new Map<string, LemmyPost>();

  for (const post of results.flat()) {
    const prev = byUrl.get(post.url);
    if (!prev || post.authority > prev.authority) byUrl.set(post.url, post);
  }

  // A quiet community should not be drowned out by a loud one. Take the top
  // three from each, then rank the whole pool.
  const byCommunity = new Map<string, LemmyPost[]>();
  for (const post of byUrl.values()) {
    const list = byCommunity.get(post.site) ?? [];
    list.push(post);
    byCommunity.set(post.site, list);
  }

  const picked: LemmyPost[] = [];
  for (const list of byCommunity.values()) {
    picked.push(...list.sort((a, b) => b.authority - a.authority).slice(0, 3));
  }

  return picked.sort((a, b) => b.authority - a.authority).slice(0, 60);
}
