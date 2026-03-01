"use client";

import { useState, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { api, isAuthenticated, clearSession, getUser } from "@/lib/api";
import type { DashboardSummary, AgingItem, ExpenseSummary, GLSummary } from "@/lib/api";
import { KPICard } from "@/components/charts/kpi-card";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { DashboardSkeleton } from "@/components/ui/skeleton";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sidebar, type Tab } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { MobileNav } from "@/components/layout/mobile-nav";
import { cn, formatCurrency } from "@/lib/utils";

const BudgetChart = dynamic(
  () => import("@/components/charts/budget-chart").then((m) => m.BudgetChart),
  { loading: () => <div className="rounded-xl border bg-white p-6 shadow-sm"><Skeleton className="h-[300px] w-full" /></div> }
);

const DeptPie = dynamic(
  () => import("@/components/charts/dept-pie").then((m) => m.DeptPie),
  { loading: () => <div className="rounded-xl border bg-white p-6 shadow-sm"><Skeleton className="h-[300px] w-full" /></div> }
);

const VarianceTable = dynamic(
  () => import("@/components/charts/variance-table").then((m) => m.VarianceTable),
  { loading: () => <div className="rounded-xl border bg-white p-6 shadow-sm"><Skeleton className="h-[200px] w-full" /></div> }
);

const ChatDialog = dynamic(
  () => import("@/components/ask-ai/chat-dialog").then((m) => m.ChatDialog),
  { ssr: false }
);

export default function DashboardPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("overview");
  const [chatOpen, setChatOpen] = useState(false);
  const [fiscalYear, setFiscalYear] = useState(2025);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dashboard, setDashboard] = useState<DashboardSummary | null>(null);
  const [apAging, setApAging] = useState<AgingItem[]>([]);
  const [arAging, setArAging] = useState<AgingItem[]>([]);
  const [expenses, setExpenses] = useState<ExpenseSummary | null>(null);
  const [glSummary, setGlSummary] = useState<GLSummary | null>(null);
  const user = getUser();

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
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
      const message = err instanceof Error ? err.message : "Failed to load dashboard data";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [fiscalYear]);

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace("/login");
      return;
    }
    loadData();
  }, [loadData, router]);

  const handleLogout = async () => {
    try { await api.logout(); } catch { /* best-effort */ }
    clearSession();
    router.replace("/login");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50/30">
      <Sidebar activeTab={tab} onTabChange={setTab} onAskAI={() => setChatOpen(true)} />

      <div className="lg:pl-64">
        <Topbar
          email={user?.email}
          fiscalYear={fiscalYear}
          onFiscalYearChange={setFiscalYear}
          onLogout={handleLogout}
        />

        <main className="mx-auto max-w-7xl p-4 pb-20 sm:p-6 lg:pb-6">
          <ErrorBoundary>
            {error && (
              <div className="mb-6 flex items-center justify-between rounded-xl border border-red-200 bg-red-50 p-4">
                <p className="text-sm text-red-700">{error}</p>
                <button
                  onClick={loadData}
                  className="flex items-center gap-2 rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 transition-colors"
                >
                  <RefreshCw className="h-4 w-4" />
                  Retry
                </button>
              </div>
            )}

            {loading && <DashboardSkeleton />}

            {!loading && !error && tab === "overview" && (
              <div role="tabpanel" className="space-y-6">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {(dashboard?.kpis ?? []).map((kpi) => (
                    <KPICard
                      key={kpi.label}
                      label={kpi.label}
                      value={kpi.formatted_value}
                      changePct={kpi.change_pct}
                      loading={false}
                    />
                  ))}
                </div>
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                  <BudgetChart data={dashboard?.budget_vs_actual ?? []} loading={false} />
                  <DeptPie data={dashboard?.dept_breakdown ?? []} loading={false} />
                </div>
                <VarianceTable data={dashboard?.budget_vs_actual ?? []} loading={false} />
              </div>
            )}

            {!loading && !error && tab === "ap" && (
              <div role="tabpanel" className="space-y-6">
                <h2 className="text-xl font-bold text-slate-900">Accounts Payable Aging</h2>
                {apAging.length === 0 ? (
                  <p className="text-sm text-slate-500">No payable data available.</p>
                ) : (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {apAging.map((item) => (
                      <Card key={item.bucket} className="hover:shadow-md transition-shadow">
                        <CardHeader>
                          <CardTitle>{item.bucket}</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="text-2xl font-bold text-slate-900">
                            {formatCurrency(item.total_amount)}
                          </div>
                          <div className="mt-1 text-sm text-slate-500">{item.count} invoices</div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            )}

            {!loading && !error && tab === "ar" && (
              <div role="tabpanel" className="space-y-6">
                <h2 className="text-xl font-bold text-slate-900">Accounts Receivable Aging</h2>
                {arAging.length === 0 ? (
                  <p className="text-sm text-slate-500">No receivable data available.</p>
                ) : (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {arAging.map((item) => (
                      <Card key={item.bucket} className="hover:shadow-md transition-shadow">
                        <CardHeader>
                          <CardTitle>{item.bucket}</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="text-2xl font-bold text-slate-900">
                            {formatCurrency(item.total_amount)}
                          </div>
                          <div className="mt-1 text-sm text-slate-500">{item.count} invoices</div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            )}

            {!loading && !error && tab === "expenses" && (
              <div role="tabpanel" className="space-y-6">
                <h2 className="text-xl font-bold text-slate-900">Expense Claims</h2>
                {!expenses ? (
                  <p className="text-sm text-slate-500">No expense data available.</p>
                ) : (
                  <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base font-semibold text-slate-900">By Category</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          {expenses.by_category.map((item) => (
                            <div key={item.category} className="flex items-center justify-between">
                              <span className="text-sm font-medium text-slate-700">{item.category}</span>
                              <div className="text-right">
                                <span className="text-sm font-bold text-slate-900">
                                  {formatCurrency(item.total)}
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
                          {expenses.by_status.map((item) => (
                            <div key={item.status} className="flex items-center justify-between">
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
                                  {formatCurrency(item.total)}
                                </span>
                                <span className="ml-2 text-xs text-slate-400">{item.claim_count}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )}
              </div>
            )}

            {!loading && !error && tab === "gl" && (
              <div role="tabpanel" className="space-y-6">
                <h2 className="text-xl font-bold text-slate-900">General Ledger Summary</h2>
                {!glSummary ? (
                  <p className="text-sm text-slate-500">No ledger data available.</p>
                ) : (
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
                            {glSummary.by_account.map((row) => (
                              <tr key={row.account_name} className="border-b border-slate-50 hover:bg-slate-50">
                                <td className="py-2 font-medium text-slate-700">{row.account_name}</td>
                                <td className="py-2 text-right text-red-600">
                                  {formatCurrency(row.total_debit)}
                                </td>
                                <td className="py-2 text-right text-emerald-600">
                                  {formatCurrency(row.total_credit)}
                                </td>
                                <td className={cn("py-2 text-right font-medium", row.net >= 0 ? "text-emerald-600" : "text-red-600")}>
                                  {formatCurrency(row.net)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </ErrorBoundary>
        </main>
      </div>

      <MobileNav activeTab={tab} onTabChange={setTab} onAskAI={() => setChatOpen(true)} />
      <ChatDialog open={chatOpen} onClose={() => setChatOpen(false)} />
    </div>
  );
}
