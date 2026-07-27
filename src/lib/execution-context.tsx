"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

interface ExecutionContextValue {
  executed: boolean;
  totalMessages: number;
  setExecuted: (v: boolean) => void;
  setTotalMessages: (v: number) => void;
}

const ExecutionContext = createContext<ExecutionContextValue>({
  executed: false,
  totalMessages: 0,
  setExecuted: () => {},
  setTotalMessages: () => {},
});

export function ExecutionProvider({ children }: { children: ReactNode }) {
  const [executed, setExecuted] = useState(false);
  const [totalMessages, setTotalMessages] = useState(0);

  return (
    <ExecutionContext.Provider value={{ executed, totalMessages, setExecuted, setTotalMessages }}>
      {children}
    </ExecutionContext.Provider>
  );
}

export function useExecution() {
  return useContext(ExecutionContext);
}
