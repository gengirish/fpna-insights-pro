"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  BarChart3, BrainCircuit, LogOut, FileSpreadsheet,
  CreditCard, Receipt, BookOpen,
} from "lucide-react";
import { api, isAuthenticated, clearToken, getUser } from "@/lib/api";
import type { DashboardSummary, AgingItem, ExpenseSummary, GLSummary } from "@/lib/api";
import { KPICard } from "@/components/charts/kpi-card";
import { BudgetChart } from "@/components/charts/budget-chart";
import { DeptPie } from "@/components/charts/dept-pie";
import { VarianceTable } from "@/components/charts/variance-table";
import { ChatDialog } from "@/components/ask-ai/chat-dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Tab = "overview" | "ap" | "ar" | "expenses" | "gl";

export default function DashboardPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("overview");
  const [chatOpen, setChatOpen] = useState(false);
  const [fiscalYear, setFiscalYear] = useState(2025);
  const [loading, setLoading] = useState(true);
  const [dashboard, setDashboard] = useState<DashboardSummary | null>(null);
  const [apAging, setApAging] = useState<AgingItem[]>([]);
  const [arAging, setArAging] = useState<AgingItem[]>([]);
  const [expenses, setExpenses] = useState<ExpenseSummary | null>(null);
  const [glSummary, setGlSummary] = useState<GLSummary | null>(null);
  const user = getUser();

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace("/login");
      return;
    }
    loadData();
  }, [fiscalYear, router]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [dash, ap, ar, exp, gl] = await Promise.all([
        api.getDashboard(fiscalYear),
        api.getAPAging(),
        api.getARAging(),
        api.getExpenseSummary(),
        api.getGLSummary(),
      ]);
      setDashboard(dash);
      setApAging(ap);
      setArAging(ar);
      setExpenses(exp);
      setGlSummary(gl);
    } catch (err) {
      console.error("Failed to load dashboard:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    clearToken();
    router.replace("/login");
  };

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "overview", label: "Overview", icon: <BarChart3 className="h-4 w-4" /> },
    { id: "ap", label: "Payables", icon: <CreditCard className="h-4 w-4" /> },
    { id: "ar", label: "Receivables", icon: <Receipt className="h-4 w-4" /> },
    { id: "expenses", label: "Expenses", icon: <FileSpreadsheet className="h-4 w-4" /> },
    { id: "gl", label: "General Ledger", icon: <BookOpen className="h-4 w-4" /> },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50/30">
      {/* Top bar */}
      <header className="sticky top-0 z-40 border-b bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600">
              <BarChart3 className="h-5 w-5 text-white" />
            </div>
            <h1 className="text-lg font-bold text-slate-900">FPnA Insights PRO</h1>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={fiscalYear}
              onChange={(e) => setFiscalYear(Number(e.target.value))}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100"
            >
              <option value={2025}>FY 2025</option>
              <option value={2024}>FY 2024</option>
            </select>
            <button
              onClick={() => setChatOpen(true)}
              className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
            >
              <BrainCircuit className="h-4 w-4" />
              Ask AI
            </button>
            <div className="hidden sm:block text-sm text-slate-500">{user?.email}</div>
            <button
              onClick={handleLogout}
              className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              title="Logout"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="border-b bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <nav className="flex gap-1 overflow-x-auto py-2">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  "flex items-center gap-2 whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition-colors",
                  tab === t.id
                    ? "bg-blue-50 text-blue-700"
                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"
                )}
              >
                {t.icon}
                {t.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Content */}
      <main className="mx-auto max-w-7xl p-4 sm:p-6">
        {tab === "overview" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {(dashboard?.kpis ?? [null, null, null, null]).map((kpi, i) => (
                <KPICard
                  key={i}
                  label={kpi?.label ?? ""}
                  value={kpi?.formatted_value ?? ""}
                  changePct={kpi?.change_pct ?? 0}
                  loading={loading}
                />
              ))}
            </div>
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <BudgetChart data={dashboard?.budget_vs_actual ?? []} loading={loading} />
              <DeptPie data={dashboard?.dept_breakdown ?? []} loading={loading} />
            </div>
            <VarianceTable data={dashboard?.budget_vs_actual ?? []} loading={loading} />
          </div>
        )}

        {tab === "ap" && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-slate-900">Accounts Payable Aging</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {apAging.map((item, i) => (
                <Card key={i} className="hover:shadow-md transition-shadow">
                  <CardHeader>
                    <CardTitle>{item.bucket}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-slate-900">
                      ${item.total_amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </div>
                    <div className="mt-1 text-sm text-slate-500">{item.count} invoices</div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {tab === "ar" && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-slate-900">Accounts Receivable Aging</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {arAging.map((item, i) => (
                <Card key={i} className="hover:shadow-md transition-shadow">
                  <CardHeader>
                    <CardTitle>{item.bucket}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-slate-900">
                      ${item.total_amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </div>
                    <div className="mt-1 text-sm text-slate-500">{item.count} invoices</div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {tab === "expenses" && expenses && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-slate-900">Expense Claims</h2>
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base font-semibold text-slate-900">By Category</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {expenses.by_category.map((item, i) => (
                      <div key={i} className="flex items-center justify-between">
                        <span className="text-sm font-medium text-slate-700">{item.category}</span>
                        <div className="text-right">
                          <span className="text-sm font-bold text-slate-900">
                            ${item.total.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                          </span>
                          <span className="ml-2 text-xs text-slate-400">{item.claim_count} claims</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base font-semibold text-slate-900">By Status</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {expenses.by_status.map((item, i) => (
                      <div key={i} className="flex items-center justify-between">
                        <span className={cn(
                          "rounded-full px-2.5 py-0.5 text-xs font-medium",
                          item.status === "Paid" && "bg-emerald-100 text-emerald-700",
                          item.status === "Approved" && "bg-blue-100 text-blue-700",
                          item.status === "Submitted" && "bg-amber-100 text-amber-700",
                          item.status === "Rejected" && "bg-red-100 text-red-700",
                        )}>
                          {item.status}
                        </span>
                        <div className="text-right">
                          <span className="text-sm font-bold text-slate-900">
                            ${item.total.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                          </span>
                          <span className="ml-2 text-xs text-slate-400">{item.claim_count}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {tab === "gl" && glSummary && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-slate-900">General Ledger Summary</h2>
            <Card>
              <CardHeader>
                <CardTitle className="text-base font-semibold text-slate-900">By Account</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-slate-500">
                        <th className="pb-2 font-medium">Account</th>
                        <th className="pb-2 font-medium text-right">Debits</th>
                        <th className="pb-2 font-medium text-right">Credits</th>
                        <th className="pb-2 font-medium text-right">Net</th>
                      </tr>
                    </thead>
                    <tbody>
                      {glSummary.by_account.map((row, i) => (
                        <tr key={i} className="border-b border-slate-50 hover:bg-slate-50">
                          <td className="py-2 font-medium text-slate-700">{row.account_name}</td>
                          <td className="py-2 text-right text-red-600">
                            ${row.total_debit.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                          </td>
                          <td className="py-2 text-right text-emerald-600">
                            ${row.total_credit.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                          </td>
                          <td className={cn("py-2 text-right font-medium", row.net >= 0 ? "text-emerald-600" : "text-red-600")}>
                            ${row.net.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </main>

      <ChatDialog open={chatOpen} onClose={() => setChatOpen(false)} />
    </div>
  );
}
