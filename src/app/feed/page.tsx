import { NavBar } from "@/components/NavBar";
import { DoomFeed } from "@/components/DoomFeed";
import { ChargesRail } from "@/components/ChargesRail";
import { DoomRail } from "@/components/DoomRail";
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
    : [{ items: [], total: 0, fresh: 0 }, EMPTY];

  return (
    <div className="min-h-screen bg-canvasBlack text-sheetWhite">
      <NavBar />
      {/* Two rails. The left one is the work arriving — charges filed by
          research, so the feed's numbers have a visible cause. The right one
          is the clock that does not scroll away: what the same minutes cost
          outside the tab, accumulated across the session. The old top meter is
          gone; on a phone the same rates run in the fixed strip. */}
      <div className="mx-auto grid max-w-[1500px] grid-cols-1 gap-4 px-3 pt-4 xl:grid-cols-[250px_minmax(0,1fr)_230px] xl:items-start xl:gap-6 xl:px-6 xl:pt-0">
        <div className="order-1 xl:sticky xl:top-24 xl:max-h-[calc(100vh-7rem)] xl:self-start xl:overflow-y-auto xl:overscroll-contain xl:pt-6">
          <ChargesRail limit={7} />
        </div>

        <div className="order-2 min-w-0">
          <DoomFeed
            initial={page.items}
            total={page.total}
            fresh={page.fresh}
            read={stats.wire}
            discarded={stats.discarded}
          />
        </div>

        <div className="order-3 xl:sticky xl:top-24 xl:max-h-[calc(100vh-7rem)] xl:self-start xl:overflow-y-auto xl:overscroll-contain xl:pt-6">
          <DoomRail stats={stats} />
        </div>
      </div>
    </div>
  );
}
