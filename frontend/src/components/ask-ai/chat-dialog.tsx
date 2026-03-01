"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Send, Bot, User, X, Trash2, BrainCircuit } from "lucide-react";
import { useChat, type Message } from "./use-chat";
import { cn } from "@/lib/utils";

interface ChatDialogProps {
  open: boolean;
  onClose: () => void;
}

function MessageBubble({ msg }: { msg: Message }) {
  return (
    <div className={cn("flex gap-3", msg.role === "user" && "justify-end")}>
      {msg.role === "assistant" && (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100">
          <Bot className="h-4 w-4 text-blue-600" />
        </div>
      )}
      <div
        className={cn(
          "max-w-[80%] rounded-2xl px-4 py-3 text-sm",
          msg.role === "user"
            ? "bg-blue-600 text-white"
            : "bg-slate-100 text-slate-800"
        )}
      >
        <div className="whitespace-pre-wrap">{msg.content}</div>
      </div>
      {msg.role === "user" && (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-200">
          <User className="h-4 w-4 text-slate-600" />
        </div>
      )}
    </div>
  );
}

export function ChatDialog({ open, onClose }: ChatDialogProps) {
  const { messages, loading, error, send, clear } = useChat();
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
    }
  }, [open]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape") onClose();
  }, [onClose]);

  useEffect(() => {
    if (open) {
      document.addEventListener("keydown", handleKeyDown);
      return () => document.removeEventListener("keydown", handleKeyDown);
    }
  }, [open, handleKeyDown]);

  const handleSend = () => {
    if (!input.trim() || loading) return;
    send(input.trim());
    setInput("");
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="chat-dialog-title"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        ref={dialogRef}
        className="flex h-[min(600px,85vh)] w-full max-w-2xl flex-col rounded-2xl bg-white shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div className="flex items-center gap-2">
            <BrainCircuit className="h-5 w-5 text-blue-600" />
            <h2 id="chat-dialog-title" className="text-lg font-semibold text-slate-900">FPnA AI Assistant</h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={clear}
              className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              aria-label="Clear chat"
            >
              <Trash2 className="h-4 w-4" />
            </button>
            <button
              onClick={onClose}
              className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              aria-label="Close chat"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && (
            <div className="flex h-full flex-col items-center justify-center text-center text-slate-400">
              <BrainCircuit className="mb-3 h-12 w-12" />
              <p className="text-lg font-medium">Ask about your financial data</p>
              <p className="mt-1 text-sm">Try: &quot;What is the budget variance for Marketing in Q2 2025?&quot;</p>
            </div>
          )}
          {messages.map((msg, i) => (
            <MessageBubble key={`${msg.role}-${msg.timestamp.getTime()}-${i}`} msg={msg} />
          ))}
          {loading && (
            <div className="flex gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100">
                <Bot className="h-4 w-4 text-blue-600" />
              </div>
              <div className="rounded-2xl bg-slate-100 px-4 py-3" role="status" aria-label="AI is thinking">
                <div className="flex space-x-1">
                  <div className="h-2 w-2 animate-bounce rounded-full bg-slate-400" />
                  <div className="h-2 w-2 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: "0.1s" }} />
                  <div className="h-2 w-2 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: "0.2s" }} />
                </div>
              </div>
            </div>
          )}
          {error && !loading && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600" role="alert">
              {error}
            </div>
          )}
        </div>

        {/* Input */}
        <div className="border-t p-4">
          <div className="flex gap-2">
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
              placeholder="Ask about Q1 OPEX variance, payroll trends..."
              disabled={loading}
              aria-label="Type your question"
              className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:opacity-50"
            />
            <button
              onClick={handleSend}
              disabled={loading || !input.trim()}
              aria-label="Send message"
              className="rounded-xl bg-blue-600 px-4 py-2.5 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
