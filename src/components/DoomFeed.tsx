"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { dispatchStyle } from "@/lib/dispatch-style";
import type { FeedItem } from "@/lib/feed";
import { DOOM_RATES } from "@/lib/doom-rates";

function SessionCheckpoint({ startedAt }: { startedAt: number }) {
  const ref = useRef<HTMLElement>(null);
  const [seconds, setSeconds] = useState<number | null>(null);
  useEffect(() => {
    if (!ref.current) return;
    const observer = new IntersectionObserver(entries => {
      if (!entries[0]?.isIntersecting) return;
      setSeconds(Math.max(0, (Date.now() - startedAt) / 1000));
      observer.disconnect();
    }, { threshold: .3 });
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [startedAt]);
  return <aside ref={ref} className="doom-checkpoint">
    <span className="doom-eyebrow">Meanwhile, outside this tab.</span>
    <h2>The world didn’t<br />pause for the scroll.</h2>
    {seconds !== null && <p>In {Math.floor(seconds)} seconds here, the historical rates equate to
      <strong> ${Math.floor(seconds * DOOM_RATES.wealth).toLocaleString("en-US")}</strong> in billionaire wealth growth and
      <strong> {Math.floor(seconds * DOOM_RATES.co2).toLocaleString("en-US")} tonnes</strong> of fossil CO₂.</p>}
    <a href="#doom-method">An extrapolation, not a live count. Sources ↑</a>
  </aside>;
}

function SourceLink({ item, children }: { item: FeedItem; children: React.ReactNode }) {
  return item.url.startsWith("https://") || item.url.startsWith("http://") ? (
    <a href={item.url} target="_blank" rel="noopener noreferrer" className="doom-source">{children} ↗</a>
  ) : <Link href={item.url} className="doom-source">{children} →</Link>;
}

function Card({ item, index }: { item: FeedItem; index: number }) {
  const style = dispatchStyle(item.category);
  const receipt = item.kind === "record" && item.source === "receipt";
  const dispatch = item.source === "dispatch";
  const claim = item.kind === "charge";
  const awaiting = claim && item.gloss.includes("awaiting review");
  const split = receipt ? item.title.indexOf(":") : -1;
  const [failedImage, setFailedImage] = useState(false);
  const image = item.image && !failedImage;
  const poster = !receipt && !dispatch && !image && index % 4 === 0;
  const [expanded, setExpanded] = useState(false);
  const excerpt = item.excerpt?.split(/\n{2,}/).filter(Boolean) ?? [];

  return (
    <article className={`doom-post ${receipt ? "doom-receipt" : dispatch ? "doom-dispatch" : poster ? "doom-poster" : ""}`}
      style={{ "--doom-accent": style.accent } as React.CSSProperties}>
      <header className="doom-byline">
        <span className="doom-avatar">{claim ? "§" : dispatch ? "A" : receipt ? "$" : "↗"}</span>
        <div><strong>{claim ? "The record" : dispatch ? "Ada Guillotine" : receipt ? "The public record" : item.source || "The wire"}</strong>
          <span>{claim
            ? `${item.community} · ${awaiting ? "filed, awaiting review" : "claim on the record"}`
            : dispatch ? "Dispatch" : receipt ? "Sourced receipt" : "Community reporting · not independently verified"}</span></div>
        <span className="doom-category">{style.label}</span>
      </header>
      {image && <div className="doom-image">
        {/* Source-provided thumbnail, not generated imagery. No referrer sent. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={item.image} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setFailedImage(true)} />
        <span>Source image</span>
      </div>}
      <div className="doom-post-body">
        {receipt && split > -1 ? <>
          <p className="doom-eyebrow">{item.title.slice(0, split)}</p>
          <h2 className="doom-number">{item.title.slice(split + 1).trim()}</h2>
          <p className="doom-receipt-label">{item.gloss}</p>
          <p className="doom-footnote">An entry in the record, not a criminal verdict. Open the dossier for its source and context.</p>
        </> : dispatch ? <>
          <p className="doom-eyebrow">Ada, uninterrupted.</p>
          <h2>{item.title}</h2>
          <p className="doom-dek">{item.gloss}</p>
          {excerpt.length > 0 && <div className="doom-excerpt">
            {(expanded ? excerpt : excerpt.slice(0, 1)).map((text, i) => <p key={i}>{text}</p>)}
            {excerpt.length > 1 && <button onClick={() => setExpanded(!expanded)} aria-expanded={expanded}>{expanded ? "Less" : "Read more here"}</button>}
            {expanded && <small>Excerpt. The full dispatch continues at the link below.</small>}
          </div>}
        </> : claim ? <>
          <p className="doom-eyebrow">{item.gloss}</p>
          <h2 className="!text-[1.1rem] !leading-snug sm:!text-[1.3rem]">{item.title}</h2>
          {item.take && <div className="doom-ada"><b>ADA’S TAKE</b><p>{item.take}</p></div>}
          <p className="mt-3 text-[11px] leading-relaxed text-zinc-500">
            A claim on the record, not a verdict. {awaiting
              ? "Filed by the research pass and not yet reviewed; it scores nothing until a reader passes it."
              : "Reviewed. Its grade, its date and its sources are on the claim page."}
          </p>
        </> : <>
          <p className="doom-eyebrow">{poster ? "Read that again." : style.note}</p>
          <h2>{item.title}</h2>
          {item.gloss && <div className="doom-ada"><b>ADA’S TAKE</b><p>{item.gloss}</p></div>}
        </>}
      </div>
      <footer className="doom-actions">
        <SourceLink item={item}>{claim ? "Open the claim" : receipt ? "Follow the money" : dispatch ? "Full dispatch" : "Read the reporting"}</SourceLink>
        <span>{item.kind === "wire" ? `${item.score.toLocaleString()} community points` : claim ? "Sourced in the record" : "From the archive"}</span>
        {item.clusterSize > 1 && <span>{item.clusterSize} related posts</span>}
      </footer>
    </article>
  );
}

function FundCard() {
  return <aside className="doom-fund"><span className="doom-eyebrow">House ad · $CHOP</span>
    <p>Finally.<br />A coin with the decency<br />to admit it’s a joke.</p>
    <Link href="/?fund=1">Read about the fund →</Link>
    <small>Meme token. No promised returns. SOL is the donation currency.</small>
  </aside>;
}

export function DoomFeed({ initial, total, read, discarded }: {
  initial: FeedItem[]; total: number; read: number; discarded: number;
}) {
  const [items, setItems] = useState(initial);
  const [done, setDone] = useState(initial.length >= total);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const loading = useRef(false);
  const offset = useRef(initial.length);
  const ids = useRef(new Set(initial.map(item => item.id)));
  const sentinel = useRef<HTMLDivElement>(null);
  const startedAt = useRef(Date.now());

  const loadMore = useCallback(async () => {
    if (loading.current || done) return;
    loading.current = true;
    setBusy(true);
    setError(false);
    try {
      const res = await fetch(`/api/feed?offset=${offset.current}&limit=12`);
      if (!res.ok) throw new Error("Feed unavailable");
      const data = await res.json() as { items: FeedItem[]; total: number };
      if (!Array.isArray(data.items)) throw new Error("Invalid feed");
      const fresh = data.items.filter(item => !ids.current.has(item.id));
      fresh.forEach(item => ids.current.add(item.id));
      offset.current += data.items.length;
      setItems(prev => [...prev, ...fresh]);
      setDone(data.items.length === 0 || offset.current >= data.total);
    } catch { setError(true); }
    finally { loading.current = false; setBusy(false); }
  }, [done]);

  useEffect(() => {
    const node = sentinel.current;
    if (!node || done || error) return;
    const observer = new IntersectionObserver(entries => {
      if (entries[0]?.isIntersecting) void loadMore();
    }, { rootMargin: "500px 0px" });
    observer.observe(node);
    return () => observer.disconnect();
  }, [loadMore, done, error, items.length]);

  return <main className="doom-feed">
    <header className="doom-intro">
      <p className="doom-eyebrow">A LA GUILLOTINE / THE FEED</p>
      <h1>The news forgets.<br /><span>This feed doesn’t.</span></h1>
      <p>News. Money. Consequences. Ada keeps the receipts.</p>
      <details><summary>What’s in your feed?</summary>
        <p>Community reporting, Ada’s commentary, receipts and dispatches. No personalised ranking. {read} wire items collected; {discarded} have no published commentary yet—not necessarily rejected.</p>
        <p>Three wire posts, then one record entry while both are available. Within each lane: severity × 10 + min(community score, 200) + 200 / (1 + hours since collection). Record cards are in the order they entered the record, newest first. Related headlines are grouped automatically; grouping can be imperfect.</p>
        <p>No fake reactions, manufactured notifications or generated news photos. External source images may make requests to their host.</p>
      </details>
    </header>
    <div className="doom-stream">
      {items.map((item, index) => <div key={item.id}>
        <Card item={item} index={index} />
        {(index + 1) % 9 === 0 && <FundCard />}
        {index === 11 && <SessionCheckpoint startedAt={startedAt.current} />}
      </div>)}
    </div>
    <div ref={sentinel} className="doom-load" aria-live="polite">
      {error ? <><p>The next posts didn’t load.</p><button onClick={() => void loadMore()}>Try again</button></> :
        done ? <><p>You’re caught up with the published feed.</p><Link href="/next-in-line">Explore the record →</Link></> :
          <button onClick={() => void loadMore()} disabled={busy}>{busy ? "Loading the next posts…" : "More from the wire ↓"}</button>}
    </div>
  </main>;
}
