import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";
import { TerminalProvider } from "../lib/terminal-context";
import { LayoutExtras } from "../components/LayoutExtras";
import { GlobalFooter } from "../components/GlobalFooter";
import { DrawerProvider } from "../components/drawers";

export const metadata: Metadata = {
  metadataBase: new URL("https://alaguillotine.com"),
  alternates: { canonical: "/" },
  title: "A LA GUILLOTINE — the blade is a metaphor. The list is not.",
  description:
    "Ada reads the news, names the public figures the reporting holds responsible, and keeps the record. At ninety the blade falls. Every score links to its source.",
  openGraph: {
    type: "website",
    url: "https://alaguillotine.com",
    siteName: "A LA GUILLOTINE",
    title: "A LA GUILLOTINE — the blade is a metaphor. The list is not.",
    description:
      "A doomsday clock for the owning class. Ada reads the news, scores the harm, and lowers the blade. Every number is linked to its source.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "A LA GUILLOTINE — the blade is a metaphor. For now.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "A LA GUILLOTINE — the blade is a metaphor. The list is not.",
    description:
      "A ranked queue of the owners, scored from the documented record. At ninety the blade falls. Every claim links to its source.",
    images: ["/og-image.png"],
  },
  icons: {
    icon: "/static/CHOPsquare.png",
    apple: "/static/CHOPsquare.png",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
        {/* Google Analytics */}
        <Script src="https://www.googletagmanager.com/gtag/js?id=G-MW7Q627SYG" strategy="afterInteractive" />
        <Script id="google-analytics" strategy="afterInteractive">
          {`window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', 'G-MW7Q627SYG');`}
        </Script>
      </head>
      <body className="min-h-screen bg-canvasBlack antialiased font-mono flex flex-col">
        <div className="pointer-events-none fixed inset-0 z-[9998] animate-crt-flicker" aria-hidden="true" />
        <div className="bg-spiteCrimson text-sheetWhite px-4 py-1.5 text-center text-[10px] font-bold uppercase tracking-wider z-[51] relative border-b-2 border-black">
          ⚠️ LEGAL DEPT: This is an interactive art installation &amp; political satire. Public figures are symbolic. The blade is metaphorical. Always has been.
        </div>
        <TerminalProvider>
          <DrawerProvider>
            <div className="flex-grow">{children}</div>
            <LayoutExtras />

            {/* ─── Global Footer Disclaimer ──────────────────────────────── */}
            <GlobalFooter />
          </DrawerProvider>
        </TerminalProvider>
      </body>
    </html>
  );
}
