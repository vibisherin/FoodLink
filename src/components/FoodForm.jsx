import { useState } from "react";
import { api } from "../api/client";
import { useI18n } from "../i18n/I18nContext";

const CATEGORIES = ["cooked", "bakery", "produce", "dairy", "packaged"];
const UNITS = ["kg", "litres", "packs", "plates"];

// <input type="datetime-local"> wants local time without a zone suffix.
export function toLocalInput(date) {
  const d = new Date(date);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function FoodForm({ food, prefill, onSaved, onCancel }) {
  const { t } = useI18n();
  const base = food || prefill || {};
  const [f, setF] = useState({
    name: base.name || "",
    category: base.category || "cooked",
    quantity: base.quantity ?? "",
    unit: base.unit || "kg",
    servings: base.servings ?? "",
    expiry: toLocalInput(base.expiry_time || Date.now() + 6 * 3600 * 1000),
    notes: base.notes || "",
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setError(""); setBusy(true);
    const body = {
      name: f.name, category: f.category, quantity: Number(f.quantity), unit: f.unit,
      servings: Number(f.servings), expiry_time: new Date(f.expiry).toISOString(), notes: f.notes,
    };
    try {
      if (food) await api(`/food/${food.id}`, { method: "PUT", body });
      else await api("/food", { method: "POST", body });
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="panel form-grid" onSubmit={submit}>
      <h3 className="form-title">{food ? t("r.editFood") : t("r.newFood")}</h3>
      <label className="field span-2">{t("r.food")}
        <input value={f.name} onChange={set("name")} required minLength={2} maxLength={150} />
      </label>
      <label className="field">{t("r.category")}
        <select value={f.category} onChange={set("category")}>
          {CATEGORIES.map((c) => <option key={c} value={c}>{t(`cat.${c}`)}</option>)}
        </select>
      </label>
      <label className="field">{t("r.quantity")}
        <div className="inline">
          <input type="number" min="0.1" step="0.1" value={f.quantity} onChange={set("quantity")} required />
          <select value={f.unit} onChange={set("unit")} aria-label="Unit">
            {UNITS.map((u) => <option key={u} value={u}>{t(`unit.${u}`)}</option>)}
          </select>
        </div>
      </label>
      <label className="field">{t("r.servings")}
        <input type="number" min="1" step="1" value={f.servings} onChange={set("servings")} required />
      </label>
      <label className="field">{t("r.expiryTime")}
        <input type="datetime-local" value={f.expiry} onChange={set("expiry")} required />
      </label>
      <label className="field span-2">{t("r.notes")}
        <input value={f.notes} onChange={set("notes")} maxLength={250} />
      </label>
      {error && <p className="form-error span-2" role="alert">{error}</p>}
      <div className="form-actions span-2">
        <button className="btn-primary" disabled={busy}>{t("r.save")}</button>
        <button type="button" className="btn-secondary" onClick={onCancel}>{t("r.cancel")}</button>
      </div>
    </form>
  );
}
