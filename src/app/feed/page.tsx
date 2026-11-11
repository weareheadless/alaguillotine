import { NavBar } from "@/components/NavBar";
import { DoomFeed } from "@/components/DoomFeed";
import { DoomMeter } from "@/components/DoomMeter";
import { getDb } from "@/lib/clock-store";
import { feedStats, readFeedPage } from "@/lib/feed";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "The Feed — doom, aggregated",
  description:
    "A doom scroll with the mechanism exposed: the wire, the receipts, the dispatches, and a meter of what the world spends while you read.",
  alternates: { canonical: "/feed" },
  openGraph: {
    title: "The Feed — doom, aggregated",
    description:
      "The wire, the receipts, the dispatches. The ranking is published. Nothing is recorded about you.",
    url: "https://alaguillotine.com/feed",
    siteName: "A LA GUILLOTINE",
  },
};

const EMPTY = { items: 0, wire: 0, discarded: 0, names: 0, receipts: 0, dispatches: 0 };

export default async function FeedPage() {
  const db = await getDb();
  const [page, stats] = db
    ? await Promise.all([readFeedPage(db, 0, 12), feedStats(db)])
    : [{ items: [], total: 0 }, EMPTY];

  return (
    <div className="min-h-screen bg-canvasBlack text-sheetWhite">
      <NavBar />
      <DoomMeter stats={stats} />
      <DoomFeed
        initial={page.items}
        total={page.total}
        read={stats.wire}
        discarded={stats.discarded}
      />
    </div>
  );
}
