import { useEffect, useState } from "react";
import Modal from "./Modal";
import { api } from "../api/client";
import { useI18n } from "../i18n/I18nContext";

const FACTORS = ["proximity", "timeSafety", "capacity", "reliability"];

// Shows the SmartMatch ranking for one food item, with the reason behind every score.
export default function MatchModal({ food, onClose, onOffered }) {
  const { t } = useI18n();
  const [matches, setMatches] = useState(null);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(null);

  useEffect(() => {
    api(`/food/${food.id}/matches`).then((r) => setMatches(r.data.matches)).catch((e) => setError(e.message));
  }, [food.id]);

  const offer = async (ngoId) => {
    setError("");
    try {
      await api(`/food/${food.id}/offer`, { method: "POST", body: { ngo_id: ngoId } });
      setSent(ngoId);
      onOffered();
    } catch (e) {
      setError(e.message);
    }
  };

  const feasible = matches?.filter((m) => m.feasible) || [];
  const excluded = matches?.filter((m) => !m.feasible) || [];

  return (
    <Modal title={t("m.title", { name: food.name })} onClose={onClose}>
      <p className="muted">{t("m.intro")}</p>
      {error && <p className="form-error" role="alert">{error}</p>}
      {!matches && !error && <p>{t("common.loading")}</p>}
      {matches && feasible.length === 0 && <p className="empty">{t("m.noMatch")}</p>}

      {feasible.map((m, i) => (
        <div key={m.ngo.id} className={`match-card ${i === 0 ? "best" : ""}`}>
          <div className="match-head">
            <div>
              <strong>{m.ngo.name}</strong>
              <div className="muted small">{m.ngo.address}</div>
            </div>
            <div className="score-ring" aria-label={t("m.score")}>{Math.round(m.score)}</div>
          </div>
          <div className="match-facts">
            <span>{t("m.distance")}: <b>{t("r.km", { km: m.distanceKm })}</b></span>
            <span>{t("m.eta")}: <b>{t("m.min", { n: m.etaMinutes })}</b></span>
            <span>{t("m.left")}: <b>{t("m.min", { n: m.minutesToExpiry })}</b></span>
          </div>
          <div className="factor-bars">
            {FACTORS.map((k) => (
              <div key={k} className="factor">
                <span>{t(`m.${k}`)}</span>
                <div className="bar"><div style={{ width: `${m.breakdown[k]}%` }} /></div>
                <span className="factor-val">{m.breakdown[k]}</span>
              </div>
            ))}
          </div>
          <button className="btn-primary btn-compact" disabled={sent !== null} onClick={() => offer(m.ngo.id)}>
            {sent === m.ngo.id ? t("m.offered") : t("m.offer")}
          </button>
        </div>
      ))}

      {excluded.length > 0 && (
        <div className="excluded">
          <h4>{t("m.excluded")}</h4>
          {excluded.map((m) => (
            <div key={m.ngo.id} className="excluded-row">
              <span>{m.ngo.name}</span>
              <span className="muted small">{t(`m.reason.${m.reason}`)}</span>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
