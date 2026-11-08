import Link from "next/link";
import { NavBar } from "@/components/NavBar";
import { CopyAddress } from "@/components/CopyAddress";
import { CHOP_MINT, FUND_WALLET, readForumTopics } from "@/lib/treasury";
import { TreasuryStats } from "@/components/TreasuryStats";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "The Resistance — A LA GUILLOTINE",
  description:
    "The forum, the fund, and the meme. Money goes to food, legal aid, medical aid and shelter, decided in the open and paid with receipts.",
};

const FORUM = "https://forum.alaguillotine.com";

/** In-site links go through /forum, which frames the forum under the site nav. */
const forumLink = (path = "/") =>
  path === "/" ? "/forum" : `/forum?to=${encodeURIComponent(path)}`;

export default async function ResistancePage() {
  const topics = await readForumTopics(6);

  return (
    <div className="min-h-screen bg-canvasBlack text-sheetWhite">
      <NavBar />

      <main className="mx-auto max-w-6xl px-4 pb-24 pt-10 sm:px-6">
        {/* ── Hero ───────────────────────────────────────────────────── */}
        <section className="border-b-4 border-spiteCrimson pb-8">
          <p className="font-mono text-[10px] uppercase tracking-[0.35em] text-chop-muted">
            the part that is not a joke
          </p>
          <h1 className="mt-3 text-5xl font-black uppercase leading-[0.86] tracking-[-0.06em] sm:text-8xl">
            The resistance <span className="text-spiteCrimson">has a fund.</span>
          </h1>
          <p className="mt-5 max-w-2xl font-mono text-[12px] leading-relaxed text-chop-muted">
            The blade is satire. The ledger is real. The money is the part where
            the joke turns around and does something useful: food, water, legal
            aid, medical aid, shelter — paid to named organisations, decided in
            the open, with the receipt posted next to the story.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href={forumLink()}
              className="border-2 border-black bg-spiteCrimson px-5 py-3 font-mono text-[11px] font-black uppercase tracking-[0.2em] text-sheetWhite shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all hover:bg-black hover:text-hypeNeon active:translate-x-1 active:translate-y-1 active:shadow-none"
            >
              Open the forum →
            </Link>
            <Link
              href="/submit"
              className="border-2 border-black bg-sheetWhite px-5 py-3 font-mono text-[11px] font-black uppercase tracking-[0.2em] text-canvasBlack shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all hover:bg-hypeNeon active:translate-x-1 active:translate-y-1 active:shadow-none"
            >
              Propose a name
            </Link>
          </div>
        </section>

        {/* ── The fund ───────────────────────────────────────────────── */}
        <section className="mt-10 grid gap-6 lg:grid-cols-[1fr_340px]">
          <div className="border-2 border-black bg-sheetWhite/[0.03] p-5 sm:p-7">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-mono text-[10px] font-bold uppercase tracking-[0.3em] text-hypeNeon">
                the fund
              </h2>
              <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-chop-muted">
                public wallet · the site cannot spend it
              </span>
            </div>

            <TreasuryStats wallet={FUND_WALLET} mint={CHOP_MINT} />

            <p className="mt-4 font-mono text-[10px] leading-relaxed text-chop-muted">
              Read straight from the chain, not from our own books. If the read
              fails, we show nothing rather than a comforting number. Send
              $CHOP or SOL to this address; the balance above is the whole
              accounting.
            </p>

            <div className="mt-4">
              <CopyAddress address={FUND_WALLET} label="copy address" />
            </div>

            <div className="mt-3 flex flex-wrap gap-4 font-mono text-[10px] uppercase tracking-[0.15em]">
              <a
                href={`https://solscan.io/account/${FUND_WALLET}`}
                target="_blank"
                rel="noreferrer noopener"
                className="text-chop-muted underline decoration-chop-muted/40 hover:text-hypeNeon"
              >
                view on solscan
              </a>
              <Link
                href={forumLink()}
                className="text-chop-muted underline decoration-chop-muted/40 hover:text-hypeNeon"
              >
                argue about it in the forum
              </Link>
            </div>
          </div>

          {/* ── How it moves ─────────────────────────────────────────── */}
          <aside className="border-2 border-black bg-canvasBlack p-5">
            <h2 className="font-mono text-[10px] font-bold uppercase tracking-[0.3em] text-spiteCrimson">
              how the money moves
            </h2>
            <ol className="mt-4 space-y-4 font-mono text-[11px] leading-relaxed text-chop-muted">
              <li>
                <span className="font-black text-sheetWhite">01 · argue.</span>{" "}
                Someone posts a proposal in <em>THE FUND</em>: who gets it, how
                much, what for, and how we check it.
              </li>
              <li>
                <span className="font-black text-sheetWhite">02 · vote.</span>{" "}
                When there is money to move, a moderator puts the proposal to a
                vote. One person, one voice. Money buys no weight here.
              </li>
              <li>
                <span className="font-black text-sheetWhite">03 · pay.</span>{" "}
                The wallet pays the named organisation directly. No middleman,
                no personal wallet in between.
              </li>
              <li>
                <span className="font-black text-sheetWhite">04 · prove.</span>{" "}
                The receipt is posted in the same thread. Every grant is public,
                including the boring ones.
              </li>
            </ol>
            <p className="mt-4 border-t-2 border-black pt-3 font-mono text-[9px] uppercase leading-relaxed tracking-[0.15em] text-chop-muted">
              No custody. No treasury key on this site. No grant without a
              receipt.
            </p>
          </aside>
        </section>

        {/* ── $CHOP ─────────────────────────────────────────────────── */}
        <section className="mt-10 border-2 border-black bg-hypeNeon p-5 text-canvasBlack sm:p-7">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-mono text-[10px] font-black uppercase tracking-[0.3em]">
              $CHOP · the meme
            </h2>
            <span className="font-mono text-[9px] font-bold uppercase tracking-[0.2em]">
              token-2022 · fixed supply · no mint authority
            </span>
          </div>
          <p className="mt-4 max-w-3xl font-mono text-[12px] leading-relaxed">
            $CHOP is the joke that pays for the punchline. It is a memecoin with
            a public wallet attached. <strong>Buying it is not a donation</strong>
            , it is not a security, it is not an investment, and it can go to
            zero. The fund does not depend on it. If you want to actually fund
            the work, send SOL to the wallet above. If you want the bit, buy the
            coin.
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <a
              href={`https://pump.fun/coin/${CHOP_MINT}`}
              target="_blank"
              rel="noreferrer noopener"
              className="border-2 border-black bg-canvasBlack px-5 py-3 font-mono text-[11px] font-black uppercase tracking-[0.2em] text-hypeNeon shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] transition-all hover:bg-spiteCrimson hover:text-sheetWhite active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
            >
              Buy $CHOP on pump.fun →
            </a>
            <a
              href={`https://solscan.io/token/${CHOP_MINT}`}
              target="_blank"
              rel="noreferrer noopener"
              className="font-mono text-[10px] font-bold uppercase tracking-[0.15em] underline decoration-black/40 hover:decoration-black"
            >
              contract
            </a>
          </div>
          <p className="mt-3 break-all font-mono text-[10px] text-black/60">
            {CHOP_MINT}
          </p>
        </section>

        {/* ── Forum ─────────────────────────────────────────────────── */}
        <section className="mt-10 grid gap-6 lg:grid-cols-[1fr_300px]">
          <div className="border-2 border-black bg-sheetWhite/[0.03] p-5 sm:p-7">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-mono text-[10px] font-bold uppercase tracking-[0.3em] text-sheetWhite">
                from the forum
              </h2>
              <Link
                href={forumLink()}
                className="font-mono text-[9px] uppercase tracking-[0.2em] text-hypeNeon hover:underline"
              >
                all threads →
              </Link>
            </div>

            {topics.length > 0 ? (
              <ul className="mt-4 divide-y-2 divide-black">
                {topics.map((topic) => (
                  <li key={topic.id}>
                    <Link
                      href={forumLink(`/post/${topic.id}`)}
                      className="flex flex-wrap items-baseline gap-x-3 gap-y-1 py-3 transition-colors hover:text-hypeNeon"
                    >
                      <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-spiteCrimson">
                        {topic.community.replace(/_/g, " ")}
                      </span>
                      <span className="flex-1 font-mono text-[12px] leading-snug">
                        {topic.title}
                      </span>
                      <span className="font-mono text-[9px] text-chop-muted">
                        {topic.comments} replies
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 font-mono text-[11px] leading-relaxed text-chop-muted">
                The forum is up but quiet. Nothing has been posted yet, which
                makes you early rather than late.
              </p>
            )}

            <p className="mt-4 font-mono text-[10px] leading-relaxed text-chop-muted">
              No email, no wallet, no account age. A human approves every
              account by hand, and every proposal for the fund is argued in
              public before it is paid.
            </p>
          </div>

          <aside className="space-y-3">
            <Link
              href={forumLink("/c/the_fund")}
              className="block border-2 border-black bg-sheetWhite p-4 text-canvasBlack shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] transition-all hover:bg-hypeNeon active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
            >
              <p className="font-mono text-[9px] font-black uppercase tracking-[0.2em] text-spiteCrimson">
                the_fund
              </p>
              <p className="mt-1 font-mono text-[11px] font-bold leading-snug">
                Proposals, votes, receipts.
              </p>
            </Link>
            <Link
              href={forumLink("/c/mutual_aid")}
              className="block border-2 border-black bg-canvasBlack p-4 transition-colors hover:border-hypeNeon"
            >
              <p className="font-mono text-[9px] font-black uppercase tracking-[0.2em] text-hypeNeon">
                mutual_aid
              </p>
              <p className="mt-1 font-mono text-[11px] font-bold leading-snug text-sheetWhite">
                Food, legal aid, medical aid, shelter.
              </p>
            </Link>
            <Link
              href={forumLink("/c/evidence")}
              className="block border-2 border-black bg-canvasBlack p-4 transition-colors hover:border-hypeNeon"
            >
              <p className="font-mono text-[9px] font-black uppercase tracking-[0.2em] text-hypeNeon">
                evidence
              </p>
              <p className="mt-1 font-mono text-[11px] font-bold leading-snug text-sheetWhite">
                Sources that survive a reading.
              </p>
            </Link>
            <Link
              href={forumLink("/c/meta")}
              className="block border-2 border-black bg-canvasBlack p-4 transition-colors hover:border-hypeNeon"
            >
              <p className="font-mono text-[9px] font-black uppercase tracking-[0.2em] text-hypeNeon">
                meta
              </p>
              <p className="mt-1 font-mono text-[11px] font-bold leading-snug text-sheetWhite">
                Rules, moderation, bans.
              </p>
            </Link>
          </aside>
        </section>

        {/* ── Limits ────────────────────────────────────────────────── */}
        <section className="mt-10 border-t-2 border-black pt-6">
          <p className="font-mono text-[10px] leading-relaxed text-chop-muted">
            <span className="font-black text-sheetWhite">The limits:</span> the
            fund pays named organisations for food, water, shelter, legal aid and
            medical aid. It does not buy weapons and does not organise violence.
            The satire is aimed at power; the money is aimed at keeping people
            alive long enough to argue with it. If that is not the revolution
            you wanted, the forum is open.
          </p>
        </section>
      </main>
    </div>
  );
}