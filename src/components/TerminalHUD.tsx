"use client";

import React, { useEffect, useState, useRef } from "react";
import { useTerminal, TerminalMessage } from "../lib/terminal-context";

export function TerminalHUD() {
  const { messages, isVisible } = useTerminal();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Auto-scroll to bottom whenever messages update
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isVisible]);

  return (
    <div
      className={`fixed bottom-24 right-4 z-[9999] w-full max-w-sm sm:max-w-md bg-black/90 border-2 border-hypeNeon/50 p-4 font-mono text-xs sm:text-sm shadow-[0_0_15px_rgba(57,255,20,0.3)] transition-all duration-500 ease-in-out pointer-events-none backdrop-blur-sm ${
        isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
      }`}
    >
      <div className="flex items-center justify-between mb-2 pb-2 border-b border-hypeNeon/30">
        <div className="text-hypeNeon/80 font-bold tracking-widest text-[10px]">
          TERMINAL_LINK_ESTABLISHED
        </div>
        <div className="flex space-x-1.5">
          <div className="w-2 h-2 bg-hypeNeon/80 rounded-full animate-pulse" />
          <div className="w-2 h-2 bg-hypeNeon/40 rounded-full" />
          <div className="w-2 h-2 bg-hypeNeon/40 rounded-full" />
        </div>
      </div>
      
      <div className="max-h-48 overflow-y-auto space-y-1 scrollbar-hide flex flex-col justify-end">
        {messages.map((msg) => (
          <TypewriterMessage key={msg.id} msg={msg} />
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}

function TypewriterMessage({ msg }: { msg: TerminalMessage }) {
  const [displayed, setDisplayed] = useState("");
  const [isTyping, setIsTyping] = useState(true);

  useEffect(() => {
    let i = 0;
    const interval = setInterval(() => {
      setDisplayed(msg.text.substring(0, i + 1));
      i++;
      if (i >= msg.text.length) {
        clearInterval(interval);
        setIsTyping(false);
      }
    }, msg.speed || 15);
    return () => clearInterval(interval);
  }, [msg.text, msg.speed]);

  return (
    <div className={`break-words ${msg.color || "text-hypeNeon"}`}>
      <span className="opacity-50 mr-2">{">"}</span>
      <span>{displayed}</span>
      {isTyping && <span className="animate-pulse bg-current inline-block w-1.5 h-3.5 ml-1 align-middle" />}
    </div>
  );
}
