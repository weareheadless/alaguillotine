/**
 * Pull playable video out of the news pages the search returns.
 *
 * DeepSeek search happily returns video pages (AP /video/, DW /video-…, WION
 * /videos/…). What it does not return is the file. So we read the page and take
 * the one URL the page already advertises for embedding — og:video — and keep
 * only formats a browser will play without a plugin.
 */

export interface VideoCandidate {
  url: string;
  site: string;
  title: string;
}

export interface ExtractedClip {
  url: string;
  caption: string;
  source: string;
  pageUrl: string;
}

const VIDEO_PAGE = /\/(video|videos|watch)\//i;
const PLAYABLE = /\.(mp4|webm)(\?|$)/i;

const OG_PATTERNS = [
  /<meta[^>]+property=["']og:video:secure_url["'][^>]+content=["']([^"']+)["']/i,
  /<meta[^>]+property=["']og:video:url["'][^>]+content=["']([^"']+)["']/i,
  /<meta[^>]+property=["']og:video["'][^>]+content=["']([^"']+)["']/i,
  /<meta[^>]+content=["']([^"']+\.mp4[^"']*)["'][^>]+property=["']og:video/i,
  /<video[^>]+src=["']([^"']+\.(?:mp4|webm)[^"']*)["']/i,
  /"contentUrl"\s*:\s*"([^"]+\.(?:mp4|webm)[^"]*)"/i,
];

async function fetchHtml(url: string): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 7000);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "user-agent": "Mozilla/5.0 (compatible; alaguillotine/1.0)",
        accept: "text/html",
      },
      redirect: "follow",
    });
    if (!res.ok) return null;
    const type = res.headers.get("content-type") ?? "";
    if (!type.includes("text/html")) return null;
    const text = await res.text();
    return text.slice(0, 400_000);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function extractReelClips(candidates: VideoCandidate[]): Promise<ExtractedClip[]> {
  const pages = candidates
    .filter((c) => VIDEO_PAGE.test(c.url))
    .slice(0, 3);

  const found: ExtractedClip[] = [];

  for (const page of pages) {
    const html = await fetchHtml(page.url);
    if (!html) continue;

    let file: string | null = null;
    for (const pattern of OG_PATTERNS) {
      const match = html.match(pattern);
      if (match?.[1] && PLAYABLE.test(match[1])) {
        file = match[1].replace(/&amp;/g, "&");
        break;
      }
    }
    if (!file) continue;
    if (!/^https?:\/\//i.test(file)) continue;

    found.push({
      url: file,
      caption: page.title.slice(0, 80) || "news clip",
      source: page.site.slice(0, 60),
      pageUrl: page.url,
    });
  }

  return found;
}
