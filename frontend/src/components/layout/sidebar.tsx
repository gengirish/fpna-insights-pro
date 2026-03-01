"use client";

import { BarChart3, CreditCard, Receipt, FileSpreadsheet, BookOpen, BrainCircuit } from "lucide-react";
import { cn } from "@/lib/utils";

export type Tab = "overview" | "ap" | "ar" | "expenses" | "gl";

interface SidebarProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  onAskAI: () => void;
}

const NAV_ITEMS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: "overview", label: "Overview", icon: <BarChart3 className="h-5 w-5" /> },
  { id: "ap", label: "Payables", icon: <CreditCard className="h-5 w-5" /> },
  { id: "ar", label: "Receivables", icon: <Receipt className="h-5 w-5" /> },
  { id: "expenses", label: "Expenses", icon: <FileSpreadsheet className="h-5 w-5" /> },
  { id: "gl", label: "General Ledger", icon: <BookOpen className="h-5 w-5" /> },
];

export { NAV_ITEMS };

export function Sidebar({ activeTab, onTabChange, onAskAI }: SidebarProps) {
  return (
    <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 lg:border-r lg:bg-white">
      <div className="flex h-16 items-center gap-3 border-b px-6">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600">
          <BarChart3 className="h-5 w-5 text-white" />
        </div>
        <span className="text-lg font-bold text-slate-900">FPnA Insights</span>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4" aria-label="Main navigation">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            onClick={() => onTabChange(item.id)}
            className={cn(
              "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
              activeTab === item.id
                ? "bg-blue-50 text-blue-700"
                : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
            )}
          >
            {item.icon}
            {item.label}
          </button>
        ))}
      </nav>

      <div className="border-t p-3">
        <button
          onClick={onAskAI}
          className="flex w-full items-center gap-3 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
        >
          <BrainCircuit className="h-5 w-5" />
          Ask AI
        </button>
      </div>
    </aside>
  );
}
