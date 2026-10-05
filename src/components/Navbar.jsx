import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useI18n } from "../i18n/I18nContext";
import { LANGUAGES } from "../i18n/translations";
import { api } from "../api/client";

export default function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout, setUser } = useAuth();
  const { t, lang, setLang } = useI18n();

  const links = [{ label: t("nav.home"), path: "/" }];
  if (user) {
    links.push({ label: t("nav.dashboard"), path: user.role === "admin" ? "/admin" : "/dashboard" });
    if (user.role === "restaurant") links.push({ label: t("nav.scanner"), path: "/scanner" });
    if (user.role !== "admin") links.push({ label: t("nav.profile"), path: "/profile" });
  }

  const changeLang = async (code) => {
    setLang(code);
    if (user) {
      try {
        await api("/auth/me", { method: "PATCH", body: { language: code } });
        setUser({ ...user, language: code });
      } catch { /* the UI language still changed locally */ }
    }
  };

  return (
    <header className="navbar">
      <div className="navbar-logo" onClick={() => navigate("/")}>🌿 FoodLink</div>
      <nav className="navbar-links" aria-label="Main">
        {links.map((link) => (
          <button
            key={link.path}
            className={`nav-link ${location.pathname === link.path ? "active" : ""}`}
            onClick={() => navigate(link.path)}
          >
            {link.label}
          </button>
        ))}
      </nav>
      <div className="navbar-right">
        <select className="lang-select" value={lang} onChange={(e) => changeLang(e.target.value)} aria-label="Language">
          {LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
        </select>
        {user ? (
          <>
            <span className="user-chip" title={user.email}>
              {user.name.split(" ")[0]} · {t(`role.${user.role}`)}
            </span>
            <button className="btn-small" onClick={async () => { await logout(); navigate("/"); }}>{t("nav.logout")}</button>
          </>
        ) : (
          <>
            <button className="nav-link" onClick={() => navigate("/login")}>{t("nav.login")}</button>
            <button className="btn-primary btn-compact" onClick={() => navigate("/register")}>{t("nav.register")}</button>
          </>
        )}
      </div>
    </header>
  );
}
