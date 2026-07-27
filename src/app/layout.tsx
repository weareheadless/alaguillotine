import type { Metadata } from "next";
import "./globals.css";
import { SolanaWalletProvider } from "../components/WalletProvider";
import { ExecutionProvider } from "../lib/execution-context";

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
      </head>
      <body className="min-h-screen bg-canvasBlack antialiased font-mono animate-crt-flicker">
        <SolanaWalletProvider>
          <ExecutionProvider>{children}</ExecutionProvider>
        </SolanaWalletProvider>
      </body>
    </html>
  );
}
