import Link from "next/link";
import { NavBar } from "@/components/NavBar";
import { CopyAddress } from "@/components/CopyAddress";
import { TreasuryStats } from "@/components/TreasuryStats";
import { ForumFrame } from "@/components/ForumFrame";
import { CHOP_MINT, FUND_WALLET } from "@/lib/treasury";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "The Fund — A LA GUILLOTINE",
  description:
    "Money for food, legal aid, medical care and shelter. The forum decides where it goes; the wallet is public.",
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

const STEPS = [
  {
    n: "1",
    title: "Someone proposes",
    body: "A named organisation, an amount, and what it buys. Posted in the forum.",
  },
  {
    n: "2",
    title: "The forum decides",
    body: "Everyone argues it. When there is money to move, it goes to a vote.",
  },
  {
    n: "3",
    title: "The receipt is posted",
    body: "The wallet pays the organisation directly, and the proof goes in the thread.",
  },
];

export default async function FundPage({
  searchParams,
}: {
  searchParams: Promise<{ to?: string | string[]; c?: string | string[] }>;
}) {
  const params = await searchParams;

  return (
    <div className="min-h-screen bg-canvasBlack text-sheetWhite">
      <NavBar />

      <main className="mx-auto max-w-[1500px] px-4 pb-24 pt-10 sm:px-6">
        {/* ── What this is ───────────────────────────────────────────── */}
        <section className="border-b-4 border-spiteCrimson pb-8">
          <h1 className="text-5xl font-black uppercase leading-[0.9] tracking-[-0.05em] sm:text-7xl">
            The fund<span className="text-spiteCrimson">.</span>
          </h1>
          <p className="mt-4 max-w-2xl font-mono text-[13px] leading-relaxed text-sheetWhite/80">
            Money for food, legal aid, medical care and shelter. The forum
            decides where it goes. The wallet is public, and this site can only
            read it.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <a
              href="#forum"
              className="border-2 border-black bg-spiteCrimson px-5 py-3 font-mono text-[11px] font-black uppercase tracking-[0.18em] text-sheetWhite shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all hover:bg-black hover:text-hypeNeon active:translate-x-1 active:translate-y-1 active:shadow-none"
            >
              Go to the forum ↓
            </a>
            <Link
              href="/submit"
              className="border-2 border-black bg-sheetWhite px-5 py-3 font-mono text-[11px] font-black uppercase tracking-[0.18em] text-canvasBlack shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all hover:bg-hypeNeon active:translate-x-1 active:translate-y-1 active:shadow-none"
            >
              Propose a name
            </Link>
          </div>
        </section>

        {/* ── The wallet ─────────────────────────────────────────────── */}
        <section className="mt-8 grid gap-3 lg:grid-cols-[1.2fr_1fr]">
          <div className="border-2 border-black bg-sheetWhite/[0.03] p-5 sm:p-6">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-mono text-[10px] font-bold uppercase tracking-[0.25em] text-hypeNeon">
                in the wallet
              </h2>
              <span className="font-mono text-[9px] uppercase tracking-[0.15em] text-chop-muted">
                public · the site cannot spend it
              </span>
            </div>

            <TreasuryStats wallet={FUND_WALLET} />

            <div className="mt-4">
              <CopyAddress address={FUND_WALLET} label="copy address" />
            </div>

            <div className="mt-3 flex flex-wrap gap-4 font-mono text-[10px] uppercase tracking-[0.12em]">
              <a
                href={`https://solscan.io/account/${FUND_WALLET}`}
                target="_blank"
                rel="noreferrer noopener"
                className="text-chop-muted underline decoration-chop-muted/40 hover:text-hypeNeon"
              >
                see it on Solscan
              </a>
              <a
                href={`https://pump.fun/coin/${CHOP_MINT}`}
                target="_blank"
                rel="noreferrer noopener"
                className="text-chop-muted underline decoration-chop-muted/40 hover:text-hypeNeon"
              >
                buy $CHOP
              </a>
            </div>
          </div>

          <div className="border-2 border-black bg-canvasBlack p-5 sm:p-6">
            <h2 className="font-mono text-[10px] font-bold uppercase tracking-[0.25em] text-spiteCrimson">
              the honest version
            </h2>
            <p className="mt-3 font-mono text-[12px] leading-relaxed text-chop-muted">
              <span className="font-bold text-sheetWhite">$CHOP is a meme.</span>{" "}
              Buying it is not a donation, it is not an investment, and it can
              go to zero.
            </p>
            <p className="mt-3 font-mono text-[12px] leading-relaxed text-chop-muted">
              If you want to fund the work, send SOL to the wallet. If you want
              the joke, buy the coin.
            </p>
            <p className="mt-4 border-t border-chop-border pt-3 font-mono text-[10px] uppercase tracking-[0.12em] text-chop-muted">
              No treasury key on this site. No grant without a receipt.
            </p>
          </div>
        </section>

        {/* ── How it works ───────────────────────────────────────────── */}
        <section className="mt-8 grid gap-3 sm:grid-cols-3">
          {STEPS.map((step) => (
            <div key={step.n} className="border-2 border-black bg-canvasBlack p-5">
              <p className="font-mono text-3xl font-black leading-none tracking-tighter text-spiteCrimson">
                {step.n}
              </p>
              <h3 className="mt-2 text-sm font-black uppercase tracking-tight">
                {step.title}
              </h3>
              <p className="mt-1 font-mono text-[11px] leading-relaxed text-chop-muted">
                {step.body}
              </p>
            </div>
          ))}
        </section>

        {/* ── The forum ──────────────────────────────────────────────── */}
        <div id="forum" className="mt-14 scroll-mt-24">
          <ForumFrame initialPath={initialPath(params)} />
        </div>

        <p className="mt-8 border-t-2 border-black pt-4 font-mono text-[10px] leading-relaxed text-chop-muted">
          <span className="font-bold text-sheetWhite">The limits:</span> food,
          water, shelter, legal aid and medical aid, paid to named
          organisations. No weapons, no violence.
        </p>
      </main>
    </div>
  );
}