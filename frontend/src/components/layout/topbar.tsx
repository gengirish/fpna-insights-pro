"use client";

import { LogOut, BarChart3 } from "lucide-react";

interface TopbarProps {
  email: string | undefined;
  fiscalYear: number;
  onFiscalYearChange: (year: number) => void;
  onLogout: () => void;
}

export function Topbar({ email, fiscalYear, onFiscalYearChange, onLogout }: TopbarProps) {
  return (
    <header className="sticky top-0 z-40 border-b bg-white/80 backdrop-blur-md">
      <div className="flex h-16 items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-3 lg:hidden">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600">
            <BarChart3 className="h-5 w-5 text-white" />
          </div>
          <h1 className="text-lg font-bold text-slate-900">FPnA Insights</h1>
        </div>
        <div className="hidden lg:block" />

        <div className="flex items-center gap-3">
          <select
            value={fiscalYear}
            onChange={(e) => onFiscalYearChange(Number(e.target.value))}
            aria-label="Fiscal Year"
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100"
          >
            <option value={2025}>FY 2025</option>
            <option value={2024}>FY 2024</option>
          </select>
          <div className="hidden sm:block text-sm text-slate-500">{email}</div>
          <button
            onClick={onLogout}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="Logout"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
