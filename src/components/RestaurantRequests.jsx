import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import { useI18n } from "../i18n/I18nContext";
import { PriorityBadge, RequestStatusBadge } from "./RequestBadges";

const left = (f) => Number(f.remaining_quantity ?? f.quantity);

// Restaurant side: open NGO requests (Urgent -> High -> Normal, oldest first) + "Allocate Food".
export default function RestaurantRequests({ food, onAllocated }) {
  const { t } = useI18n();
  const [selected, setSelected] = useState("");
  const [requests, setRequests] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");

  const allocatable = useMemo(
    () => food.filter((x) => ["Available", "Expiring Soon"].includes(x.status) && left(x) > 0),
    [food]);
  const item = allocatable.find((x) => String(x.id) === String(selected));
  // Re-fetch when the chosen item's remaining quantity changes (e.g. after allocation).
  const itemKey = item ? `${item.id}:${item.remaining_quantity}` : "";

  // Default to the first item that can be allocated.
  useEffect(() => {
    if (!item && allocatable.length) setSelected(String(allocatable[0].id));
    if (selected && !item && !allocatable.length) setSelected("");
  }, [allocatable, item, selected]);

  const load = useCallback(async () => {
    try {
      const q = item ? `?food_id=${item.id}` : "";
      setRequests((await api(`/requests/open${q}`)).data);
    } catch (e) {
      setError(e.message);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemKey]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const id = setInterval(load, 30000);
    return () => clearInterval(id);
  }, [load]);

  const receiving = requests.filter((r) => r.would_receive > 0);

  const allocate = async () => {
    setError(""); setOk(""); setBusy(true);
    try {
      const res = await api("/allocations", { method: "POST", body: { food_id: item.id } });
      if (!res.allocations.length) setError(res.message);
      else setOk(res.message);
      await load();
      onAllocated?.();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <h2 className="section-title">{t("fr.ngoRequests")}</h2>
      <div className="panel">
        <div className="alloc-bar">
          <label className="field">{t("fr.allocateFrom")}
            <select value={selected} onChange={(e) => { setSelected(e.target.value); setOk(""); setError(""); }}>
              {allocatable.map((x) => (
                <option key={x.id} value={x.id}>{x.name} — {left(x)} {t(`unit.${x.unit}`)} {t("fr.left")}</option>
              ))}
              {allocatable.length === 0 && <option value="">{t("fr.noFood")}</option>}
            </select>
          </label>
          <button className="btn-primary" disabled={busy || !item || receiving.length === 0} onClick={allocate}>
            {t("fr.allocate")}
          </button>
        </div>
        {item && <p className="muted small">{t("fr.matchHint", { cat: t(`cat.${item.category}`), unit: t(`unit.${item.unit}`) })}</p>}
        {error && <p className="form-error" role="alert">{error}</p>}
        {ok && <p className="ok-text" role="status">{ok}</p>}

        <div className="food-table-wrapper">
          <table className="food-table">
            <thead>
              <tr>
                <th>{t("fr.ngo")}</th>
                <th>{t("r.category")}</th>
                <th>{t("fr.requested")}</th>
                <th>{t("fr.fulfilled")}</th>
                <th>{t("fr.remaining")}</th>
                {item && <th>{t("fr.willReceive")}</th>}
                <th>{t("fr.priority")}</th>
                <th>{t("r.status")}</th>
                <th>{t("fr.date")}</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((r) => (
                <tr key={r.id} className={`req-row prio-row-${r.priority} ${item && r.can_serve === false ? "req-muted" : ""}`}>
                  <td>
                    <strong>{r.ngo_name}</strong>
                    {r.reason && <div className="muted small">{r.reason}</div>}
                    {item && r.can_serve === false && <div className="bad-text small">{t(`fr.skip.${r.skip_reason}`)}</div>}
                  </td>
                  <td>{t(`cat.${r.category}`)}</td>
                  <td>{Number(r.quantity)} {t(`unit.${r.unit}`)}</td>
                  <td>{Number(r.fulfilled_quantity)} {t(`unit.${r.unit}`)}</td>
                  <td>{Number(r.remaining_quantity)} {t(`unit.${r.unit}`)}</td>
                  {item && <td><b>{r.would_receive > 0 ? `${r.would_receive} ${t(`unit.${r.unit}`)}` : "—"}</b></td>}
                  <td><PriorityBadge priority={r.priority} /></td>
                  <td><RequestStatusBadge status={r.status} /></td>
                  <td>{new Date(r.created_at).toLocaleString()}</td>
                </tr>
              ))}
              {requests.length === 0 && <tr><td colSpan={item ? 9 : 8} className="empty-cell">{t("fr.noRequests")}</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
