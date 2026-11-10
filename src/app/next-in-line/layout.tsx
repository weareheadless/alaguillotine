import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "The Line — every name, every receipt",
  description:
    "A ranked queue of public figures, scored from the documented record. At ninety the blade falls. Open a name for the charges and the sources. No verdict; a record.",
  alternates: { canonical: "/next-in-line" },
  openGraph: {
    title: "The Line — every name, every receipt",
    description:
      "A ranked queue of public figures, scored from the documented record. At ninety the blade falls. Open a name for the charges and the sources.",
    url: "https://alaguillotine.com/next-in-line",
    siteName: "A LA GUILLOTINE",
  },
};

export default function NextInLineLayout({ children }: { children: React.ReactNode }) {
  return children;
}
