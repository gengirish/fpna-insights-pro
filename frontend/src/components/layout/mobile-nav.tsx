"use client";

import { BrainCircuit } from "lucide-react";
import { NAV_ITEMS, type Tab } from "./sidebar";
import { cn } from "@/lib/utils";

interface MobileNavProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  onAskAI: () => void;
}

export function MobileNav({ activeTab, onTabChange, onAskAI }: MobileNavProps) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 border-t bg-white lg:hidden">
      <nav className="flex items-center justify-around px-1 py-2" aria-label="Mobile navigation">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            onClick={() => onTabChange(item.id)}
            className={cn(
              "flex flex-col items-center gap-0.5 rounded-lg px-2 py-1.5 text-xs font-medium transition-colors",
              activeTab === item.id
                ? "text-blue-700"
                : "text-slate-400 hover:text-slate-600"
            )}
          >
            {item.icon}
            <span className="hidden xs:block">{item.label}</span>
          </button>
        ))}
        <button
          onClick={onAskAI}
          className="flex flex-col items-center gap-0.5 rounded-lg px-2 py-1.5 text-xs font-medium text-blue-600"
        >
          <BrainCircuit className="h-5 w-5" />
          <span className="hidden xs:block">Ask AI</span>
        </button>
      </nav>
    </div>
  );
}
