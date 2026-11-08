"use client";

import { usePathname } from "next/navigation";
import { TerminalHUD } from "./TerminalHUD";
import { ChatWidget } from "./ChatWidget";

export function LayoutExtras() {
  const pathname = usePathname();
  if (pathname?.startsWith("/admin")) return null;
  // The forum frame has its own controls; the floating chat button would sit
  // on top of them. The fund page carries the frame.
  if (pathname?.startsWith("/forum") || pathname?.startsWith("/resistance")) {
    return null;
  }
  return (
    <>
      <TerminalHUD />
      <ChatWidget />
    </>
  );
}
