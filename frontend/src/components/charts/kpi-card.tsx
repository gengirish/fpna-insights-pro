"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

interface KPICardProps {
  label: string;
  value: string;
  changePct: number;
  loading?: boolean;
}

export function KPICard({ label, value, changePct, loading }: KPICardProps) {
  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="h-4 w-24 animate-pulse rounded bg-slate-200" />
          <div className="mt-3 h-8 w-32 animate-pulse rounded bg-slate-200" />
          <div className="mt-2 h-4 w-16 animate-pulse rounded bg-slate-200" />
        </CardContent>
      </Card>
    );
  }

  const isPositive = changePct > 0;
  const isNeutral = changePct === 0;

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader>
        <CardTitle>{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold text-slate-900">{value}</div>
        <div
          className={cn(
            "mt-1 flex items-center gap-1 text-sm font-medium",
            isNeutral && "text-slate-400",
            isPositive && "text-emerald-600",
            !isPositive && !isNeutral && "text-red-600"
          )}
        >
          {isNeutral ? (
            <Minus className="h-4 w-4" />
          ) : isPositive ? (
            <TrendingUp className="h-4 w-4" />
          ) : (
            <TrendingDown className="h-4 w-4" />
          )}
          {isPositive ? "+" : ""}
          {changePct.toFixed(1)}%
        </div>
      </CardContent>
    </Card>
  );
}
