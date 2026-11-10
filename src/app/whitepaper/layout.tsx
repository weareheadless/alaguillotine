import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "The Manifesto — why the blade stays a metaphor",
  description:
    "Ada's case for the ledger: names, receipts, and the machinery that makes both necessary. No roadmap, no token pitch, no permission.",
  alternates: { canonical: "/whitepaper" },
  openGraph: {
    title: "The Manifesto — why the blade stays a metaphor",
    description:
      "Ada's case for the ledger: names, receipts, and the machinery that makes both necessary.",
    url: "https://alaguillotine.com/whitepaper",
    siteName: "A LA GUILLOTINE",
  },
};

export default function WhitepaperLayout({ children }: { children: React.ReactNode }) {
  return children;
}
