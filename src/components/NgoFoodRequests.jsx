import { useCallback, useEffect, useState } from "react";
import { api } from "../api/client";
import { useI18n } from "../i18n/I18nContext";
import { PriorityBadge, RequestStatusBadge } from "./RequestBadges";

const CATEGORIES = ["cooked", "bakery", "produce", "dairy", "packaged"];
const UNITS = ["kg", "litres", "packs", "plates"];
const PRIORITIES = ["Urgent", "High", "Normal"];
const EMPTY = { category: "cooked", quantity: "", unit: "kg", servings_requested: "", priority: "Normal", reason: "" };

// NGO side of the request flow: "Request Food" form + "My Food Requests" list.
export default function NgoFoodRequests({ onChanged }) {
  const { t } = useI18n();
  const [f, setF] = useState(EMPTY);
  const [requests, setRequests] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const load = useCallback(async () => {
    try { setRequests((await api("/requests/my")).data); } catch (e) { setError(e.message); }
  }, []);

  useEffect(() => { load(); }, [load]);
  // Allocations made by restaurants show up without a manual refresh.
  useEffect(() => {
    const id = setInterval(load, 30000);
    return () => clearInterval(id);
  }, [load]);

  const submit = async (e) => {
    e.preventDefault();
    setError(""); setOk(""); setBusy(true);
    try {
      await api("/requests", {
        method: "POST",
        body: {
          category: f.category, quantity: Number(f.quantity), unit: f.unit,
          servings_requested: Number(f.servings_requested), priority: f.priority, reason: f.reason,
        },
      });
      setOk(t("fr.submitted"));
      setF(EMPTY);
      await load();
      onChanged?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const cancel = async (r) => {
    if (!window.confirm(t("fr.confirmCancel"))) return;
    setError(""); setOk("");
    try {
      await api(`/requests/${r.id}/cancel`, { method: "PATCH" });
      setOk(t("fr.cancelled"));
      await load();
    } catch (err) {
      setError(err.message);
      load();
    }
  };

  return (
    <>
      <h2 className="section-title">{t("fr.requestFood")}</h2>
      <form className="panel form-grid" onSubmit={submit}>
        <label className="field">{t("r.category")}
          <select value={f.category} onChange={set("category")}>
            {CATEGORIES.map((c) => <option key={c} value={c}>{t(`cat.${c}`)}</option>)}
          </select>
        </label>
        <label className="field">{t("r.quantity")}
          <div className="inline">
            <input type="number" min="0.1" step="0.1" max="999999" value={f.quantity} onChange={set("quantity")} required />
            <select value={f.unit} onChange={set("unit")} aria-label={t("fr.unit")}>
              {UNITS.map((u) => <option key={u} value={u}>{t(`unit.${u}`)}</option>)}
            </select>
          </div>
        </label>
        <label className="field">{t("fr.servingsRequired")}
          <input type="number" min="1" step="1" value={f.servings_requested} onChange={set("servings_requested")} required />
        </label>
        <label className="field">{t("fr.priority")}
          <select value={f.priority} onChange={set("priority")}>
            {PRIORITIES.map((p) => <option key={p} value={p}>{t(`priority.${p}`)}</option>)}
          </select>
        </label>
        <label className="field span-2">{t("fr.reason")}
          <input value={f.reason} onChange={set("reason")} maxLength={255} placeholder={t("fr.reasonHint")} />
        </label>
        {error && <p className="form-error span-2" role="alert">{error}</p>}
        {ok && <p className="ok-text span-2" role="status">{ok}</p>}
        <div className="form-actions span-2">
          <button className="btn-primary" disabled={busy}>{t("fr.submit")}</button>
        </div>
      </form>

      <h2 className="section-title">{t("fr.myRequests")}</h2>
      <div className="food-table-wrapper">
        <table className="food-table">
          <thead>
            <tr>
              <th>{t("r.category")}</th>
              <th>{t("fr.requested")}</th>
              <th>{t("fr.fulfilled")}</th>
              <th>{t("fr.remaining")}</th>
              <th>{t("fr.priority")}</th>
              <th>{t("r.status")}</th>
              <th>{t("fr.date")}</th>
              <th>{t("fr.reason")}</th>
              <th>{t("r.actions")}</th>
            </tr>
          </thead>
          <tbody>
            {requests.map((r) => (
              <tr key={r.id}>
                <td>{t(`cat.${r.category}`)}</td>
                <td>{Number(r.quantity)} {t(`unit.${r.unit}`)}</td>
                <td>{Number(r.fulfilled_quantity)} {t(`unit.${r.unit}`)}</td>
                <td>{r.status === "Cancelled" ? "—" : `${Number(r.remaining_quantity)} ${t(`unit.${r.unit}`)}`}</td>
                <td><PriorityBadge priority={r.priority} /></td>
                <td><RequestStatusBadge status={r.status} /></td>
                <td>{new Date(r.created_at).toLocaleString()}</td>
                <td className="wrap-cell">{r.reason || "—"}</td>
                <td className="row-actions">
                  {["Pending", "Partially Fulfilled"].includes(r.status) && (
                    <button className="btn-small" onClick={() => cancel(r)}>{t("n.cancel")}</button>
                  )}
                </td>
              </tr>
            ))}
            {requests.length === 0 && <tr><td colSpan="9" className="empty-cell">{t("fr.none")}</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
