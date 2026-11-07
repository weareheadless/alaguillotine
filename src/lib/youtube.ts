/**
 * News video, via the YouTube Data API.
 *
 * Search is the only part that works: the news sites DeepSeek returns block
 * scraping of their og:video files, but YouTube hands back an id we can embed.
 * Four searches per pass, one clip kept, rotated client-side.
 */

// Outlet-anchored: YouTube's global ranking will happily hand back a Bengali
// reupload of the same footage, and the television in the corner is in English.
const QUERIES = [
  "BBC News protest police crackdown",
  "Sky News protest clashes",
  "Reuters protest crackdown",
  "AP News press conference",
];

const API = "https://www.googleapis.com/youtube/v3/search";

export interface YoutubeClip {
  videoId: string;
  title: string;
  channel: string;
  publishedAt: string;
}

interface SearchItem {
  id?: { videoId?: string };
  snippet?: {
    title?: string;
    channelTitle?: string;
    publishedAt?: string;
    liveBroadcastContent?: string;
  };
}

function isMostlyLatin(text: string): boolean {
  const letters = text.replace(/[^\p{L}]/gu, "");
  if (!letters.length) return false;
  const latin = letters.replace(/[^A-Za-z]/g, "").length;
  return latin / letters.length >= 0.7;
}

async function search(query: string, key: string): Promise<YoutubeClip[]> {
  const params = new URLSearchParams({
    part: "snippet",
    type: "video",
    videoEmbeddable: "true",
    maxResults: "5",
    order: "date",
    relevanceLanguage: "en",
    regionCode: "US",
    videoCategoryId: "25",
    safeSearch: "moderate",
    q: query,
    key,
  });

  const res = await fetch(`${API}?${params.toString()}`);
  if (!res.ok) return [];
  const data = (await res.json()) as { items?: SearchItem[] };

  return (data.items ?? []).flatMap((item) => {
    const id = item.id?.videoId;
    const snippet = item.snippet;
    if (!id || !snippet?.title) return [];
    // The TV is in English: skip titles that are mostly another script.
    if (!isMostlyLatin(snippet.title)) return [];
    return [
      {
        videoId: id,
        title: snippet.title.slice(0, 90),
        channel: (snippet.channelTitle ?? "unknown").slice(0, 60),
        publishedAt: snippet.publishedAt ?? new Date().toISOString(),
      },
    ];
  });
}

/** Newest clip from the first query that returns anything. */
export async function findReelClip(key: string): Promise<YoutubeClip | null> {
  for (const query of QUERIES) {
    const results = await search(query, key);
    if (results.length) return results[0];
  }
  return null;
}
