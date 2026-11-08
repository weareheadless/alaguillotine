/**
 * The fund, as the chain sees it.
 *
 * The site never holds money and never signs anything. It shows a public
 * address and what is in it. Spending happens from a wallet the site cannot
 * touch, and every grant is posted with its receipt in the forum.
 *
 * Balances are read in the browser: the official public RPC blocks datacenter
 * egress, so a Worker-side read would either fail or lie. The forum strip is
 * read server-side from the forum's public API.
 */

export const FUND_WALLET =
  process.env.NEXT_PUBLIC_SOLANA_RECEIVER_WALLET ||
  "HA4ms5uXaT23EQ5Xp28RcQLNSBkR6Vwg7rH21HhAMuQG";

export const CHOP_MINT =
  process.env.NEXT_PUBLIC_CHOP_MINT ||
  "6gup5Cper6pmfNfsGps3MizgpsG3q6uvzobGdUFapump";

export const CHOP_DECIMALS = Number(
  process.env.NEXT_PUBLIC_CHOP_DECIMALS || "6",
);

/**
 * The fund's associated token account for $CHOP.
 *
 * Deterministic from FUND_WALLET + CHOP_MINT, so it never changes. Reading it
 * directly keeps the balance read a plain `getAccountInfo` instead of the
 * indexed `getTokenAccountsByOwner`, which the free public nodes refuse.
 */
export const CHOP_ACCOUNT = "5Xfyf4iuUm8wXuozyupgtwa7EZ2A7eFTK7gPXPQ7YduQ";

export interface ForumTopic {
  id: number;
  title: string;
  community: string;
  comments: number;
  score: number;
}

const TOPICS_TTL_MS = 120_000;
let cachedTopics: { at: number; value: ForumTopic[] } | null = null;

/** The latest local threads, read from the forum's public API. */
export async function readForumTopics(limit = 6): Promise<ForumTopic[]> {
  if (cachedTopics && Date.now() - cachedTopics.at < TOPICS_TTL_MS) {
    return cachedTopics.value;
  }
  try {
    const response = await fetch(
      `https://forum.alaguillotine.com/api/v3/post/list?type_=Local&sort=New&limit=${limit}`,
      {
        headers: { accept: "application/json" },
        cache: "no-store",
      },
    );
    if (!response.ok) return [];
    const data = (await response.json()) as {
      posts?: Array<{
        post?: { id?: number; name?: string };
        community?: { name?: string };
        counts?: { comments?: number; score?: number };
      }>;
    };
    const topics = (data.posts ?? []).flatMap((entry) => {
      const id = entry.post?.id;
      const title = entry.post?.name;
      if (!id || !title) return [];
      return [
        {
          id,
          title: title.slice(0, 140),
          community: entry.community?.name ?? "the_fund",
          comments: entry.counts?.comments ?? 0,
          score: entry.counts?.score ?? 0,
        },
      ];
    });
    cachedTopics = { at: Date.now(), value: topics };
    return topics;
  } catch {
    return [];
  }
}