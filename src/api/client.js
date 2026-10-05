// Tiny fetch wrapper: attaches the JWT, and on a 401 silently exchanges the
// refresh token for a new pair and retries the request once.
const KEY = "foodlink.tokens";

export const tokenStore = {
  get() {
    try { return JSON.parse(localStorage.getItem(KEY)) || null; } catch { return null; }
  },
  set(tokens) { localStorage.setItem(KEY, JSON.stringify(tokens)); },
  clear() { localStorage.removeItem(KEY); },
};

let refreshing = null;
async function refreshTokens() {
  const t = tokenStore.get();
  if (!t?.refreshToken) throw new Error("no refresh token");
  refreshing ||= fetch("/api/auth/refresh", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken: t.refreshToken }),
  })
    .then(async (r) => {
      const j = await r.json();
      if (!r.ok) throw new Error(j.message || "refresh failed");
      tokenStore.set({ accessToken: j.accessToken, refreshToken: j.refreshToken });
    })
    .finally(() => { refreshing = null; });
  return refreshing;
}

export class ApiError extends Error {
  constructor(message, status, data) { super(message); this.status = status; this.data = data; }
}

export async function api(path, { method = "GET", body, retry = true } = {}) {
  const t = tokenStore.get();
  const res = await fetch(`/api${path}`, {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(t?.accessToken ? { Authorization: `Bearer ${t.accessToken}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401 && retry && t?.refreshToken && !path.startsWith("/auth/")) {
    try {
      await refreshTokens();
      return api(path, { method, body, retry: false });
    } catch {
      tokenStore.clear();
      window.dispatchEvent(new Event("foodlink:logout"));
    }
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.message || `Request failed (${res.status})`, res.status, data);
  return data;
}
