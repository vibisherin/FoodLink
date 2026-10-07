import { useI18n } from "../i18n/I18nContext";
import StatusBadge from "./StatusBadge";

export default function FoodTable({ items, onOpen, onMatch, onEdit, onRemove }) {
  const { t, timeLeft } = useI18n();

  return (
    <div className="food-table-wrapper">
      <table className="food-table">
        <thead>
          <tr>
            <th>{t("r.food")}</th>
            <th>{t("r.category")}</th>
            <th>{t("r.quantity")}</th>
            <th>{t("r.servings")}</th>
            <th>{t("r.expiresIn")}</th>
            <th>{t("r.status")}</th>
            <th>{t("r.actions")}</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const open = ["Available", "Expiring Soon"].includes(item.status);
            return (
              <tr key={item.id}>
                <td><button className="link-btn" onClick={() => onOpen("food", item.id)}>{item.name}</button></td>
                <td>{t(`cat.${item.category}`)}</td>
                <td>
                  {item.remaining_quantity != null && Number(item.remaining_quantity) < Number(item.quantity)
                    ? `${Number(item.remaining_quantity)} / ${Number(item.quantity)}`
                    : Number(item.quantity)} {t(`unit.${item.unit}`)}
                </td>
                <td>{item.servings}</td>
                <td>{["Donated", "Expired"].includes(item.status) ? "—" : timeLeft(item.expiry_time)}</td>
                <td>
                  <StatusBadge status={item.status} />
                  {item.active_ngo_name && <div className="muted small">{t("r.with", { name: item.active_ngo_name })}</div>}
                </td>
                <td className="row-actions">
                  {open && <button className="btn-small btn-accent" onClick={() => onMatch(item)}>{t("r.findNgo")}</button>}
                  {open && <button className="btn-small" onClick={() => onEdit(item)}>{t("r.edit")}</button>}
                  {!item.active_donation_id && <button className="btn-small" onClick={() => onRemove(item)}>{t("r.remove")}</button>}
                </td>
              </tr>
            );
          })}
          {items.length === 0 && (
            <tr><td colSpan="7" className="empty-cell">{t("r.noFood")}</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
