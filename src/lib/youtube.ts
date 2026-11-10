/**
 * News video, via the YouTube Data API.
 *
 * Search is the only part that works: the news sites DeepSeek returns block
 * scraping of the og:video files, but YouTube hands back an id we can embed.
 *
 * The old pass drew ten queries at random from twenty, and most of those
 * queries were protests, borders and floods — so the television was a rolling
 * loop of the same three stories from the same four wires. Queries are now
 * themed, one per theme per pass, with a wider map and more beats.
 */

type Query = { q: string; theme: string };

// Outlet-anchored: YouTube's global ranking will happily hand back a Bengali
// reupload of the same footage, and the television in the corner is in English.
const QUERIES: Query[] = [
  { theme: "unrest", q: "BBC News protest police crackdown" },
  { theme: "unrest", q: "Sky News protest clashes" },
  { theme: "unrest", q: "AP News police raid protest" },
  { theme: "unrest", q: "France 24 protests clashes" },

  { theme: "migration", q: "BBC News immigration detention" },
  { theme: "migration", q: "Al Jazeera migrants border" },
  { theme: "migration", q: "DW News deportation refugees" },
  { theme: "migration", q: "Reuters migrant boat rescue" },

  { theme: "climate", q: "Reuters climate flood disaster" },
  { theme: "climate", q: "DW News heatwave drought" },
  { theme: "climate", q: "Guardian News wildfire evacuation" },
  { theme: "climate", q: "BBC News storm damage" },

  { theme: "war", q: "Al Jazeera Gaza strikes" },
  { theme: "war", q: "BBC News Ukraine war" },
  { theme: "war", q: "France 24 Middle East conflict" },
  { theme: "war", q: "Reuters war refugees border" },

  { theme: "courts", q: "Sky News court corruption trial" },
  { theme: "courts", q: "ABC News court verdict" },
  { theme: "courts", q: "Reuters indictment charges" },
  { theme: "courts", q: "CBC News trial ruling" },

  { theme: "corruption", q: "DW News corruption scandal" },
  { theme: "corruption", q: "Al Jazeera graft investigation" },
  { theme: "corruption", q: "Reuters bribery probe" },
  { theme: "corruption", q: "BBC News sleaze minister" },

  { theme: "economy", q: "Channel 4 News cost of living" },
  { theme: "economy", q: "Reuters inflation prices" },
  { theme: "economy", q: "DW News recession economy" },
  { theme: "economy", q: "CNBC cost of living crisis" },

  { theme: "labour", q: "CBS News strike workers" },
  { theme: "labour", q: "BBC News union strike" },
  { theme: "labour", q: "DW News workers protest" },
  { theme: "labour", q: "ABC News wage theft" },

  { theme: "housing", q: "Guardian News eviction housing" },
  { theme: "housing", q: "CBC News housing crisis" },
  { theme: "housing", q: "France 24 rent housing" },
  { theme: "housing", q: "Sky News renters" },

  { theme: "health", q: "Channel 4 News NHS crisis" },
  { theme: "health", q: "BBC News hospital waiting" },
  { theme: "health", q: "DW News health system" },
  { theme: "health", q: "CBC News healthcare" },

  { theme: "tech", q: "BBC News AI regulation" },
  { theme: "tech", q: "CNBC tech monopoly" },
  { theme: "tech", q: "DW News data privacy" },
  { theme: "tech", q: "Reuters chip export" },

  { theme: "politics", q: "AP News press conference" },
  { theme: "politics", q: "BBC News parliament vote" },
  { theme: "politics", q: "France 24 election results" },
  { theme: "politics", q: "CBC News prime minister" },

  { theme: "arms", q: "Reuters arms sale weapons" },
  { theme: "arms", q: "DW News defence spending" },
  { theme: "arms", q: "Al Jazeera weapons deal" },
  { theme: "arms", q: "BBC News military aid" },

  { theme: "food", q: "Reuters food prices" },
  { theme: "food", q: "BBC News famine aid" },
  { theme: "food", q: "DW News agriculture drought" },
  { theme: "food", q: "Al Jazeera food crisis" },

  { theme: "africa", q: "Africanews protest crackdown" },
  { theme: "africa", q: "BBC News Africa conflict" },
  { theme: "africa", q: "Reuters Africa election" },
  { theme: "africa", q: "Al Jazeera Africa famine" },

  { theme: "asia", q: "CNA News Singapore protest" },
  { theme: "asia", q: "BBC News India crackdown" },
  { theme: "asia", q: "ABC News Australia housing" },
  { theme: "asia", q: "Reuters Asia flood" },

  { theme: "americas", q: "Reuters Brazil protest" },
  { theme: "americas", q: "CBC News Canada strike" },
  { theme: "americas", q: "AP News Latin America" },
  { theme: "americas", q: "BBC News Mexico violence" },
];

/**
 * Draw one query per theme, so a pass cannot be all protests, all borders or
 * all floods. Ten themes out of seventeen per pass, rotating over time.
 */
function pickQueries(n: number): Query[] {
  const byTheme = new Map<string, Query[]>();
  for (const query of QUERIES) {
    const list = byTheme.get(query.theme) ?? [];
    list.push(query);
    byTheme.set(query.theme, list);
  }
  const themes = [...byTheme.keys()];
  for (let i = themes.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [themes[i], themes[j]] = [themes[j], themes[i]];
  }
  return themes.slice(0, n).map((theme) => {
    const list = byTheme.get(theme) ?? [];
    return list[Math.floor(Math.random() * list.length)];
  });
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

const STOP = new Set(
  "the a an and or of to in on for with from by as at is are was were be been being that this these those his her their its it he she they we you i not no but if then than so about into over after before during while under above below between among through against without within across per via also has have had will would can could should may might must more most less least such other another same new old last first next own out up down off again further once here there when where why how all any both each few many some live video news".split(
    " ",
  ),
);

function titleWords(title: string): Set<string> {
  return new Set(
    title
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length >= 4 && !STOP.has(w)),
  );
}

/** Same event, different headline: three shared content words is enough. */
function overlaps(a: Set<string>, b: Set<string>): boolean {
  if (!a.size || !b.size) return false;
  let shared = 0;
  for (const w of a) if (b.has(w)) shared += 1;
  return shared >= 3;
}

async function search(
  query: string,
  key: string,
  order: "date" | "relevance",
): Promise<YoutubeClip[]> {
  const params = new URLSearchParams({
    part: "snippet",
    type: "video",
    videoEmbeddable: "true",
    maxResults: "6",
    order,
    relevanceLanguage: "en",
    regionCode: "US",
    videoCategoryId: "25",
    safeSearch: "moderate",
    q: query,
    key,
  });
  // Relevance can reach back years. Keep the dig into the archive recent
  // enough that the television is still reporting this world.
  if (order === "relevance") {
    params.set(
      "publishedAfter",
      new Date(Date.now() - 60 * 86_400_000).toISOString(),
    );
  }

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
        title: decodeEntities(snippet.title).slice(0, 110),
        channel: (snippet.channelTitle ?? "unknown").slice(0, 60),
        publishedAt: snippet.publishedAt ?? new Date().toISOString(),
      },
    ];
  });
}

/** A stream, not a clip: a couple from each theme, deduped by event. */
export async function findReelClips(key: string): Promise<YoutubeClip[]> {
  const seen = new Set<string>();
  const titles: Array<Set<string>> = [];
  const clips: YoutubeClip[] = [];

  for (const query of pickQueries(10)) {
    // Half the passes look for the newest footage; the rest dig into the
    // relevance pile, which surfaces older material the date feed never shows.
    const found = await search(query.q, key, Math.random() < 0.6 ? "date" : "relevance");
    const shuffled = [...found];
    for (let i = shuffled.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    let taken = 0;
    for (const clip of shuffled) {
      if (seen.has(clip.videoId)) continue;
      const words = titleWords(clip.title);
      if (titles.some((t) => overlaps(t, words))) continue;
      seen.add(clip.videoId);
      titles.push(words);
      clips.push(clip);
      taken += 1;
      if (taken >= 2) break;
    }
    if (clips.length >= 14) break;
  }

  return clips.slice(0, 14);
}
