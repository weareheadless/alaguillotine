/**
 * A link the browser can follow without a mixed-content warning.
 *
 * The ledger and the wire still carry some `http://` sources from older
 * passes. The page is served over HTTPS, so an `http://` anchor is flagged by
 * crawlers even when it is only a citation. Upgrade the scheme for display;
 * the stored source keeps its original form.
 */
export function safeHref(url: string): string {
  const raw = String(url || "").trim();
  if (!raw) return "#";
  if (raw.startsWith("http://")) return `https://${raw.slice("http://".length)}`;
  return raw;
}
