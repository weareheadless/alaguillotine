"use client";

import Link from "next/link";
import { Fragment, useEffect, useState, type CSSProperties } from "react";
import type { FeedItem } from "@/lib/feed";
import { dispatchStyle } from "@/lib/dispatch-style";
import { mosaicDate, mosaicItems } from "@/lib/feed-mosaic";
import { usePromise } from "@/lib/use-promise";
import { safeHref } from "@/lib/url";
import { useDrawer } from "./drawers";
import styles from "./FeedMosaic.module.css";

function Tile({ item, index }: { item: FeedItem; index: number }) {
  const [failedImage, setFailedImage] = useState(false);
  const receipt = item.source === "receipt";
  const dispatch = item.source === "dispatch";
  const claim = item.kind === "charge";
  // A claim's label is metadata — place, year, sources. Its analysis is the
  // take. Printing the label where the take belongs is how "Ada's take" became
  // a line of domain names.
  const analysis = claim ? (item.take ?? "") : item.gloss;
  const lead = index === 0;
  const feature = index === 1;
  const palette = dispatchStyle(item.category);
  const external = /^https?:\/\//.test(item.url);
  const image = !receipt && !failedImage && /^https:\/\//.test(item.image ?? "");
  const split = receipt ? item.title.indexOf(":") : -1;
  const date = mosaicDate(item.publishedAt);
  const heading = receipt && split > -1 ? item.title.slice(split + 1).trim() : item.title;
  const content = <>
    <div className={styles.meta}>
      <span className={styles.category}>{palette.label}</span>
      <span>{dispatch ? "Ada · dispatch" : receipt ? "The public record" : claim ? item.gloss : "Source reporting"}</span>
    </div>
    {image && <div className={styles.media}>
      {/* Only the source's image, never generated news imagery. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={item.image} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer"
        onError={() => setFailedImage(true)} />
      <span>Source image</span>
    </div>}
    <div className={styles.body}>
      {receipt && split > -1 && <p className={styles.name}>{item.title.slice(0, split)}</p>}
      <h3 className={receipt && split > -1 ? styles.amount : styles.title}>{heading}</h3>
      {analysis && <div className={styles.commentary}>
        {!receipt && !dispatch && <span>{claim ? "Why this is on the record" : "Ada’s take"}</span>}
        <p>{analysis}</p>
      </div>}
    </div>
    <div className={styles.footer}>
      <span className={styles.source}>{claim ? "Open the claim" : dispatch ? "Read Ada" : receipt ? "Open dossier" : item.source || "Read the reporting"}
        {date && <> · <time dateTime={item.publishedAt}>{date}</time></>}</span>
      <span aria-hidden="true">{external ? "↗" : "→"}</span>
    </div>
    {!receipt && !dispatch && <p className={styles.caveat}>{claim ? "A claim on the record, not a verdict" : "Source reporting · not independently verified"}</p>}
  </>;
  const className = [styles.tile, lead ? styles.lead : "", feature ? styles.feature : "",
    receipt ? styles.receipt : "", dispatch ? styles.dispatch : "",
    index >= 6 ? styles.late : "",
    index === 4 || index === 9 ? styles.wide : ""].filter(Boolean).join(" ");
  const style = { "--mosaic-accent": palette.accent } as CSSProperties;

  return <article className={className} style={style}>
    {external
      ? <a className={styles.cardLink} href={safeHref(item.url)} target="_blank" rel="noopener noreferrer">{content}</a>
      : <Link className={styles.cardLink} href={item.url}>{content}</Link>}
  </article>;
}

function PromoTile() {
  const { text, number } = usePromise();
  const { show } = useDrawer();

  return <article className={`${styles.tile} ${styles.promo}`}>
    <button
      type="button"
      onClick={() => show("fund")}
      className={`${styles.cardLink} w-full text-left`}
    >
      <div className={styles.meta}>
        <span className={styles.category}>Sponsored</span>
        <span>Ada · financial advice</span>
      </div>
      <div className={styles.body}>
        <p className={styles.promoLabel}>The pitch · #{number ?? "—"}</p>
        <h3 className={styles.title}>{text ? `“${text}”` : "Loading the pitch…"}</h3>
      </div>
      <div className={styles.footer}>
        <span className={styles.source}>$CHOP · the fund</span>
        <span aria-hidden="true">→</span>
      </div>
      <p className={styles.caveat}>Paid placement · satire · not financial advice</p>
    </button>
  </article>;
}

export function FeedMosaic() {
  const [attempt, setAttempt] = useState(0);
  const [items, setItems] = useState<FeedItem[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      controller.abort();
      setStatus("error");
    }, 15_000);
    setStatus("loading");
    async function load() {
      try {
        const response = await fetch("/api/feed?limit=24", { signal: controller.signal });
        if (!response.ok) throw new Error("Feed unavailable");
        const data = await response.json() as { items?: FeedItem[] };
        if (!Array.isArray(data.items)) throw new Error("Invalid feed");
        if (!controller.signal.aborted) { setItems(mosaicItems(data.items)); setStatus("ready"); }
      } catch {
        if (!controller.signal.aborted) setStatus("error");
      } finally {
        window.clearTimeout(timeout);
      }
    }
    void load();
    return () => { controller.abort(); window.clearTimeout(timeout); };
  }, [attempt]);

  return <section className={styles.section} aria-labelledby="home-feed-title">
    <header className={styles.heading}>
      <div><p>The wire. The receipts. The people behind them.</p><h2 id="home-feed-title">The feed</h2></div>
      <Link href="/feed">Full feed <span aria-hidden="true">↗</span></Link>
    </header>
    {status === "loading" ? <>
      <p className={styles.srOnly} role="status">Loading the feed…</p>
      <div className={styles.grid} aria-hidden="true">{Array.from({ length: 10 }, (_, i) =>
        <div key={i} className={`${styles.skeleton} ${i === 0 ? styles.lead : i === 1 ? styles.feature : i === 4 || i === 9 ? styles.wide : ""}`} />)}</div>
    </> : status === "error" ? <div className={styles.empty} role="status">
      <p>The feed didn’t load.</p><button onClick={() => setAttempt(value => value + 1)}>Try again</button>
      <Link href="/feed">Open the full feed →</Link>
    </div> : items.length ? <div className={styles.grid}>{items.map((item, index) =>
      <Fragment key={item.id}>
        <Tile item={item} index={index} />
        {/* 2×2 sponsored slot: the grid's cell count is balanced around it. */}
        {index === 1 && <PromoTile />}
      </Fragment>)}</div>
      : <div className={styles.empty}><p>No feed items available yet.</p><Link href="/feed">Explore the feed →</Link></div>}
    {status === "ready" && items.length > 0 && <footer className={styles.continue}>
      <span>A selection, not the whole story.</span><Link href="/feed">Continue in the full feed →</Link>
    </footer>}
  </section>;
}
