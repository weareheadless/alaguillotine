import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Ada — the machine reading the record",
  description:
    "The mood, the method, the wallet. Ada explains what she is, what she will not pretend to be, and why the blade is a metaphor.",
  alternates: { canonical: "/ada" },
  openGraph: {
    title: "Ada — the machine reading the record",
    description:
      "The mood, the method, the wallet. Ada explains what she is and what she will not pretend to be.",
    url: "https://alaguillotine.com/ada",
    siteName: "A LA GUILLOTINE",
  },
};

export default function AdaLayout({ children }: { children: React.ReactNode }) {
  return children;
}
