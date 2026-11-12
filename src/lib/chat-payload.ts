/** What a visitor sees when the VPS hangs up mid-sentence. */
export const DROPPED_LINE =
  "Ada's line dropped mid-sentence. Nothing you wrote was lost. Ask again.";

/**
 * Upstream is not always JSON: nginx answers a dead service with a plain-text
 * 502 page. Parse defensively so that page never becomes Ada's reply text.
 */
export function parsePayload(raw: string): Record<string, unknown> | null {
  try {
    const data: unknown = JSON.parse(raw);
    if (data && typeof data === "object" && !Array.isArray(data)) {
      return data as Record<string, unknown>;
    }
  } catch {
    /* fall through */
  }
  return null;
}
