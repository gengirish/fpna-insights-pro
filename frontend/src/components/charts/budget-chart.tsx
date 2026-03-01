"use client";

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { BudgetVsActualItem } from "@/lib/api";

interface BudgetChartProps {
  data: BudgetVsActualItem[];
  loading?: boolean;
}

export function BudgetChart({ data, loading }: BudgetChartProps) {
  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="h-[300px] animate-pulse rounded bg-slate-100" />
        </CardContent>
      </Card>
    );
  }

  const deptTotals = Object.values(
    data.reduce((acc, item) => {
      if (!acc[item.dept]) {
        acc[item.dept] = { dept: item.dept, budget: 0, actual: 0, forecast: 0 };
      }
      acc[item.dept].budget += item.budget_usd;
      acc[item.dept].actual += item.actual_usd;
      acc[item.dept].forecast += item.forecast_usd;
      return acc;
    }, {} as Record<string, { dept: string; budget: number; actual: number; forecast: number }>)
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold text-slate-900">
          Budget vs Actual by Department
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={deptTotals} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="dept" fontSize={12} tick={{ fill: "#64748b" }} />
            <YAxis fontSize={12} tick={{ fill: "#64748b" }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
            <Tooltip
              formatter={(value: number) => [`$${value.toLocaleString()}`, ""]}
              contentStyle={{ borderRadius: "8px", border: "1px solid #e2e8f0" }}
            />
            <Legend />
            <Bar dataKey="budget" fill="#94a3b8" name="Budget" radius={[4, 4, 0, 0]} />
            <Bar dataKey="actual" fill="#3b82f6" name="Actual" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
