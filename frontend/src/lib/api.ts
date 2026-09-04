"use client";

import type {
  AuditResponse,
  BidderDetailResponse,
  DecisionResponse,
  LoginResponse,
  TenderDetailResponse,
  TendersResponse,
  VerificationListResponse,
  OfficerDecision,
  SessionUser,
} from "./types";

class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
    cache: "no-store",
  });
  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    /* empty body */
  }
  if (!res.ok) {
    const msg =
      (data as { error?: string } | null)?.error ??
      `Request failed (${res.status})`;
    throw new ApiError(msg, res.status);
  }
  return data as T;
}

export const api = {
  login: (body: {
    email: string;
    password: string;
    role: "OFFICER" | "DEVELOPER";
  }) =>
    request<LoginResponse>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  getTenders: (q?: string) =>
    request<TendersResponse>(
      `/api/tenders${q ? `?q=${encodeURIComponent(q)}` : ""}`
    ),

  getTender: (id: string) =>
    request<TenderDetailResponse>(`/api/tenders/${id}`),

  getBidder: (id: string) => request<BidderDetailResponse>(`/api/bidders/${id}`),

  verifyBidder: (id: string) =>
    request<BidderDetailResponse & { audit: unknown }>(
      `/api/bidders/${id}/verify`,
      { method: "POST" }
    ),

  decide: (id: string, decision: OfficerDecision, note?: string) =>
    request<DecisionResponse>(`/api/bidders/${id}/decision`, {
      method: "POST",
      body: JSON.stringify({ decision, note }),
    }),

  getVerificationResults: () =>
    request<VerificationListResponse>("/api/verification"),

  getAudit: () => request<AuditResponse>("/api/audit"),
};

export type { SessionUser };
