"use client";

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DeptBreakdownItem } from "@/lib/api";

const COLORS = ["#3b82f6", "#8b5cf6", "#06b6d4", "#f59e0b", "#ef4444", "#10b981"];

interface DeptPieProps {
  data: DeptBreakdownItem[];
  loading?: boolean;
}

export function DeptPie({ data, loading }: DeptPieProps) {
  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="h-[300px] animate-pulse rounded bg-slate-100" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold text-slate-900">
          Spend by Department
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={data}
              dataKey="total"
              nameKey="dept"
              cx="50%"
              cy="50%"
              outerRadius={100}
              label={({ dept, percent }) => `${dept} ${(percent * 100).toFixed(0)}%`}
              labelLine={false}
            >
              {data.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip formatter={(value: number) => `$${value.toLocaleString()}`} />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
