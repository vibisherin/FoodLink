import { api } from "../api/client";
import StatusBadge from "./StatusBadge";
import { useI18n } from "../i18n/I18nContext";

// Donation rows with the actions each side is allowed to take (mirrors the server rules).
const ACTIONS = {
  ngo: {
    Pending: [["Accepted", "n.accept", "btn-primary"], ["Declined", "n.decline", "btn-secondary"]],
    Accepted: [["Picked Up", "n.pickedUp", "btn-primary"], ["Cancelled", "n.cancel", "btn-secondary"]],
    "Picked Up": [["Completed", "n.complete", "btn-primary"]],
  },
  restaurant: {
    Pending: [["Cancelled", "n.cancel", "btn-secondary"]],
    Accepted: [["Cancelled", "n.cancel", "btn-secondary"]],
    "Picked Up": [["Completed", "n.complete", "btn-primary"]],
  },
};

export default function DonationList({ donations, role, onChanged, onOpen, onError }) {
  const { t, timeLeft } = useI18n();

  const move = async (id, status) => {
    try {
      await api(`/donations/${id}/status`, { method: "PATCH", body: { status } });
      onChanged();
    } catch (e) {
      onError?.(e.message);
    }
  };

  if (!donations.length) return <p className="empty">{t("r.noDonations")}</p>;

  return (
    <div className="donation-list">
      {donations.map((d) => (
        <div key={d.id} className="donation-row">
          <div className="donation-main">
            <button className="link-btn" onClick={() => onOpen("donation", d.id)}>
              {d.food_name} <span className="muted">· {d.servings} {t("r.servings").toLowerCase()}</span>
            </button>
            <div className="muted small">
              {role === "ngo" ? t("n.from", { name: d.restaurant_name }) : t("r.with", { name: d.ngo_name })}
              {d.match_score && ` · ${t("n.score", { score: Math.round(d.match_score) })}`}
              {["Pending", "Accepted", "Picked Up"].includes(d.status) && ` · ${t("n.expires", { t: timeLeft(d.expiry_time) })}`}
            </div>
          </div>
          <StatusBadge status={d.status} kind="donation" />
          <div className="donation-actions">
            {(ACTIONS[role]?.[d.status] || []).map(([status, label, cls]) => (
              <button key={status} className={`${cls} btn-compact`} onClick={() => move(d.id, status)}>{t(label)}</button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
