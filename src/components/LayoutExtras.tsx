"use client";

import { usePathname } from "next/navigation";
import { TerminalHUD } from "./TerminalHUD";
import { ChatWidget } from "./ChatWidget";

export function LayoutExtras() {
  const pathname = usePathname();
  if (pathname?.startsWith("/admin")) return null;
  return (
    <>
      <TerminalHUD />
      <ChatWidget />
    </>
  );
}
