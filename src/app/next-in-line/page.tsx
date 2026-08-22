"use client";

import { useMemo, useState } from "react";
import { NavBar } from "@/components/NavBar";

type Billionaire = {
  name: string;
  mark: string;
  source: string;
  fortune: string;
  charity: string;
  taxes: string;
  support: string;
  fortuneValue: number;
  flag: string;
};

const BILLIONAIRES: Billionaire[] = [
  { name: "Elon Musk", mark: "01", source: "Tesla · SpaceX · xAI", fortune: "$247B", charity: "$5.7B", taxes: "$11B", support: "$3.7B", fortuneValue: 247, flag: "largest fortune in the line" },
  { name: "Mark Zuckerberg", mark: "02", source: "Meta", fortune: "$190B", charity: "$3.7B", taxes: "$2.9B", support: "$0", fortuneValue: 190, flag: "philanthropy mostly via foundation" },
  { name: "Jeff Bezos", mark: "03", source: "Amazon · Blue Origin", fortune: "$194B", charity: "$2.5B", taxes: "$1.7B", support: "$4.7B", fortuneValue: 194, flag: "public incentives tied to Amazon footprint" },
  { name: "Larry Ellison", mark: "04", source: "Oracle", fortune: "$190B", charity: "$0.2B", taxes: "$3.0B", support: "$0.6B", fortuneValue: 190, flag: "giving is concentrated, not broad" },
  { name: "Bernard Arnault", mark: "05", source: "LVMH", fortune: "$168B", charity: "$0.3B", taxes: "$2.5B", support: "$0.2B", fortuneValue: 168, flag: "luxury empire, public cultural support" },
  { name: "Larry Page", mark: "06", source: "Alphabet", fortune: "$148B", charity: "$0.4B", taxes: "$1.5B", support: "$0", fortuneValue: 148, flag: "quiet giving, limited disclosure" },
  { name: "Sergey Brin", mark: "07", source: "Alphabet", fortune: "$142B", charity: "$0.3B", taxes: "$1.4B", support: "$0", fortuneValue: 142, flag: "quiet giving, limited disclosure" },
  { name: "Steve Ballmer", mark: "08", source: "Microsoft · LA Clippers", fortune: "$126B", charity: "$2.2B", taxes: "$1.1B", support: "$0.1B", fortuneValue: 126, flag: "high reported lifetime giving" },
  { name: "Jensen Huang", mark: "09", source: "NVIDIA", fortune: "$118B", charity: "$0.1B", taxes: "$0.8B", support: "$0", fortuneValue: 118, flag: "wealth tracks chip demand" },
  { name: "Michael Bloomberg", mark: "10", source: "Bloomberg LP", fortune: "$105B", charity: "$17.0B", taxes: "$2.6B", support: "$0", fortuneValue: 105, flag: "largest disclosed giver in this index" },
  { name: "Peter Thiel", mark: "11", source: "Palantir · Founders Fund", fortune: "$12B", charity: "$0.1B", taxes: "$0.1B", support: "$0.2B", fortuneValue: 12, flag: "political spending excluded" },
  { name: "Donald Trump", mark: "12", source: "Real estate · brand licensing", fortune: "$5B", charity: "$0.1B", taxes: "$0.1B", support: "$0.0B", fortuneValue: 5, flag: "figures are especially disputed" },
];

const formatCurrency = (value: string) => value === "$0" ? "—" : value;
const amountInBillions = (value: string) => Number.parseFloat(value.replace("$", "").replace("B", "")) || 0;

export default function NextInLinePage() {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"fortune" | "charity" | "taxes">("fortune");

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return BILLIONAIRES
      .filter((person) => !needle || `${person.name} ${person.source}`.toLowerCase().includes(needle))
      .sort((a, b) => {
        if (sort === "fortune") return b.fortuneValue - a.fortuneValue;
        return amountInBillions(b[sort]) - amountInBillions(a[sort]);
      });
  }, [query, sort]);

  return (
    <div className="min-h-screen bg-canvasBlack text-sheetWhite">
      <NavBar />
      <main className="mx-auto max-w-7xl px-4 pb-24 pt-12 sm:px-6 lg:px-10">
        <section className="grid gap-10 border-b-4 border-spiteCrimson pb-12 lg:grid-cols-[1.25fr_0.75fr] lg:items-end">
          <div>
            <p className="mb-4 inline-flex border border-hypeNeon/60 px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-hypeNeon">the ledger is open</p>
            <h1 className="max-w-4xl text-5xl font-black uppercase leading-[0.88] tracking-[-0.07em] text-sheetWhite sm:text-7xl lg:text-8xl">
              Next <span className="text-spiteCrimson">in line.</span>
            </h1>
            <p className="mt-6 max-w-2xl font-mono text-sm leading-relaxed text-chop-muted sm:text-base">
              A readable index of concentrated wealth: what they own, what they give away, what they pay, and how much public support their empires touch. The point is not gossip. The point is the ratio.
            </p>
          </div>
          <div className="border-l-2 border-hypeNeon pl-5 font-mono text-xs leading-relaxed text-chop-muted">
            <p className="text-hypeNeon">// HOW TO READ THIS</p>
            <p className="mt-3">Fortune is an estimated net worth. Charity is reported giving. Taxes are estimated personal or disclosed tax payments. Public support is a visible estimate of subsidies, tax credits, grants, or incentives connected to their companies, not a claim that the individual received cash personally.</p>
          </div>
        </section>

        <section className="grid gap-3 py-10 sm:grid-cols-3">
          <div className="border-2 border-black bg-sheetWhite p-5 text-canvasBlack">
            <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-spiteCrimson">combined fortune</p>
            <p className="mt-2 text-4xl font-black tracking-tighter">$1.65T</p>
            <p className="mt-1 font-mono text-[10px] text-black/60">12 names in the public estimate index</p>
          </div>
          <div className="border-2 border-hypeNeon bg-hypeNeon p-5 text-canvasBlack">
            <p className="font-mono text-[10px] font-bold uppercase tracking-widest">combined giving</p>
            <p className="mt-2 text-4xl font-black tracking-tighter">$32.8B</p>
            <p className="mt-1 font-mono text-[10px] text-black/60">reported charitable giving, not promises</p>
          </div>
          <div className="border-2 border-spiteCrimson bg-spiteCrimson p-5 text-sheetWhite">
            <p className="font-mono text-[10px] font-bold uppercase tracking-widest">public support tracked</p>
            <p className="mt-2 text-4xl font-black tracking-tighter">$8.8B</p>
            <p className="mt-1 font-mono text-[10px] text-white/70">company-linked incentives in this snapshot</p>
          </div>
        </section>

        <section className="border-t-2 border-chop-border pt-6">
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-chop-muted">01—12 / active index</p>
              <h2 className="mt-1 text-2xl font-black uppercase tracking-tight">The queue</h2>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search a name or empire" className="border-2 border-chop-border bg-white/5 px-3 py-2 font-mono text-xs text-sheetWhite outline-none placeholder:text-chop-muted focus:border-hypeNeon" />
              <button type="button" onClick={() => setSort((current) => current === "fortune" ? "charity" : current === "charity" ? "taxes" : "fortune")} className="border-2 border-hypeNeon px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-widest text-hypeNeon transition-colors duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] hover:bg-hypeNeon hover:text-canvasBlack">Sort: {sort}</button>
            </div>
          </div>

          <div className="space-y-3">
            {filtered.map((person) => (
              <article key={person.name} className="group grid gap-5 border-2 border-chop-border bg-white/[0.03] p-4 transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] hover:-translate-y-1 hover:border-spiteCrimson sm:grid-cols-[3.5rem_1.4fr_repeat(4,minmax(0,1fr))] sm:items-center sm:p-5">
                <div className="font-mono text-2xl font-black text-spiteCrimson/70">{person.mark}</div>
                <div>
                  <h3 className="text-xl font-black uppercase tracking-tight group-hover:text-spiteCrimson">{person.name}</h3>
                  <p className="mt-1 font-mono text-[10px] uppercase tracking-wider text-chop-muted">{person.source}</p>
                  <p className="mt-3 font-mono text-[10px] text-hypeNeon">{person.flag}</p>
                </div>
                <Metric label="fortune" value={person.fortune} accent="white" />
                <Metric label="charity" value={formatCurrency(person.charity)} accent="green" />
                <Metric label="taxes" value={formatCurrency(person.taxes)} accent="red" />
                <Metric label="public support" value={formatCurrency(person.support)} accent="amber" />
              </article>
            ))}
          </div>
        </section>

        <footer className="mt-12 border-t-2 border-dashed border-chop-border pt-5 font-mono text-[10px] leading-relaxed text-chop-muted">
          Snapshot for interface purposes. Figures are rounded public estimates and should be replaced with dated source links before publication. Missing disclosure is shown as an em dash, not zero.
        </footer>
      </main>
    </div>
  );
}

function Metric({ label, value, accent }: { label: string; value: string; accent: "white" | "green" | "red" | "amber" }) {
  const colors = { white: "text-sheetWhite", green: "text-hypeNeon", red: "text-spiteCrimson", amber: "text-amber-400" };
  return <div className="border-l border-chop-border pl-3"><p className="font-mono text-[9px] uppercase tracking-widest text-chop-muted">{label}</p><p className={`mt-1 text-2xl font-black tracking-tighter ${colors[accent]}`}>{value}</p></div>;
}
