import { redirect } from "next/navigation";
import { NavBar } from "@/components/NavBar";
import { ForumFrame } from "@/components/ForumFrame";
import { FORUM_ENABLED } from "@/lib/constants";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "The Forum — one person, one voice",
  description:
    "No email, accounts approved by hand. The fund is argued here, not advertised.",
  alternates: { canonical: "/forum" },
  openGraph: {
    title: "The Forum — one person, one voice",
    description: "No email, accounts approved by hand. The fund is argued here.",
    url: "https://alaguillotine.com/forum",
    siteName: "A LA GUILLOTINE",
  },
};

const COMMUNITIES = new Set(["the_fund", "mutual_aid", "evidence", "meta"]);

function initialPath(params: { to?: string | string[]; c?: string | string[] }) {
  const to = Array.isArray(params.to) ? params.to[0] : params.to;
  if (to && to.startsWith("/") && !to.startsWith("//")) {
    return to.slice(0, 300);
  }
  const c = Array.isArray(params.c) ? params.c[0] : params.c;
  if (c && COMMUNITIES.has(c)) return `/c/${c}`;
  return undefined;
}

export default async function ForumPage({
  searchParams,
}: {
  searchParams: Promise<{ to?: string | string[]; c?: string | string[] }>;
}) {
  const params = await searchParams;

  // Hidden for now: setting FORUM_ENABLED back to true restores the page.
  if (!FORUM_ENABLED) redirect("/");

  return (
    <div className="min-h-screen bg-canvasBlack text-sheetWhite">
      <NavBar />
      <main className="mx-auto max-w-[1500px] px-4 pb-6 pt-4 sm:px-6">
        <ForumFrame full initialPath={initialPath(params)} />
      </main>
    </div>
  );
}