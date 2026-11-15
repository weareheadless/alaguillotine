import { permanentRedirect } from "next/navigation";

/**
 * Coverage was a page about the register's own completeness. The dashboard now
 * publishes the same counts in its header and lets a reader filter by body, so
 * a separate destination only added a second place to explain the first.
 */
export default function CoveragePage() {
  permanentRedirect("/archive");
}
