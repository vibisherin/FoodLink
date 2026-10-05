import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import { useAuth } from "../context/AuthContext";
import { useI18n } from "../i18n/I18nContext";

// Google button + the role that brand-new Google accounts should join as.
export function GoogleButton() {
  const { t } = useI18n();
  const [enabled, setEnabled] = useState(null);
  const [role, setRole] = useState("restaurant");

  useEffect(() => {
    fetch("/api/auth/providers").then((r) => r.json()).then((j) => setEnabled(!!j.google)).catch(() => setEnabled(false));
  }, []);

  return (
    <div className="google-block">
      <button
        type="button"
        className="btn-google wide"
        disabled={enabled === false}
        title={enabled === false ? t("auth.err.google_not_configured") : ""}
        onClick={() => { window.location.href = `/api/auth/google?role=${role}`; }}
      >
        <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
          <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z"/>
          <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17.5z"/>
          <path fill="#FBBC05" d="M10.5 28.7a14.5 14.5 0 010-9.4l-7.9-6.1a24 24 0 000 21.6l7.9-6.1z"/>
          <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.9 2.3-8.4 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z"/>
        </svg>
        {t("auth.google")}
      </button>
      <label className="google-role">{t("auth.googleAs")}
        <select value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="restaurant">{t("role.restaurant")}</option>
          <option value="ngo">{t("role.ngo")}</option>
        </select>
      </label>
    </div>
  );
}

export default function Register() {
  const { register, user } = useAuth();
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const [f, setF] = useState({ name: "", email: "", password: "", role: "restaurant", organization_name: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  useEffect(() => { if (user) navigate("/dashboard", { replace: true }); }, [user, navigate]);

  const submit = async (e) => {
    e.preventDefault();
    setError(""); setBusy(true);
    try {
      await register({ ...f, email: f.email.trim(), language: lang });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page">
      <Navbar />
      <main className="auth-wrap">
        <form className="panel auth-card" onSubmit={submit}>
          <h1>{t("auth.signUp")}</h1>
          <label className="field">{t("auth.role")}
            <select value={f.role} onChange={set("role")}>
              <option value="restaurant">{t("role.restaurant")}</option>
              <option value="ngo">{t("role.ngo")}</option>
            </select>
          </label>
          <label className="field">{t("auth.name")}<input value={f.name} onChange={set("name")} required minLength={2} autoComplete="name" /></label>
          <label className="field">{t("auth.org")}<input value={f.organization_name} onChange={set("organization_name")} required minLength={2} /></label>
          <label className="field">{t("auth.email")}<input type="email" value={f.email} onChange={set("email")} required autoComplete="username" /></label>
          <label className="field">{t("auth.password")}
            <input type="password" value={f.password} onChange={set("password")} required minLength={8} autoComplete="new-password" />
            <span className="muted small">{t("auth.passwordHint")}</span>
          </label>
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="btn-primary wide" disabled={busy}>{busy ? t("auth.working") : t("nav.register")}</button>
          <div className="divider"><span>{t("auth.or")}</span></div>
          <GoogleButton />
          <p className="auth-switch">{t("auth.haveAccount")} <Link to="/login">{t("auth.signIn")}</Link></p>
        </form>
      </main>
    </div>
  );
}
