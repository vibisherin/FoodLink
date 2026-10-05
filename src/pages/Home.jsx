import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import FoodCard from "../components/FoodCard";
import { useAuth } from "../context/AuthContext";
import { useI18n } from "../i18n/I18nContext";

export default function Home() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useI18n();
  const home = user ? (user.role === "admin" ? "/admin" : "/dashboard") : "/register";

  return (
    <div className="page">
      <Navbar />

      <section className="hero">
        <h1>{t("home.title")}</h1>
        <p className="hero-subtitle">{t("home.subtitle")}</p>
        <div className="hero-buttons">
          <button className="btn-primary" onClick={() => navigate(home)}>
            {user ? t("home.openDashboard") : t("home.getStarted")}
          </button>
          {(!user || user.role === "restaurant") && (
            <button className="btn-secondary" onClick={() => navigate(user ? "/scanner" : "/login")}>{t("home.scan")}</button>
          )}
        </div>
      </section>

      <section className="process-section">
        <h2>{t("home.how")}</h2>
        <div className="process-flow">
          {[1, 2, 3, 4, 5, 6].map((n, i) => (
            <div key={n} className="process-item">
              {i > 0 && <div className="process-arrow">↓</div>}
              <div className={`process-step ${n === 4 ? "highlight" : ""}`}>{t(`home.step${n}`)}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="features-section">
        <h2>{t("home.why")}</h2>
        <div className="features-grid">
          <FoodCard icon="🧭" title={t("home.f1.title")} description={t("home.f1.desc")} />
          <FoodCard icon="📷" title={t("home.f2.title")} description={t("home.f2.desc")} />
          <FoodCard icon="⏱️" title={t("home.f3.title")} description={t("home.f3.desc")} />
          <FoodCard icon="🌐" title={t("home.f4.title")} description={t("home.f4.desc")} />
        </div>
      </section>

      <footer className="footer"><p>{t("home.footer")}</p></footer>
    </div>
  );
}
