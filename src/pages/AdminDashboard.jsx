import { useCallback, useEffect, useState } from "react";
import Navbar from "../components/Navbar";
import StatCard from "../components/StatCard";
import StatusBadge from "../components/StatusBadge";
import { api } from "../api/client";
import { useI18n } from "../i18n/I18nContext";

const fmt = (iso, lang) => (iso ? new Date(iso).toLocaleString(lang === "en" ? undefined : lang) : null);

function BarList({ rows, empty }) {
  const max = Math.max(1, ...rows.map((r) => r.meals));
  if (!rows.length) return <p className="muted small">{empty}</p>;
  return rows.map((r) => (
    <div key={r.name} className="factor">
      <span>{r.name}</span>
      <div className="bar"><div style={{ width: `${(r.meals / max) * 100}%` }} /></div>
      <span className="factor-val">{r.meals}</span>
    </div>
  ));
}

export default function AdminDashboard() {
  const { t, lang } = useI18n();
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [activity, setActivity] = useState([]);
  const [donations, setDonations] = useState([]);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const [s, u, a, d] = await Promise.all([api("/admin/stats"), api("/admin/users"), api("/admin/activity"), api("/admin/donations")]);
      setStats(s.data); setUsers(u.data); setActivity(a.data); setDonations(d.data); setError("");
    } catch (e) { setError(e.message); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const toggle = async (u) => {
    try { await api(`/admin/users/${u.id}/active`, { method: "PATCH", body: { is_active: !u.is_active } }); load(); }
    catch (e) { setError(e.message); }
  };

  const maxDay = Math.max(1, ...(stats?.perDay.map((d) => d.donations) || [1]));

  return (
    <div className="page">
      <Navbar />
      <div className="dashboard-container">
        <div className="dashboard-header"><h1>{t("a.title")}</h1></div>
        {error && <div className="banner error" role="alert">{error}</div>}

        {stats && (
          <>
            <div className="stats-grid">
              <StatCard label={t("a.users")} value={stats.users.total} color="#2e7d32" />
              <StatCard label={t("a.restaurants")} value={stats.users.restaurants} color="#43a047" />
              <StatCard label={t("a.ngos")} value={stats.users.ngos} color="#00838f" />
              <StatCard label={t("a.foodItems")} value={stats.food.total} color="#f9a825" />
              <StatCard label={t("a.donations")} value={stats.donations.total} color="#6a1b9a" />
              <StatCard label={t("a.mealsRescued")} value={stats.impact.meals} color="#1565c0" />
            </div>
            <div className="impact-strip">
              <div><b>{stats.donations.completed}</b><span>{t("a.completed")}</span></div>
              <div><b>{stats.impact.kgFoodSaved}</b><span>{t("r.kg")}</span></div>
              <div><b>{stats.impact.co2AvoidedKg}</b><span>{t("r.co2")}</span></div>
              <p className="muted small">{t("r.estimate")}</p>
            </div>

            <div className="two-col even">
              <section className="panel">
                <h3>{t("a.last14")}</h3>
                {stats.perDay.length === 0 ? <p className="muted small">{t("a.noData")}</p> : (
                  <div className="columns" role="img" aria-label={t("a.last14")}>
                    {stats.perDay.map((d) => (
                      <div key={d.day} className="col" title={`${d.day}: ${d.donations}`}>
                        <span className="col-val">{d.donations}</span>
                        <div style={{ height: `${(d.donations / maxDay) * 100}%` }} />
                        <span className="col-label">{d.day.slice(8)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </section>
              <section className="panel">
                <h3>{t("a.topRestaurants")}</h3><BarList rows={stats.topRestaurants} empty={t("a.noData")} />
                <h3 className="mt">{t("a.topNgos")}</h3><BarList rows={stats.topNgos} empty={t("a.noData")} />
              </section>
            </div>
          </>
        )}

        <h2 className="section-title">{t("a.manageUsers")}</h2>
        <div className="food-table-wrapper">
          <table className="food-table">
            <thead><tr><th>{t("a.name")}</th><th>{t("a.email")}</th><th>{t("a.role")}</th><th>{t("a.org")}</th><th>{t("a.lastLogin")}</th><th>{t("a.access")}</th></tr></thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>{u.name}{u.google_linked ? <span className="tag">{t("a.google")}</span> : null}</td>
                  <td>{u.email}</td>
                  <td>{t(`role.${u.role}`)}</td>
                  <td>{u.organisation || "—"}</td>
                  <td>{fmt(u.last_login_at, lang) || t("a.never")}</td>
                  <td>
                    {u.role === "admin" ? <span className="muted small">{t("a.enabled")}</span> : (
                      <button className="btn-small" onClick={() => toggle(u)}>{u.is_active ? t("a.disable") : t("a.enable")}</button>
                    )}
                    {!u.is_active && <span className="tag danger">{t("a.disabled")}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="two-col even">
          <section>
            <h2 className="section-title">{t("a.allDonations")}</h2>
            <div className="panel donation-list">
              {donations.slice(0, 12).map((d) => (
                <div key={d.id} className="donation-row">
                  <div className="donation-main">{d.food_name}<div className="muted small">{d.restaurant_name} → {d.ngo_name}</div></div>
                  <StatusBadge status={d.status} kind="donation" />
                </div>
              ))}
              {!donations.length && <p className="muted small">{t("a.noData")}</p>}
            </div>
          </section>
          <section>
            <h2 className="section-title">{t("a.activity")}</h2>
            <div className="panel activity">
              {activity.map((a) => (
                <div key={a.id} className="activity-row">
                  <b>{a.user_name || "—"}</b> <span className="muted">{a.action.replaceAll("_", " ")}</span>
                  {a.details && <span className="small"> · {a.details}</span>}
                  <div className="muted small">{fmt(a.created_at, lang)}</div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
