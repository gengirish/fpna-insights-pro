const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001";

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

let _token: string | null = null;

export function setToken(token: string) {
  _token = token;
  if (typeof window !== "undefined") {
    localStorage.setItem("fpna_token", token);
  }
}

export function getToken(): string | null {
  if (_token) return _token;
  if (typeof window !== "undefined") {
    _token = localStorage.getItem("fpna_token");
  }
  return _token;
}

export function clearToken() {
  _token = null;
  if (typeof window !== "undefined") {
    localStorage.removeItem("fpna_token");
  }
}

export function isAuthenticated(): boolean {
  const token = getToken();
  if (!token) return false;
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload.exp * 1000 > Date.now();
  } catch {
    return false;
  }
}

export function getUser(): { id: number; email: string; full_name: string; role: string } | null {
  const token = getToken();
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return { id: payload.sub, email: payload.email, full_name: payload.full_name || payload.email, role: payload.role };
  } catch {
    return null;
  }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const token = getToken();

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
  });

  if (res.status === 401) {
    clearToken();
    if (typeof window !== "undefined") {
      window.location.href = "/login";
    }
    throw new ApiError(401, "Session expired");
  }

  if (!res.ok) {
    const text = await res.text();
    throw new ApiError(res.status, text);
  }

  return res.json();
}

// API types
export interface KPIItem {
  label: string;
  value: number;
  formatted_value: string;
  change_pct: number;
  period: string;
}

export interface BudgetVsActualItem {
  dept: string;
  quarter: number;
  fiscal_year: number;
  budget_usd: number;
  actual_usd: number;
  forecast_usd: number;
  variance_usd: number;
  variance_pct: number;
}

export interface DeptBreakdownItem {
  dept: string;
  total: number;
}

export interface DashboardSummary {
  kpis: KPIItem[];
  budget_vs_actual: BudgetVsActualItem[];
  dept_breakdown: DeptBreakdownItem[];
}

export interface AgingItem {
  bucket: string;
  total_amount: number;
  count: number;
}

export interface ExpenseSummary {
  by_category: { category: string; total: number; claim_count: number }[];
  by_status: { status: string; total: number; claim_count: number }[];
}

export interface GLSummary {
  by_account: { account_name: string; total_debit: number; total_credit: number; net: number }[];
  by_dept: { dept: string; total_debit: number; total_credit: number }[];
  monthly_trend: { month: string; total_debit: number; total_credit: number }[];
}

export interface RAGResponse {
  postgres_data: Record<string, unknown>;
  llm_response: string;
  sources: string[];
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  user: { id: number; email: string; full_name: string; role: string };
}

// API client
export const api = {
  login: (email: string, password: string) =>
    request<LoginResponse>("/api/v1/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  health: () => request<{ status: string }>("/api/v1/health"),

  getDashboard: (fiscalYear = 2025) =>
    request<DashboardSummary>(`/api/v1/dashboard/summary?fiscal_year=${fiscalYear}`),

  getAPAging: () => request<AgingItem[]>("/api/v1/dashboard/ap-aging"),
  getARAging: () => request<AgingItem[]>("/api/v1/dashboard/ar-aging"),
  getExpenseSummary: () => request<ExpenseSummary>("/api/v1/dashboard/expense-summary"),
  getGLSummary: () => request<GLSummary>("/api/v1/dashboard/gl-summary"),

  ragQuery: (query: string) =>
    request<RAGResponse>("/api/v1/rag/query", {
      method: "POST",
      body: JSON.stringify({ query }),
    }),
};
