import { useCallback, useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import StatCard from "../components/StatCard";
import FoodTable from "../components/FoodTable";
import FoodForm from "../components/FoodForm";
import MatchModal from "../components/MatchModal";
import DetailModal from "../components/DetailModal";
import DonationList from "../components/DonationList";
import RecentlyAccessed from "../components/RecentlyAccessed";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useI18n } from "../i18n/I18nContext";

export default function RestaurantDashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { t } = useI18n();

  const [food, setFood] = useState([]);
  const [summary, setSummary] = useState(null);
  const [donations, setDonations] = useState([]);
  const [ngos, setNgos] = useState([]);
  const [error, setError] = useState("");
  const [form, setForm] = useState(location.state?.prefill ? { food: null, prefill: location.state.prefill } : null);
  const [matchFor, setMatchFor] = useState(null);
  const [detail, setDetail] = useState(null);
  const [recentKey, setRecentKey] = useState(0);
  const [, tick] = useState(0);

  const load = useCallback(async () => {
    try {
      const [f, s, d, n] = await Promise.all([
        api("/food"), api("/dashboard/summary"), api("/donations"), api("/ngos"),
      ]);
      setFood(f.data); setSummary(s.data); setDonations(d.data); setNgos(n.data);
      setError("");
    } catch (e) {
      setError(e.message);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  // Countdowns and statuses stay live without a page refresh.
  useEffect(() => {
    const id = setInterval(() => { tick((x) => x + 1); load(); }, 60000);
    return () => clearInterval(id);
  }, [load]);

  const remove = async (item) => {
    if (!window.confirm(t("r.confirmRemove", { name: item.name }))) return;
    try { await api(`/food/${item.id}`, { method: "DELETE" }); load(); } catch (e) { setError(e.message); }
  };

  const c = summary?.counts;
  const profile = user.profile;
  const noLocation = profile && (profile.latitude == null || profile.longitude == null);

  return (
    <div className="page">
      <Navbar />
      <div className="dashboard-container">
        <div className="dashboard-header">
          <h1>{t("r.title", { name: profile?.name || user.name })}</h1>
          <div className="dashboard-actions">
            <button className="btn-primary" onClick={() => setForm({ food: null })}>+ {t("r.add")}</button>
            <button className="btn-secondary" onClick={() => navigate("/scanner")}>{t("r.scan")}</button>
          </div>
        </div>

        {noLocation && (
          <div className="banner warn">{t("p.locateHelp")} <Link to="/profile">{t("nav.profile")}</Link></div>
        )}
        {error && <div className="banner error" role="alert">{error}</div>}

        {c && (
          <div className="stats-grid">
            <StatCard label={t("r.total")} value={c.total} color="#2e7d32" />
            <StatCard label={t("r.available")} value={c.available} color="#43a047" />
            <StatCard label={t("r.expiring")} value={c.expiring} color="#f9a825" />
            <StatCard label={t("r.reserved")} value={c.reserved} color="#6a1b9a" />
            <StatCard label={t("r.donated")} value={c.donated} color="#1565c0" />
            <StatCard label={t("r.expired")} value={c.expired} color="#c62828" />
          </div>
        )}

        {summary && (
          <div className="impact-strip">
            <div><b>{summary.impact.meals}</b><span>{t("r.meals")}</span></div>
            <div><b>{summary.impact.kgFoodSaved}</b><span>{t("r.kg")}</span></div>
            <div><b>{summary.impact.co2AvoidedKg}</b><span>{t("r.co2")}</span></div>
            <p className="muted small">{t("r.estimate")}</p>
          </div>
        )}

        {form && (
          <FoodForm
            food={form.food}
            prefill={form.prefill}
            onCancel={() => setForm(null)}
            onSaved={() => { setForm(null); load(); }}
          />
        )}

        <h2 className="section-title">{t("r.inventory")}</h2>
        <FoodTable
          items={food}
          onOpen={(type, id) => setDetail({ type, id })}
          onMatch={setMatchFor}
          onEdit={(item) => setForm({ food: item })}
          onRemove={remove}
        />

        <div className="two-col">
          <section>
            <h2 className="section-title">{t("r.donations")}</h2>
            <div className="panel">
              <DonationList donations={donations} role="restaurant" onChanged={load} onOpen={(type, id) => setDetail({ type, id })} onError={setError} />
            </div>
          </section>
          <RecentlyAccessed refreshKey={recentKey} onOpen={(type, id) => setDetail({ type, id })} />
        </div>

        <h2 className="section-title">{t("r.partners")}</h2>
        <div className="partner-grid">
          {ngos.map((n) => (
            <button key={n.id} className="partner-card" onClick={() => setDetail({ type: "ngo", id: n.id })}>
              <strong>{n.name}</strong>
              <span className="muted small">{n.address}</span>
              <span className="small">
                {n.distance_km != null && `${t("r.km", { km: n.distance_km })} · `}{t("r.reliability", { pct: n.reliability })}
              </span>
            </button>
          ))}
        </div>
      </div>

      {matchFor && <MatchModal food={matchFor} onClose={() => setMatchFor(null)} onOffered={load} />}
      {detail && <DetailModal {...detail} onClose={() => { setDetail(null); load(); }} onViewed={() => setRecentKey((k) => k + 1)} />}
    </div>
  );
}
