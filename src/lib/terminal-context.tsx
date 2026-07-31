"use client";

import React, { createContext, useContext, useState, useEffect, useRef } from "react";

export interface TerminalMessage {
  id: string;
  text: string;
  color?: string;
  speed?: number;
}

interface TerminalContextType {
  messages: TerminalMessage[];
  addMessage: (text: string, color?: string, speed?: number) => void;
  clearMessages: () => void;
  isVisible: boolean;
}

const TerminalContext = createContext<TerminalContextType | undefined>(undefined);

export function TerminalProvider({ children }: { children: React.ReactNode }) {
  const [messages, setMessages] = useState<TerminalMessage[]>([]);
  const [isVisible, setIsVisible] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const addMessage = (text: string, color: string = "text-hypeNeon", speed: number = 20) => {
    const newMsg: TerminalMessage = {
      id: Math.random().toString(36).substring(2, 9),
      text,
      color,
      speed,
    };
    
    setMessages((prev) => {
      // Keep only last 50 messages to prevent infinite DOM growth
      const next = [...prev, newMsg];
      return next.slice(-50);
    });
    
    setIsVisible(true);
    
    // Auto-hide after 8 seconds of inactivity
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      setIsVisible(false);
    }, 8000);
  };

  const clearMessages = () => {
    setMessages([]);
    setIsVisible(false);
  };

  return (
    <TerminalContext.Provider value={{ messages, addMessage, clearMessages, isVisible }}>
      {children}
    </TerminalContext.Provider>
  );
}

export function useTerminal() {
  const context = useContext(TerminalContext);
  if (!context) {
    throw new Error("useTerminal must be used within a TerminalProvider");
  }
  return context;
}
