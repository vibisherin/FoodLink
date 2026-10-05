import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Navbar from "../components/Navbar";
import StatCard from "../components/StatCard";
import DonationList from "../components/DonationList";
import DetailModal from "../components/DetailModal";
import RecentlyAccessed from "../components/RecentlyAccessed";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useI18n } from "../i18n/I18nContext";

export default function NgoDashboard() {
  const { user } = useAuth();
  const { t, timeLeft } = useI18n();
  const [feed, setFeed] = useState([]);
  const [summary, setSummary] = useState(null);
  const [donations, setDonations] = useState([]);
  const [error, setError] = useState("");
  const [detail, setDetail] = useState(null);
  const [recentKey, setRecentKey] = useState(0);
  const [, tick] = useState(0);

  const load = useCallback(async () => {
    try {
      const [f, s, d] = await Promise.all([api("/food"), api("/dashboard/summary"), api("/donations")]);
      setFeed(f.data.filter((x) => x.match.feasible));
      setSummary(s.data); setDonations(d.data); setError("");
    } catch (e) {
      setError(e.message);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const id = setInterval(() => { tick((x) => x + 1); load(); }, 60000);
    return () => clearInterval(id);
  }, [load]);

  const claim = async (id) => {
    try { await api("/donations/claim", { method: "POST", body: { food_id: id } }); load(); }
    catch (e) { setError(e.message); load(); }
  };

  const c = summary?.counts;
  const cap = summary?.capacity;
  const profile = user.profile;
  const noLocation = profile && (profile.latitude == null || profile.longitude == null);

  return (
    <div className="page">
      <Navbar />
      <div className="dashboard-container">
        <div className="dashboard-header"><h1>{t("n.title", { name: profile?.name || user.name })}</h1></div>

        {noLocation && <div className="banner warn">{t("p.locateHelp")} <Link to="/profile">{t("nav.profile")}</Link></div>}
        {error && <div className="banner error" role="alert">{error}</div>}

        {c && (
          <div className="stats-grid">
            <StatCard label={t("n.open")} value={c.openFood} color="#2e7d32" />
            <StatCard label={t("n.pending")} value={c.pending} color="#f9a825" />
            <StatCard label={t("n.active")} value={c.active} color="#00838f" />
            <StatCard label={t("n.completed")} value={c.completed} color="#1565c0" />
            <StatCard label={t("r.meals")} value={summary.impact.meals} color="#43a047" />
          </div>
        )}

        {cap && (
          <div className="panel capacity">
            <div className="capacity-head">
              <span>{t("n.capacity")}</span>
              <b>{t("n.of", { used: cap.usedToday, total: cap.daily })}</b>
            </div>
            <div className="bar big"><div style={{ width: `${Math.min(100, (cap.usedToday / cap.daily) * 100)}%` }} /></div>
          </div>
        )}

        <h2 className="section-title">{t("n.feed")}</h2>
        <p className="muted">{t("n.feedHelp")}</p>
        {feed.length === 0 ? (
          <p className="empty">{t("n.noFeed")}</p>
        ) : (
          <div className="feed-grid">
            {feed.map((f) => (
              <article key={f.id} className="panel feed-card">
                <div className="match-head">
                  <div>
                    <button className="link-btn strong" onClick={() => setDetail({ type: "food", id: f.id })}>{f.name}</button>
                    <div className="muted small">{t("n.from", { name: f.restaurant_name })}</div>
                  </div>
                  <div className="score-ring" title={t("m.score")}>{Math.round(f.match.score)}</div>
                </div>
                <div className="match-facts">
                  <span>{t(`cat.${f.category}`)}</span>
                  <span>{f.servings} {t("r.servings").toLowerCase()}</span>
                  <span>{t("r.km", { km: f.match.distanceKm })}</span>
                  <span>{t("m.eta")}: {t("m.min", { n: f.match.etaMinutes })}</span>
                  <span>{t("n.expires", { t: timeLeft(f.expiry_time) })}</span>
                </div>
                <button className="btn-primary btn-compact" onClick={() => claim(f.id)}>{t("n.claim")}</button>
              </article>
            ))}
          </div>
        )}

        <div className="two-col">
          <section>
            <h2 className="section-title">{t("n.myDonations")}</h2>
            <div className="panel">
              <DonationList donations={donations} role="ngo" onChanged={load} onOpen={(type, id) => setDetail({ type, id })} onError={setError} />
            </div>
          </section>
          <RecentlyAccessed refreshKey={recentKey} onOpen={(type, id) => setDetail({ type, id })} />
        </div>
      </div>

      {detail && <DetailModal {...detail} onClose={() => { setDetail(null); load(); }} onViewed={() => setRecentKey((k) => k + 1)} />}
    </div>
  );
}
