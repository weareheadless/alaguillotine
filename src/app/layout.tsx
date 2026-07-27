import type { Metadata } from "next";
import "./globals.css";
import { SolanaWalletProvider } from "../components/WalletProvider";
import { ExecutionProvider } from "../lib/execution-context";

export const metadata: Metadata = {
  title: "FuckYouElon — Public Message Board",
  description: "A public message board. Free speech, not hate speech.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen bg-[#030303] antialiased">
        <SolanaWalletProvider>
          <ExecutionProvider>{children}</ExecutionProvider>
        </SolanaWalletProvider>
      </body>
    </html>
  );
}
