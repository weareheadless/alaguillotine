import { redirect } from "next/navigation";

/**
 * The queue lives on the installation page now, under the same instruments that
 * feed it. Kept as a redirect so old links still land in the right place.
 */
export default function NextInLinePage() {
  redirect("/#queue");
}
