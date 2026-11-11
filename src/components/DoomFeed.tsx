"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { dispatchStyle } from "@/lib/dispatch-style";
import type { FeedItem } from "@/lib/feed";

/**
 * The doom scroll.
 *
 * Cards are posts. The wire is endless, the record is finite, and the page
 * says so: it counts what you have read and how long it took, and it does not
 * record any of it. The only thing that grows is the meter above.
 */

const ADS = [
  {
    title: "$CHOP",
    body: "The only asset that admits it is a meme. Hold it, or don't; the record is public either way.",
    note: "This ad cannot follow you. There is no pixel. It paid for the servers, and you can read the wallet.",
  },
  {
    title: "THE FUND",
    body: "A meme coin with a ledger and no promises. The wallet is public. The yield is a joke.",
    note: "No targeting. No profile of you. The ad is here because it is ours.",
  },
];

function Card({ item }: { item: FeedItem }) {
  const plain = item.category === "wire";
  const style = dispatchStyle(plain ? "extraction" : item.category);
  const accent =
    item.kind === "record" ? "#F4F4F5" : plain ? "#3F3F46" : style.accent;
  const ink = item.kind === "record" || plain ? "#0B0B0C" : style.ink;
  const label =
    item.kind === "record"
      ? `the record · ${item.source}`
      : plain
        ? "the wire"
        : style.label;
  // A record leads with the fact; the wire leads with Ada's charge.
  const lead =
    item.kind === "record" ? item.title : item.gloss || item.title;
  const sub =
    item.kind === "record"
      ? item.gloss
      : item.gloss
        ? item.title
        : "";
  const external = item.url.startsWith("http");
  const why =
    item.kind === "record"
      ? "why: it is in the record"
      : item.clusterSize > 1
        ? `why: ${item.clusterSize} communities posted it`
        : `why: severity ${item.severity} · ${item.score} points`;

  const inner = (
    <>
      <div
        className="flex items-center gap-2 border-b-2 border-black px-2.5 py-1"
        style={{ backgroundColor: accent, color: ink }}
      >
        <span className="h-1.5 w-1.5 shrink-0" style={{ backgroundColor: ink }} />
        <span className="text-[8px] font-black uppercase tracking-[0.22em]">
          {label}
        </span>
        <span className="ml-auto truncate text-[7px] font-bold uppercase tracking-[0.1em] opacity-60">
          {item.clusterSize > 1
            ? `${item.clusterSize} communities, one story`
            : item.source}
        </span>
      </div>
      <div className="p-3">
        <p className="text-[14px] font-bold leading-snug text-sheetWhite">
          {lead}
        </p>
        {sub && (
          <p className="mt-1.5 font-mono text-[10px] leading-relaxed text-chop-muted">
            {sub}
          </p>
        )}
        <p className="mt-2 font-mono text-[7.5px] uppercase tracking-[0.12em] text-chop-muted/70">
          {why}
        </p>
      </div>
    </>
  );

  const shell =
    "block border-2 border-black bg-[#0E0E10] transition-colors hover:bg-[#141417]";

  if (external) {
    return (
      <a href={item.url} target="_blank" rel="noreferrer" className={shell}>
        {inner}
      </a>
    );
  }
  return (
    <Link href={item.url} className={shell}>
      {inner}
    </Link>
  );
}

function AdCard({ index }: { index: number }) {
  const ad = ADS[index % ADS.length];
  return (
    <div className="border-2 border-black bg-[#FDE047] p-3 text-canvasBlack">
      <div className="flex items-center gap-2 border-b-2 border-black pb-1.5">
        <span className="text-[8px] font-black uppercase tracking-[0.22em]">
          ad · the fund
        </span>
        <span className="ml-auto text-[7px] font-bold uppercase tracking-[0.12em] opacity-60">
          no pixel
        </span>
      </div>
      <p className="mt-2 font-black uppercase tracking-tight text-lg leading-none">
        {ad.title}
      </p>
      <p className="mt-1.5 font-mono text-[11px] leading-relaxed">{ad.body}</p>
      <p className="mt-2 font-mono text-[7.5px] uppercase leading-relaxed tracking-[0.1em] opacity-60">
        {ad.note}
      </p>
    </div>
  );
}

export function DoomFeed({
  initial,
  total,
  read,
  discarded,
}: {
  initial: FeedItem[];
  total: number;
  read: number;
  discarded: number;
}) {
  const [items, setItems] = useState<FeedItem[]>(initial);
  const [done, setDone] = useState(initial.length >= total);
  const [endDismissed, setEndDismissed] = useState(false);
  const [minutes, setMinutes] = useState(0);
  const loading = useRef(false);
  const offset = useRef(initial.length);
  const ids = useRef(new Set(initial.map((item) => item.id)));
  const sentinel = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const start = Date.now();
    const timer = setInterval(
      () => setMinutes(Math.floor((Date.now() - start) / 60_000)),
      10_000,
    );
    return () => clearInterval(timer);
  }, []);

  const loadMore = useCallback(async () => {
    if (loading.current || done) return;
    loading.current = true;
    try {
      const res = await fetch(`/api/feed?offset=${offset.current}&limit=8`);
      const data = (await res.json()) as { items?: FeedItem[]; total?: number };
      const batch = data.items ?? [];
      const fresh = batch.filter((item) => !ids.current.has(item.id));
      for (const item of fresh) ids.current.add(item.id);
      offset.current += batch.length;
      if (fresh.length > 0) {
        setItems((prev) => [...prev, ...fresh]);
      }
      if (batch.length === 0 || offset.current >= (data.total ?? 0)) {
        setDone(true);
      }
    } catch {
      setDone(true);
    } finally {
      loading.current = false;
    }
  }, [done]);

  useEffect(() => {
    const node = sentinel.current;
    if (!node || done) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) void loadMore();
      },
      { rootMargin: "700px 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [loadMore, done]);

  return (
    <div className="mx-auto max-w-2xl px-4 pb-28 pt-6">
      <header className="mb-4">
        <p className="font-mono text-[9px] uppercase tracking-[0.35em] text-spiteCrimson">
          social · doom
        </p>
        <h1 className="mt-2 text-3xl font-black uppercase leading-none tracking-tighter md:text-4xl">
          The <span className="text-spiteCrimson">Feed</span>
        </h1>
        <p className="mt-2 max-w-xl font-mono text-[11px] leading-relaxed text-chop-muted">
          They post. You are the product. Every card is a story from the
          federated wire, a receipt from the record, or a dispatch. The ranking
          is published, the metrics are labelled, and nothing here is recorded
          about you.
        </p>
        <p className="mt-3 border-y border-chop-border py-2 font-mono text-[8.5px] uppercase leading-relaxed tracking-[0.14em] text-chop-muted">
          the wire: <b className="text-sheetWhite">{read}</b> items read ·{" "}
          <b className="text-sheetWhite">{discarded}</b> carried no charge and are
          not here. the refusal is the edit.
        </p>
        <details className="mt-3">
          <summary className="cursor-pointer font-mono text-[8.5px] font-black uppercase tracking-[0.2em] text-spiteCrimson">
            why am I seeing this?
          </summary>
          <p className="mt-2 border-l-2 border-spiteCrimson pl-3 font-mono text-[10px] leading-relaxed text-chop-muted">
            Heat = severity × 10 + community score + 200 ÷ hours since the feed
            first saw it. Severity is Ada&apos;s judgement of the mechanism, not
            the story&apos;s volume. Duplicates are collapsed: twelve
            communities posting the same press release is one story. There is no
            profile of you, no cookie, no dwell time, no advertiser bidding. The
            feed cannot follow you off the page because it does not know who you
            are.
          </p>
        </details>
      </header>

      <div className="space-y-3">
        {items.map((item, index) => (
          <div key={item.id} className="space-y-3">
            <Card item={item} />
            {(index + 1) % 7 === 0 && <AdCard index={index} />}
            {index === 23 && !endDismissed && (
              <div className="border-2 border-spiteCrimson bg-spiteCrimson/10 p-4 text-center">
                <p className="text-[13px] font-black uppercase tracking-tight text-sheetWhite">
                  You have reached the end of your attention.
                </p>
                <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.18em] text-chop-muted">
                  The wire does not end. It is not designed to.
                </p>
                <button
                  type="button"
                  onClick={() => setEndDismissed(true)}
                  className="mt-3 border-2 border-black bg-spiteCrimson px-3 py-1.5 font-mono text-[9px] font-black uppercase tracking-[0.18em] text-sheetWhite"
                >
                  keep scrolling
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      <div ref={sentinel} className="h-24" />

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t-2 border-chop-border pt-3 font-mono text-[8.5px] uppercase tracking-[0.14em] text-chop-muted">
        <span>
          <b className="text-sheetWhite">{items.length}</b> posts ·{" "}
          <b className="text-sheetWhite">{minutes}</b> min · 0 recorded
        </span>
        <span>{done ? "the wire is quiet" : "loading"}</span>
      </div>
    </div>
  );
}
