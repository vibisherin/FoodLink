import { useI18n } from "../i18n/I18nContext";

const PRIORITY = { Urgent: "#c62828", High: "#ef6c00", Normal: "#2e7d32" };
const STATUS = { Pending: "#f9a825", "Partially Fulfilled": "#00838f", Matched: "#6a1b9a", Fulfilled: "#1565c0", Cancelled: "#757575" };

export function PriorityBadge({ priority }) {
  const { t } = useI18n();
  return <span className={`status-badge prio prio-${priority}`} style={{ backgroundColor: PRIORITY[priority] || "#999" }}>{t(`priority.${priority}`)}</span>;
}

export function RequestStatusBadge({ status }) {
  const { t } = useI18n();
  return <span className="status-badge" style={{ backgroundColor: STATUS[status] || "#999" }}>{t(`reqstatus.${status}`)}</span>;
}
