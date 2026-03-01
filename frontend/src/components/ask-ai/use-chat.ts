"use client";

import { useState, useCallback, useRef } from "react";
import { api } from "@/lib/api";

export interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

export function useChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const send = useCallback(async (query: string) => {
    if (abortRef.current) {
      abortRef.current.abort();
    }
    abortRef.current = new AbortController();

    const userMsg: Message = { role: "user", content: query, timestamp: new Date() };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);
    setError(null);

    try {
      const data = await api.ragQuery(query);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.llm_response, timestamp: new Date() },
      ]);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      const msg = err instanceof Error ? err.message : "Request failed";
      setError(msg);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `Error: ${msg}`, timestamp: new Date() },
      ]);
    } finally {
      setLoading(false);
      abortRef.current = null;
    }
  }, []);

  const clear = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    setMessages([]);
    setError(null);
    setLoading(false);
  }, []);

  return { messages, loading, error, send, clear };
}
