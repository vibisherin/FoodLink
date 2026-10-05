import { useState } from "react";
import Navbar from "../components/Navbar";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useI18n } from "../i18n/I18nContext";
import { LANGUAGES } from "../i18n/translations";

const CATS = ["cooked", "bakery", "produce", "dairy", "packaged"];

export default function Profile() {
  const { user, setUser } = useAuth();
  const { t, setLang } = useI18n();
  const p = user.profile || {};
  const [name, setName] = useState(user.name);
  const [language, setLanguage] = useState(user.language);
  const [org, setOrg] = useState({
    name: p.name || "", address: p.address || "", city: p.city || "", phone: p.phone || "",
    latitude: p.latitude ?? "", longitude: p.longitude ?? "",
    daily_capacity_meals: p.daily_capacity_meals ?? 100, max_radius_km: p.max_radius_km ?? 10,
    accepted_categories: (p.accepted_categories || CATS.join(",")).split(","), has_vehicle: !!p.has_vehicle,
  });
  const [msg, setMsg] = useState({ ok: "", err: "" });
  const isNgo = user.role === "ngo";
  const setO = (k) => (e) => setOrg({ ...org, [k]: e.target.value });

  const locate = () => {
    navigator.geolocation?.getCurrentPosition(
      (pos) => setOrg((o) => ({ ...o, latitude: pos.coords.latitude.toFixed(6), longitude: pos.coords.longitude.toFixed(6) })),
      () => setMsg({ ok: "", err: t("p.locFailed") })
    );
  };

  const toggleCat = (c) => setOrg((o) => ({
    ...o,
    accepted_categories: o.accepted_categories.includes(c) ? o.accepted_categories.filter((x) => x !== c) : [...o.accepted_categories, c],
  }));

  const save = async (e) => {
    e.preventDefault();
    setMsg({ ok: "", err: "" });
    try {
      const profile = { ...org };
      if (!isNgo) ["daily_capacity_meals", "max_radius_km", "accepted_categories", "has_vehicle"].forEach((k) => delete profile[k]);
      const r = await api("/auth/me", { method: "PATCH", body: { name, language, profile } });
      setUser(r.user); setLang(language);
      setMsg({ ok: t("r.saved"), err: "" });
    } catch (err) {
      setMsg({ ok: "", err: err.message });
    }
  };

  return (
    <div className="page">
      <Navbar />
      <main className="dashboard-container narrow">
        <h1 className="section-title">{t("p.title")}</h1>
        <form className="panel form-grid" onSubmit={save}>
          <h3 className="form-title span-2">{t("p.account")}</h3>
          <label className="field">{t("auth.name")}<input value={name} onChange={(e) => setName(e.target.value)} required minLength={2} /></label>
          <label className="field">{t("p.language")}
            <select value={language} onChange={(e) => setLanguage(e.target.value)}>
              {LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
            </select>
          </label>

          <h3 className="form-title span-2">{t("p.org")}</h3>
          <label className="field span-2">{t("auth.org")}<input value={org.name} onChange={setO("name")} required minLength={2} /></label>
          <label className="field">{t("p.address")}<input value={org.address} onChange={setO("address")} /></label>
          <label className="field">{t("p.city")}<input value={org.city} onChange={setO("city")} /></label>
          <label className="field">{t("p.phone")}<input value={org.phone} onChange={setO("phone")} /></label>
          <span />
          <label className="field">{t("p.lat")}<input type="number" step="any" min="-90" max="90" value={org.latitude} onChange={setO("latitude")} /></label>
          <label className="field">{t("p.lng")}<input type="number" step="any" min="-180" max="180" value={org.longitude} onChange={setO("longitude")} /></label>
          <div className="span-2"><button type="button" className="btn-secondary btn-compact" onClick={locate}>📍 {t("p.locate")}</button>
            <p className="muted small">{t("p.locateHelp")}</p></div>

          {isNgo && (
            <>
              <label className="field">{t("p.capacity")}<input type="number" min="1" step="1" value={org.daily_capacity_meals} onChange={setO("daily_capacity_meals")} /></label>
              <label className="field">{t("p.radius")}<input type="number" min="1" max="100" step="0.5" value={org.max_radius_km} onChange={setO("max_radius_km")} /></label>
              <fieldset className="span-2 checks"><legend>{t("p.categories")}</legend>
                {CATS.map((c) => (
                  <label key={c}><input type="checkbox" checked={org.accepted_categories.includes(c)} onChange={() => toggleCat(c)} /> {t(`cat.${c}`)}</label>
                ))}
              </fieldset>
              <label className="span-2 checks"><input type="checkbox" checked={org.has_vehicle} onChange={(e) => setOrg({ ...org, has_vehicle: e.target.checked })} /> {t("p.vehicle")}</label>
            </>
          )}

          {msg.err && <p className="form-error span-2" role="alert">{msg.err}</p>}
          {msg.ok && <p className="ok-text span-2">{msg.ok}</p>}
          <div className="form-actions span-2"><button className="btn-primary">{t("p.save")}</button></div>
        </form>
      </main>
    </div>
  );
}
