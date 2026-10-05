import { useI18n } from "../i18n/I18nContext";

const COLORS = {
  Available: "#2e7d32", "Expiring Soon": "#f9a825", Reserved: "#6a1b9a", Donated: "#1565c0", Expired: "#c62828",
  Pending: "#f9a825", Accepted: "#2e7d32", "Picked Up": "#00838f", Completed: "#1565c0", Declined: "#c62828", Cancelled: "#757575",
};

export default function StatusBadge({ status, kind = "food" }) {
  const { t } = useI18n();
  return (
    <span className="status-badge" style={{ backgroundColor: COLORS[status] || "#999" }}>
      {t(`${kind === "food" ? "status" : "dstatus"}.${status}`)}
    </span>
  );
}
