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
  "Channel 4 News cost of living",
  "Guardian News eviction housing",
  "Al Jazeera crackdown arrests",
  "DW News protest Europe",
  "CBS News strike workers",
  "NBC News billionaires congress",
  "BBC News immigration detention",
  "Sky News court corruption trial",
  "Reuters climate flood disaster",
  "AP News surveillance privacy",
  "Al Jazeera famine aid convoy",
  "DW News far right rally",
  "Channel 4 News NHS crisis",
  "Guardian News rent strike",
  "Reuters war refugees border",
  "AP News police raid protest",
];

/** Draw a different ten each pass so the stream is not the same ten searches. */
function pickQueries(n: number): string[] {
  const pool = [...QUERIES];
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, n);
}

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

function decodeEntities(text: string): string {
  return text
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
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
        title: decodeEntities(snippet.title).slice(0, 90),
        channel: (snippet.channelTitle ?? "unknown").slice(0, 60),
        publishedAt: snippet.publishedAt ?? new Date().toISOString(),
      },
    ];
  });
}

/**
 * A stream, not a clip: the newest result from each query, deduped. Twelve
 * searches is twelve chances at footage, and the television rotates through all
 * of it.
 */
export async function findReelClips(key: string): Promise<YoutubeClip[]> {
  const seen = new Set<string>();
  const clips: YoutubeClip[] = [];

  for (const query of pickQueries(10)) {
    for (const clip of await search(query, key)) {
      if (seen.has(clip.videoId)) continue;
      seen.add(clip.videoId);
      clips.push(clip);
      if (clips.length >= 12) return clips;
    }
  }

  return clips;
}
