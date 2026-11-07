import { listReelClips } from "@/lib/reel-store";

export const revalidate = 0;

/**
 * GET /api/reel — the news video the last pass could actually play.
 *
 * Empty is a valid answer: most passes find pages with no embeddable file, and
 * the client falls back to its static clips.
 */
export async function GET() {
  try {
    const decode = (v: string) =>
      v
        .replace(/&#39;/g, "'")
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">");
    const clips = (await listReelClips(24)).map((c) => ({
      ...c,
      caption: decode(c.caption),
      source: decode(c.source),
    }));
    return Response.json(
      { clips },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json({ clips: [] }, { headers: { "Cache-Control": "no-store" } });
  }
}
