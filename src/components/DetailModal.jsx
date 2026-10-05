import { useEffect, useState } from "react";
import Modal from "./Modal";
import StatusBadge from "./StatusBadge";
import { api } from "../api/client";
import { useI18n } from "../i18n/I18nContext";

const PATH = { food: "food", ngo: "ngos", donation: "donations" };

// Opens one food item / NGO / donation. Fetching it is what records it in "recently accessed".
export default function DetailModal({ type, id, onClose, onViewed }) {
  const { t, timeLeft } = useI18n();
  const [d, setD] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api(`/${PATH[type]}/${id}`)
      .then((r) => { setD(r.data); onViewed?.(); })
      .catch((e) => setError(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, id]);

  const row = (label, value) => value !== null && value !== undefined && value !== "" && (
    <div className="detail-row"><span className="muted">{label}</span><span>{value}</span></div>
  );

  return (
    <Modal title={d?.name || d?.food_name || t(`recent.${type}`)} onClose={onClose}>
      {error && <p className="form-error">{error}</p>}
      {!d && !error && <p>{t("common.loading")}</p>}
      {d && type === "food" && (
        <>
          {row(t("r.status"), <StatusBadge status={d.status} />)}
          {row(t("r.category"), t(`cat.${d.category}`))}
          {row(t("r.quantity"), `${d.quantity} ${t(`unit.${d.unit}`)}`)}
          {row(t("r.servings"), d.servings)}
          {row(t("r.expiresIn"), timeLeft(d.expiry_time))}
          {row(t("a.restaurant"), d.restaurant_name)}
          {row(t("r.notes"), d.notes)}
          {d.donations?.length > 0 && (
            <>
              <h4>{t("r.donations")}</h4>
              {d.donations.map((x) => (
                <div key={x.id} className="detail-row"><span>{x.ngo_name}</span><StatusBadge status={x.status} kind="donation" /></div>
              ))}
            </>
          )}
        </>
      )}
      {d && type === "ngo" && (
        <>
          {row(t("p.address"), [d.address, d.city].filter(Boolean).join(", "))}
          {row(t("p.capacity"), d.daily_capacity_meals)}
          {row(t("n.capacity"), t("n.of", { used: d.committed_today, total: d.daily_capacity_meals }))}
          {row(t("p.radius"), d.max_radius_km)}
          {row(t("p.categories"), d.accepted_categories.split(",").map((c) => t(`cat.${c}`)).join(", "))}
          {row(t("p.vehicle"), d.has_vehicle ? "✓" : "—")}
          {row(t("m.reliability"), `${d.reliability}%`)}
          {row(t("n.completed"), d.completed)}
          {row(t("r.meals"), d.meals)}
        </>
      )}
      {d && type === "donation" && (
        <>
          {row(t("r.status"), <StatusBadge status={d.status} kind="donation" />)}
          {row(t("a.restaurant"), d.restaurant_name)}
          {row(t("a.ngo"), d.ngo_name)}
          {row(t("r.servings"), d.servings)}
          {row(t("m.score"), d.match_score && `${Math.round(d.match_score)}`)}
          {row(t("r.expiresIn"), timeLeft(d.expiry_time))}
        </>
      )}
    </Modal>
  );
}
