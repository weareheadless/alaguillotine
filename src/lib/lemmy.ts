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

// lemmy.ml refuses the Worker's requests, so its communities are read through
// the federated view on lemmy.world. Labels resolve from each post's actor.
const COMMUNITIES: Source[] = [
  { instance: "https://lemmy.world", name: "world" },
  { instance: "https://lemmy.world", name: "fuck_ai" },
  { instance: "https://lemmy.world", name: "politics" },
  { instance: "https://lemmy.world", name: "latestagecapitalism" },
  { instance: "https://lemmy.world", name: "aboringdystopia" },
  { instance: "https://lemmy.world", name: "enshittification" },
  { instance: "https://lemmy.world", name: "enoughmuskspam" },
  { instance: "https://lemmy.world", name: "eattherich" },
  { instance: "https://lemmy.world", name: "worldnews@lemmy.ml" },
  { instance: "https://lemmy.world", name: "nottheonion@lemmy.ml", sort: "Hot" },
  { instance: "https://lemmy.world", name: "unions@lemmy.ml", sort: "Hot" },
  { instance: "https://sopuli.xyz", name: "collapse", sort: "Hot" },
];

// The feed reads wider than the clock does: the clock needs a balanced
// reading, the feed needs volume. These are added on top, never instead.
const FEED_EXTRA: Source[] = [
  { instance: "https://lemmy.world", name: "news" },
  { instance: "https://lemmy.world", name: "technology" },
  { instance: "https://lemmy.world", name: "environment" },
  { instance: "https://lemmy.world", name: "economics" },
  { instance: "https://lemmy.world", name: "workreform" },
  { instance: "https://lemmy.world", name: "antiwork" },
  { instance: "https://lemmy.world", name: "climate" },
  { instance: "https://lemmy.world", name: "privacy" },
  { instance: "https://lemmy.world", name: "technology@lemmy.ml" },
  // lemmy.ml/c/environment no longer exists (no posts, no federation view), so
  // environmental coverage comes from lemmy.world/c/environment above.
  // lemmy.ml refuses the Worker's requests, so read it through the federated
  // view on lemmy.world. The label still resolves to c/palestine@lemmy.ml.
  { instance: "https://lemmy.world", name: "palestine@lemmy.ml", sort: "Hot" },
];

const FEED_COMMUNITIES = [...COMMUNITIES, ...FEED_EXTRA];

export interface LemmyPost {
  topic: string;
  title: string;
  url: string;
  site: string;
  date: string | null;
  summary: string;
  authority: number;
  /** The community's own ranking, kept for the feed. */
  score: number;
  comments: number;
  image?: string;
}

interface ApiPost {
  post?: {
    name?: string;
    url?: string;
    body?: string;
    published?: string;
    ap_id?: string;
    thumbnail_url?: string;
    nsfw?: boolean;
  };
  community?: { actor_id?: string };
  counts?: { score?: number; comments?: number };
}

const clip = (v: unknown, n: number) => String(v ?? "").trim().slice(0, n);

/** Image-only posts have no text to analyse, so they are not wire stories. */
const IMAGE_URL = /^https?:\/\/\S+\.(?:jpe?g|png|gif|webp|avif)(?:[?#]\S*)?$/i;

/**
 * The label the wire shows: c/<community>@<host that actually hosts it>.
 * A federated read (palestine@lemmy.ml served by lemmy.world) must not be
 * labelled as a lemmy.world community.
 */
function communitySite(actorId: string | undefined, source: Source): string {
  if (actorId) {
    try {
      const url = new URL(actorId);
      const slug = url.pathname.replace(/^\/c\//, "").replace(/\/+$/, "");
      if (slug && !slug.includes("/")) return `c/${slug}@${url.hostname}`;
    } catch {
      /* fall back to the configured source */
    }
  }
  const name = source.name.split("@")[0];
  return `c/${name}@${new URL(source.instance).hostname}`;
}

async function fetchCommunity(
  { instance, name, sort = "TopDay" }: Source,
  limit = 12,
  page = 1,
): Promise<LemmyPost[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(
      `${instance}/api/v3/post/list?community_name=${encodeURIComponent(name)}&sort=${sort}&limit=${limit}&page=${page}`,
      { signal: controller.signal, headers: { accept: "application/json" } },
    );
    if (!res.ok) return [];
    const data = (await res.json()) as { posts?: ApiPost[] };

    return (data.posts ?? []).flatMap((p) => {
      const post = p.post;
      if (!post?.name) return [];
      const target = post.url && !IMAGE_URL.test(post.url)
        ? post.url
        : post.body
          ? post.ap_id
          : "";
      if (!target) return [];
      const score = p.counts?.score ?? 0;
      return [
        {
          topic: name.split("@")[0],
          title: clip(post.name, 180),
          url: clip(target, 500),
          site: communitySite(p.community?.actor_id, { instance, name }),
          date: post.published ?? null,
          summary: clip(post.body || post.name, 900),
          authority: Math.min(4, 1 + Math.floor(score / 50)),
          score,
          comments: Math.max(0, Number(p.counts?.comments ?? 0)),
          image: !post.nsfw && post.thumbnail_url?.startsWith("https://")
            ? clip(post.thumbnail_url, 1500) : "",
        },
      ];
    });
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Older pages of the same firehose.
 *
 * The feed keeps thirty days now, so it needs something to keep. New sort only
 * returns the first page of each community; walking back a few pages is how the
 * archive gets history without inventing any.
 */
export async function fetchLemmyHistory(
  pages = 3,
  limit = 24,
): Promise<LemmyPost[]> {
  const requests: Array<Promise<LemmyPost[]>> = [];
  for (let page = 2; page <= pages + 1; page += 1) {
    for (const community of FEED_COMMUNITIES) {
      requests.push(fetchCommunity({ ...community, sort: "New" }, limit, page));
    }
  }
  const byUrl = new Map<string, LemmyPost>();
  for (const post of (await Promise.all(requests)).flat()) {
    const prev = byUrl.get(post.url);
    if (!prev || post.authority > prev.authority) byUrl.set(post.url, post);
  }
  return [...byUrl.values()];
}

/** Everything the communities are talking about today, highest ranked first. */
export async function fetchLemmyCandidates(): Promise<LemmyPost[]> {
  const results = await Promise.all(
    COMMUNITIES.map((community) => fetchCommunity(community)),
  );
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

/**
 * The firehose behind the feed.
 *
 * `fetchLemmyCandidates` asks each community for its best three so the clock
 * gets a balanced reading. The feed has no such restraint: it takes the lot,
 * every fifteen minutes, and lets the ranking sort it out. Duplicate links are
 * collapsed here; duplicate *stories* are clustered later, in the feed.
 */
export async function fetchLemmyFeed(limit = 24): Promise<LemmyPost[]> {
  // TopDay returns the same ranked page all day: the feed was refreshing every
  // fifteen minutes and seeing a news cycle that had not moved. The firehose
  // reads New, so every post enters the feed once and the page can be recent.
  // The clock keeps its TopDay reading; that is a different question.
  const results = await Promise.all(
    FEED_COMMUNITIES.map((community) => fetchCommunity({ ...community, sort: "New" }, limit)),
  );
  const byUrl = new Map<string, LemmyPost>();
  for (const post of results.flat()) {
    const prev = byUrl.get(post.url);
    if (!prev || post.authority > prev.authority) byUrl.set(post.url, post);
  }
  return [...byUrl.values()]
    .sort((a, b) => b.authority - a.authority)
    .slice(0, 240);
}
