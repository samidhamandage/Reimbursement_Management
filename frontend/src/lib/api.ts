/**
 * API Client — wraps fetch with auth token, base URL, and error handling.
 * All frontend modules should import from here instead of calling fetch directly.
 */

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("auth_token");
}

function getHeaders(extra?: Record<string, string>): HeadersInit {
  const token = getToken();
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  };
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    const error = new Error(body.error || `HTTP ${res.status}`) as any;
    error.details = body.details; // Carry detail metadata for UI
    throw error;
  }
  return res.json() as Promise<T>;
}

/**
 * Enhanced fetch to catch network errors/unreachable backend specifically.
 */
async function safeFetch(url: string, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(url, init);
  } catch (error) {
    if (error instanceof TypeError && error.message.toLowerCase().includes("fetch")) {
      throw new Error("Backend server is unreachable. Please ensure the backend is running on http://localhost:5000 and check CORS settings.");
    }
    throw error;
  }
}

// ─── Auth ──────────────────────────────────────────────────────────────────

export const authApi = {
  login: (email: string, password: string) =>
    safeFetch(`${BASE_URL}/auth/login`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({ email, password }),
    }).then(handleResponse<{ user: User; token: string }>),

  signup: (data: SignupPayload) =>
    safeFetch(`${BASE_URL}/auth/signup`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(data),
    }).then(handleResponse<{ user: User; token: string }>),

  me: () =>
    safeFetch(`${BASE_URL}/auth/me`, { headers: getHeaders() })
      .then(handleResponse<{ user: User }>),
};

// ─── Expenses ─────────────────────────────────────────────────────────────

export const expensesApi = {
  list: () =>
    safeFetch(`${BASE_URL}/expenses`, { headers: getHeaders() })
      .then(handleResponse<{ expenses: Expense[] }>),

  get: (id: string) =>
    safeFetch(`${BASE_URL}/expenses/${id}`, { headers: getHeaders() })
      .then(handleResponse<{ expense: Expense }>),

  create: (data: CreateExpensePayload) =>
    safeFetch(`${BASE_URL}/expenses`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(data),
    }).then(handleResponse<{ expense: Expense }>),

  approve: (id: string, comment: string) =>
    safeFetch(`${BASE_URL}/expenses/${id}/approve`, {
      method: "PATCH",
      headers: getHeaders(),
      body: JSON.stringify({ comment }),
    }).then(handleResponse<{ expense: Expense }>),

  reject: (id: string, comment: string) =>
    safeFetch(`${BASE_URL}/expenses/${id}/reject`, {
      method: "PATCH",
      headers: getHeaders(),
      body: JSON.stringify({ comment }),
    }).then(handleResponse<{ expense: Expense }>),

  adminOverride: (id: string, status: "APPROVED" | "REJECTED", comment: string) =>
    safeFetch(`${BASE_URL}/expenses/${id}/status`, {
      method: "PATCH",
      headers: getHeaders(),
      body: JSON.stringify({ status, comment }),
    }).then(handleResponse<{ expense: Expense }>),
};

// ─── Users ────────────────────────────────────────────────────────────────

export const usersApi = {
  list: () =>
    safeFetch(`${BASE_URL}/users`, { headers: getHeaders() })
      .then(handleResponse<{ users: User[] }>),

  create: (data: CreateUserPayload) =>
    safeFetch(`${BASE_URL}/users`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(data),
    }).then(handleResponse<{ user: User }>),

  update: (id: string, data: Partial<CreateUserPayload>) =>
    safeFetch(`${BASE_URL}/users/${id}`, {
      method: "PUT",
      headers: getHeaders(),
      body: JSON.stringify(data),
    }).then(handleResponse<{ user: User }>),

  delete: (id: string) =>
    safeFetch(`${BASE_URL}/users/${id}`, {
      method: "DELETE",
      headers: getHeaders(),
    }).then(handleResponse<{ message: string }>),
};

// ─── Rules ────────────────────────────────────────────────────────────────

export const rulesApi = {
  list: () =>
    safeFetch(`${BASE_URL}/rules`, { headers: getHeaders() })
      .then(handleResponse<{ rules: ApprovalRule[] }>),

  create: (data: CreateRulePayload) =>
    safeFetch(`${BASE_URL}/rules`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(data),
    }).then(handleResponse<{ rule: ApprovalRule }>),

  update: (id: string, data: CreateRulePayload) =>
    safeFetch(`${BASE_URL}/rules/${id}`, {
      method: "PUT",
      headers: getHeaders(),
      body: JSON.stringify(data),
    }).then(handleResponse<{ rule: ApprovalRule }>),

  toggle: (id: string) =>
    safeFetch(`${BASE_URL}/rules/${id}/toggle`, {
      method: "PATCH",
      headers: getHeaders(),
    }).then(handleResponse<{ rule: ApprovalRule }>),
};

// ─── Types ────────────────────────────────────────────────────────────────

export type UserRole = "EMPLOYEE" | "MANAGER" | "ADMIN";
export type ExpenseStatus = "DRAFT" | "WAITING_APPROVAL" | "APPROVED" | "REJECTED";

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  currency: string;
  country: string;
  managerId: string | null;
  createdAt?: string;
  manager?: { id: string; name: string; email: string } | null;
}

export interface ApprovalLog {
  id: string;
  action: string;
  comment: string;
  step: number;
  createdAt: string;
  approver: { id: string; name: string };
}

export interface Expense {
  id: string;
  description: string;
  amount: number;
  currency: string;
  convertedAmount: number;
  category: string;
  date: string;
  status: ExpenseStatus;
  rejectionReason?: string | null;
  createdAt: string;
  employee: { id: string; name: string; email: string; managerId?: string | null };
  approvalLogs: ApprovalLog[];
  rule?: { id: string; name: string; includeDirectManager: boolean; steps: { id: string }[] } | null;
  approvalReason?: string | null;
}

export interface ApprovalStep {
  id: string;
  order: number;
  userId: string;
}

export interface ApprovalRule {
  id: string;
  name: string;
  description?: string | null;
  isActive: boolean;
  enablePercentageRule: boolean;
  minApprovalPercentage: number;
  enableSpecificRule: boolean;
  specificApproverId?: string | null;
  includeDirectManager: boolean;
  steps: ApprovalStep[];
}

export interface SignupPayload {
  name: string;
  email: string;
  password: string;
  role?: UserRole;
  currency?: string;
  country?: string;
  managerId?: string;
}

export interface CreateExpensePayload {
  description: string;
  amount: number;
  currency: string;
  convertedAmount: number;
  category: string;
  date: string;
  receiptUrl?: string;
  ocrRawText?: string;
  ruleId?: string;
}

export interface CreateUserPayload {
  name: string;
  email: string;
  password?: string;
  role: UserRole;
  currency?: string;
  country?: string;
  managerId?: string | null;
}

export interface CreateRulePayload {
  name: string;
  description?: string;
  isActive?: boolean;
  enablePercentageRule?: boolean;
  minApprovalPercentage?: number;
  enableSpecificRule?: boolean;
  specificApproverId?: string | null;
  includeDirectManager?: boolean;
  steps: { order: number; userId: string }[];
}
