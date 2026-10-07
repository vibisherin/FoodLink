import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api, tokenStore } from "../api/client";
import { useI18n } from "../i18n/I18nContext";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const { setLang } = useI18n();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(!!tokenStore.get());

  const adopt = useCallback((u) => {
    setUser(u);
    if (u?.language) setLang(u.language); // the account's saved language wins after sign-in
  }, [setLang]);

  // Restore the session from the stored JWT on page load.
  useEffect(() => {
    if (!tokenStore.get()) return;
    api("/auth/me")
      .then((r) => adopt(r.user))
      .catch(() => tokenStore.clear())
      .finally(() => setLoading(false));
  }, [adopt]);

  useEffect(() => {
    const onLogout = () => setUser(null);
    window.addEventListener("foodlink:logout", onLogout);
    return () => window.removeEventListener("foodlink:logout", onLogout);
  }, []);

  const login = useCallback(async (email, password, adminOnly = false) => {
    const r = await api("/auth/login", { method: "POST", body: { email, password, adminOnly } });
    tokenStore.set({ accessToken: r.accessToken, refreshToken: r.refreshToken });
    adopt(r.user);
    return r.user;
  }, [adopt]);

  const register = useCallback(async (form) => {
    const r = await api("/auth/register", { method: "POST", body: form });
    tokenStore.set({ accessToken: r.accessToken, refreshToken: r.refreshToken });
    adopt(r.user);
    return r.user;
  }, [adopt]);

  const completeOAuth = useCallback(async (accessToken, refreshToken) => {
    tokenStore.set({ accessToken, refreshToken });
    const r = await api("/auth/me");
    adopt(r.user);
    return r.user;
  }, [adopt]);

  const logout = useCallback(async () => {
    const t = tokenStore.get();
    try { await api("/auth/logout", { method: "POST", body: { refreshToken: t?.refreshToken } }); } catch { /* ignore */ }
    tokenStore.clear();
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    const r = await api("/auth/me");
    setUser(r.user);
    return r.user;
  }, []);

  const value = useMemo(
    () => ({ user, setUser, loading, login, register, logout, completeOAuth, refreshUser }),
    [user, loading, login, register, logout, completeOAuth, refreshUser]
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
