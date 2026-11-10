import { saveReelClip } from "./reel-store";
import { findReelClips } from "./youtube";

/**
 * One reel pass: ask YouTube for the next set of clips and keep them.
 *
 * Extracted from the clock route so the review desk can force a refresh
 * without running the whole reading, and so a failed YouTube call is one
 * function to diagnose instead of a silent zero inside a larger pass.
 */
export async function refreshReel(key: string | undefined): Promise<number> {
  if (!key) return 0;
  const clips = await findReelClips(key);
  for (const clip of clips) {
    await saveReelClip(
      { url: clip.videoId, caption: clip.title, source: clip.channel, kind: "youtube" },
      `https://www.youtube.com/watch?v=${clip.videoId}`,
    );
  }
  return clips.length;
}
