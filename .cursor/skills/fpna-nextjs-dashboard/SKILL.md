---
name: fpna-nextjs-dashboard
description: Build and maintain the FPnA Insights PRO NextJS frontend dashboard with responsive design, charts, and AI chat. Use when creating pages, components, layouts, or frontend configuration for the FPnA financial dashboard.
---

# FPnA NextJS Dashboard

## Project Context

FPnA Insights PRO frontend is a financial dashboard built with Next.js 15 (stable), Tailwind CSS, shadcn/ui, and Recharts. It provides KPI cards, interactive charts, OPEX/payroll analysis views, and an AI-powered chat dialog.

## Architecture

```
frontend/
├── app/
│   ├── layout.tsx              # Root layout (fonts, providers)
│   ├── page.tsx                # Landing / redirect to dashboard
│   ├── login/page.tsx          # Auth page
│   └── dashboard/
│       ├── layout.tsx          # Dashboard shell (sidebar + topbar)
│       ├── page.tsx            # Financial overview
│       ├── opex/page.tsx       # OPEX analysis
│       └── payroll/page.tsx    # Payroll analysis
├── components/
│   ├── ui/                     # shadcn/ui primitives (Button, Card, etc.)
│   ├── charts/
│   │   ├── kpi-card.tsx
│   │   ├── revenue-chart.tsx
│   │   └── opex-chart.tsx
│   ├── ask-ai/
│   │   ├── chat-dialog.tsx
│   │   ├── message-bubble.tsx
│   │   └── use-chat.ts
│   └── layout/
│       ├── sidebar.tsx
│       ├── topbar.tsx
│       └── mobile-nav.tsx
├── lib/
│   ├── api.ts                  # Typed API client
│   ├── auth.ts                 # Auth utilities
│   └── utils.ts                # cn() and helpers
├── next.config.ts
├── tailwind.config.ts
└── package.json
```

## Tech Stack (Pinned Versions)

```json
{
  "dependencies": {
    "next": "^15.1",
    "react": "^19",
    "react-dom": "^19",
    "@radix-ui/react-dialog": "^1.1",
    "@radix-ui/react-dropdown-menu": "^2.1",
    "class-variance-authority": "^0.7",
    "clsx": "^2.1",
    "tailwind-merge": "^2.5",
    "lucide-react": "^0.460",
    "recharts": "^2.13"
  }
}
```

Use **stable** Next.js releases only -- never RC or canary builds.

## API Client

Centralized API client with environment-based URL and error handling.

```typescript
// lib/api.ts
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001";

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const token = typeof window !== "undefined"
    ? localStorage.getItem("token")
    : null;

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
  });

  if (!res.ok) {
    throw new ApiError(res.status, await res.text());
  }

  return res.json();
}

export const api = {
  health: () => request<{ status: string }>("/api/v1/health"),
  getKPIs: () => request<KPIResponse[]>("/api/v1/dashboard/kpis"),
  getRevenueTrend: () => request<TimeSeriesPoint[]>("/api/v1/dashboard/revenue-trend"),
  ragQuery: (query: string) =>
    request<RAGResponse>("/api/v1/rag/query", {
      method: "POST",
      body: JSON.stringify({ query }),
    }),
};
```

## Dashboard Layout (Responsive)

The dashboard shell must be responsive: collapsible sidebar on mobile.

```tsx
// app/dashboard/layout.tsx
"use client";
import { useState } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { MobileNav } from "@/components/layout/mobile-nav";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Desktop sidebar */}
      <Sidebar className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64" />

      {/* Mobile sidebar */}
      <MobileNav open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main content */}
      <div className="lg:pl-64">
        <Topbar onMenuClick={() => setSidebarOpen(true)} />
        <main className="p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
```

## KPI Card Component

Fetches real data from the backend. Shows loading skeletons while fetching.

```tsx
// components/charts/kpi-card.tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown } from "lucide-react";

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
        </CardContent>
      </Card>
    );
  }

  const isPositive = changePct >= 0;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <div className={`mt-1 flex items-center gap-1 text-sm ${
          isPositive ? "text-emerald-600" : "text-red-600"
        }`}>
          {isPositive ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
          {isPositive ? "+" : ""}{changePct.toFixed(1)}%
        </div>
      </CardContent>
    </Card>
  );
}
```

## AI Chat Hook

Encapsulate chat state in a custom hook. Never inline fetch logic in components.

```typescript
// components/ask-ai/use-chat.ts
"use client";
import { useState, useCallback } from "react";
import { api } from "@/lib/api";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export function useChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = useCallback(async (query: string) => {
    setMessages((prev) => [...prev, { role: "user", content: query }]);
    setLoading(true);
    setError(null);

    try {
      const data = await api.ragQuery(query);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.llm_response },
      ]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Request failed";
      setError(msg);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `Error: ${msg}` },
      ]);
    } finally {
      setLoading(false);
    }
  }, []);

  const clear = useCallback(() => {
    setMessages([]);
    setError(null);
  }, []);

  return { messages, loading, error, send, clear };
}
```

## Chart Components

Always wrap Recharts in `ResponsiveContainer` for resize behavior.

```tsx
// components/charts/revenue-chart.tsx
"use client";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface RevenueChartProps {
  data: { month: string; actual: number; budget: number }[];
}

export function RevenueChart({ data }: RevenueChartProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Revenue: Actual vs Budget</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="actual" fill="#3b82f6" name="Actual" />
            <Bar dataKey="budget" fill="#94a3b8" name="Budget" />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
```

## Error Boundaries

Wrap dashboard pages in error boundaries to prevent full-page crashes.

```tsx
// app/dashboard/error.tsx
"use client";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center gap-4">
      <h2 className="text-xl font-semibold">Something went wrong</h2>
      <p className="text-muted-foreground">{error.message}</p>
      <button
        onClick={reset}
        className="rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
      >
        Try again
      </button>
    </div>
  );
}
```

## Key Rules

1. **Never hardcode backend URLs** -- always use `NEXT_PUBLIC_API_URL` env var
2. **Never use RC/canary Next.js** -- stable releases only
3. **Always wrap charts in `ResponsiveContainer`** -- fixed-width charts break mobile
4. **Always provide loading skeletons** -- not just spinners
5. **Always define TypeScript interfaces** for API responses
6. **Always use the `api` client from `lib/api.ts`** -- never raw `fetch` in components
7. **Always add `error.tsx`** in route groups for error boundaries
8. **Sidebar must collapse** on screens < 1024px
