import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";
import { SolanaWalletProvider } from "../components/WalletProvider";
import { ExecutionProvider } from "../lib/execution-context";
import { AuthProvider } from "../lib/auth-context";
import { TerminalProvider } from "../lib/terminal-context";
import { TerminalHUD } from "../components/TerminalHUD";

export const metadata: Metadata = {
  title: "FuckYouElon — $CHOP PROTOCOL",
  description: "A public message board. Execute discontent.",
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
          NOTICE OF ARTISTIC SATIRE & SYMBOLIC REPRESENTATION: This site is an interactive digital art installation. Any reference to real individuals is symbolic. No physical harm is intended, encouraged, or implied.
        </div>
        <TerminalProvider>
          <SolanaWalletProvider>
            <ExecutionProvider>
              <AuthProvider>
              <div className="flex-grow">{children}</div>
              <TerminalHUD />
              
              {/* ─── Global Footer Disclaimer ──────────────────────────────── */}
              <footer className="border-t-4 border-black bg-[#0a0a0a] py-12 px-6 z-50 relative">
                <div className="mx-auto max-w-4xl font-mono text-xs text-[#818384] leading-relaxed">
                  <h3 className="mb-4 text-center text-[13px] font-bold text-spiteCrimson uppercase tracking-widest">
                    NOTICE OF ARTISTIC SATIRE & SYMBOLIC REPRESENTATION
                  </h3>
                  <p className="mb-6 text-center text-sm">
                    This website is an interactive digital art installation, a work of political satire, and a satirical commentary on modern tech conglomerates.
                  </p>
                  <div className="space-y-4 rounded-sm border-2 border-spiteCrimson/20 bg-black p-6">
                    <p>
                      <strong className="text-sheetWhite">1. Public Figures as Symbols:</strong> Any reference to real individuals, names, or likenesses (including tech executives, billionaires) is used strictly as a <strong className="text-spiteCrimson">symbolic proxy for late-stage capitalism, systemic power structures, and corporate excess</strong>. These individuals are depicted not as private biological targets, but as archetypes of global economic friction (<em>ras-le-bol</em>).
                    </p>
                    <p>
                      <strong className="text-sheetWhite">2. Metaphorical Imagery:</strong> The guillotine and associated mechanical animations are historical metaphors for revolutionary market corrections and the public critique of extreme wealth concentration. They are artistic expressions, not literal, physical, or real-world threats of violence. No physical harm is intended, encouraged, or implied.
                    </p>
                    <p>
                      <strong className="text-sheetWhite">3. Zero Utility &amp; Speculation:</strong> The $CHOP token is a digital collectible with zero utility, no functional roadmap, and no expectation of profit derived from the managerial efforts of others. Buying this token is an explicit act of financial self-harm and internet participation.
                    </p>
                  </div>
                </div>
              </footer>
              </AuthProvider>
            </ExecutionProvider>
          </SolanaWalletProvider>
        </TerminalProvider>
      </body>
    </html>
  );
}
