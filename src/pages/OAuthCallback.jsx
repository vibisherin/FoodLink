import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useI18n } from "../i18n/I18nContext";

// Google redirects here with the JWT pair in the URL fragment (#access=...&refresh=...).
export default function OAuthCallback() {
  const { completeOAuth } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return; // StrictMode runs effects twice in dev
    ran.current = true;
    const p = new URLSearchParams(window.location.hash.slice(1));
    const access = p.get("access"), refresh = p.get("refresh");
    window.history.replaceState(null, "", window.location.pathname); // scrub tokens from the address bar
    if (!access || !refresh) { navigate("/login?error=google_failed", { replace: true }); return; }
    completeOAuth(access, refresh)
      .then((u) => navigate(u.role === "admin" ? "/admin" : "/dashboard", { replace: true }))
      .catch((e) => setError(e.message));
  }, [completeOAuth, navigate]);

  return <p className="center-note">{error || t("auth.finishing")}</p>;
}
