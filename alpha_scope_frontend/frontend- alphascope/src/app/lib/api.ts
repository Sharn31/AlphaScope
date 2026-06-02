export const BASE_URL = "http://127.0.0.1:8000";

// 🔐 Auth Fetch Wrapper
export async function authFetch(url: string, options: RequestInit = {}) {
  const token = localStorage.getItem("jwt_token");

  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  // 🚨 Auto logout if unauthorized
  if (res.status === 401) {
    localStorage.removeItem("jwt_token");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("user");
    window.location.href = "/login";
  }

  return res;
}

// 📊 Dashboard API
export async function getDashboardData() {
  const res = await authFetch(`${BASE_URL}/market/dashboard/`);
  if (!res.ok) throw new Error("Failed to fetch dashboard");
  return res.json();
}

// 🤖 AI Recommendations API
export async function getAIRecommendations() {
  const res = await authFetch(`${BASE_URL}/market/ai/recommend/`);
  if (!res.ok) throw new Error("Failed to fetch AI recommendations");
  return res.json();
}

// 🤖 AI Recommendations by Symbol (Trading Page)
export async function getAIRecommendationsBySymbol(symbol: string) {
  const res = await authFetch(`${BASE_URL}/market/ai/recommend/?symbol=${encodeURIComponent(symbol)}`);
  if (!res.ok) throw new Error("Failed to fetch AI recommendations");
  return res.json();
}

// 📊 Market APIs
export async function getMarketStatus() {
  const res = await authFetch(`${BASE_URL}/market/status/`);
  if (!res.ok) throw new Error("Failed to fetch market status");
  return res.json();
}

export async function searchStocksAPI(query: string) {
  const res = await authFetch(
    `${BASE_URL}/market/search/?q=${encodeURIComponent(query)}`
  );
  if (!res.ok) throw new Error("Search failed");
  return res.json();
}

// 📁 Portfolio / Holdings APIs
export async function getPortfolio() {
  const res = await authFetch(`${BASE_URL}/market/holdings/`);
  if (!res.ok) throw new Error("Failed to fetch portfolio");
  return res.json();
}

export async function addHolding(data: {
  symbol: string;
  quantity: number;
  buy_price: number;
}) {
  const res = await authFetch(`${BASE_URL}/market/holdings/`, {
    method: "POST",
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || "Failed to add holding");
  }
  return res.json();
}

export async function deleteHolding(id: number) {
  const res = await authFetch(`${BASE_URL}/market/holdings/${id}/`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Failed to delete holding");
}

// 📈 Stock Quote
export async function getStockQuote(symbol: string) {
  const res = await authFetch(`${BASE_URL}/market/stocks/${symbol}/`);
  if (!res.ok) throw new Error("Failed to fetch quote");
  const data = await res.json();
  return {
    price:  data.price  ?? null,
    high:   data.high   ?? null,
    low:    data.low    ?? null,
    volume: data.volume ?? null,
  };
}

// 🤖 AI Chat Widget — sends message to Groq LLaMA3 with page context
export async function sendChatMessage(
  message: string,
  page_context: string = "",
  pathname: string = "",
) {
  const res = await authFetch(`${BASE_URL}/market/chat/`, {
    method: "POST",
    body: JSON.stringify({ message, page_context, pathname }),
  });
  if (!res.ok) throw new Error(`Chat failed: HTTP ${res.status}`);
  return res.json(); // returns { reply, web_searched }
}

// ─── Account — Password Reset (public, no auth needed) ───────────────────────

// POST /accounts/password/reset/  — sends reset email
export async function requestPasswordReset(email: string) {
  const res = await fetch(`${BASE_URL}/accounts/password/reset/`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ email }),
  });
  if (!res.ok) throw new Error("Failed to send reset email");
  return res.json();
}

// POST /accounts/password/reset/confirm/  — confirms with uid + token
export async function confirmPasswordReset(
  uid: string,
  token: string,
  new_password: string,
) {
  const res = await fetch(`${BASE_URL}/accounts/password/reset/confirm/`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ uid, token, new_password }),
  });
  if (!res.ok) throw new Error("Failed to reset password");
  return res.json();
}

// ─── Account — Authenticated actions ─────────────────────────────────────────

// POST /accounts/change_password/  — body: { old_password, new_password }
export async function changePassword(current_password: string, new_password: string) {
  const res = await authFetch(`${BASE_URL}/accounts/change_password/`, {
    method: "POST",
    body:   JSON.stringify({ current_password, new_password }),
  });
  if (!res.ok) throw new Error("Failed to change password");
  return res.json();
}

// POST /accounts/update_email/  — body: { email }
export async function updateEmail(email: string) {
  const res = await authFetch(`${BASE_URL}/accounts/update_email/`, {
    method: "POST",
    body:   JSON.stringify({ email }),
  });
  if (!res.ok) throw new Error("Failed to update email");
  return res.json();
}

// DELETE /accounts/delete_account/  — body: { password }
export async function deleteAccount(password: string) {
  const res = await authFetch(`${BASE_URL}/accounts/delete_account/`, {
    method: "DELETE",
    body:   JSON.stringify({ password }),
  });
  if (!res.ok) throw new Error("Failed to delete account");
  return res.json();
}