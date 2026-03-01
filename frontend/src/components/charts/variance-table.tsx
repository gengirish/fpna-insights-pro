"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { BudgetVsActualItem } from "@/lib/api";

interface VarianceTableProps {
  data: BudgetVsActualItem[];
  loading?: boolean;
}

export function VarianceTable({ data, loading }: VarianceTableProps) {
  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="space-y-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-8 animate-pulse rounded bg-slate-100" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold text-slate-900">
          Budget Variance Detail
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-slate-500">
                <th className="pb-2 font-medium">Department</th>
                <th className="pb-2 font-medium text-right">Q</th>
                <th className="pb-2 font-medium text-right">Budget</th>
                <th className="pb-2 font-medium text-right">Actual</th>
                <th className="pb-2 font-medium text-right">Variance</th>
                <th className="pb-2 font-medium text-right">Var %</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row, i) => (
                <tr key={i} className="border-b border-slate-50 hover:bg-slate-50">
                  <td className="py-2 font-medium text-slate-700">{row.dept}</td>
                  <td className="py-2 text-right text-slate-600">Q{row.quarter}</td>
                  <td className="py-2 text-right text-slate-600">
                    ${row.budget_usd.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </td>
                  <td className="py-2 text-right text-slate-600">
                    ${row.actual_usd.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </td>
                  <td
                    className={cn(
                      "py-2 text-right font-medium",
                      row.variance_usd >= 0 ? "text-red-600" : "text-emerald-600"
                    )}
                  >
                    ${Math.abs(row.variance_usd).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    {row.variance_usd >= 0 ? " over" : " under"}
                  </td>
                  <td
                    className={cn(
                      "py-2 text-right font-medium",
                      row.variance_pct >= 0 ? "text-red-600" : "text-emerald-600"
                    )}
                  >
                    {row.variance_pct >= 0 ? "+" : ""}
                    {row.variance_pct.toFixed(1)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
