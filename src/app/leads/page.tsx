import { permanentRedirect } from "next/navigation";

/**
 * Leads were a separate join of seat and disclosure. The dashboard queries the
 * claims themselves; a lead is a reading of two claims, not a second archive.
 */
export default function LeadsPage() {
  permanentRedirect("/archive");
}
