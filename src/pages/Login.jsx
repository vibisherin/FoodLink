import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import Navbar from "../components/Navbar";
import { useAuth } from "../context/AuthContext";
import { useI18n } from "../i18n/I18nContext";
import { GoogleButton } from "./Register";

export default function Login({ adminOnly = false }) {
  const { login, user } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(params.get("error") ? t(`auth.err.${params.get("error")}`) : "");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (user) navigate(user.role === "admin" ? "/admin" : location.state?.from || "/dashboard", { replace: true });
  }, [user, navigate, location.state]);

  const submit = async (e) => {
    e.preventDefault();
    setError(""); setBusy(true);
    try {
      await login(email.trim(), password, adminOnly);
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
          <h1>{adminOnly ? t("auth.adminTitle") : t("auth.signIn")}</h1>
          {adminOnly && <p className="muted">{t("auth.adminNote")}</p>}
          <label className="field">{t("auth.email")}
            <input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </label>
          <label className="field">{t("auth.password")}
            <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </label>
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="btn-primary wide" disabled={busy}>{busy ? t("auth.working") : t("auth.signIn")}</button>

          {!adminOnly && (
            <>
              <div className="divider"><span>{t("auth.or")}</span></div>
              <GoogleButton />
              <p className="auth-switch">{t("auth.noAccount")} <Link to="/register">{t("nav.register")}</Link></p>
              <p className="auth-switch"><Link to="/admin/login">{t("auth.adminLink")}</Link></p>
            </>
          )}
        </form>
      </main>
    </div>
  );
}
