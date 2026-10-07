import { useEffect, useState } from "react";
import { api } from "../api/client";
import { useI18n } from "../i18n/I18nContext";

const ICON = { food: "🍲", ngo: "🤝", donation: "📦" };

// "Recently accessed" panel — items come from the recently_accessed table (per user).
export default function RecentlyAccessed({ refreshKey, onOpen }) {
  const { t } = useI18n();
  const [items, setItems] = useState([]);

  useEffect(() => {
    api("/dashboard/recent").then((r) => setItems(r.data)).catch(() => setItems([]));
  }, [refreshKey]);

  return (
    <aside className="panel recent">
      <h3>{t("recent.title")}</h3>
      {items.length === 0 ? (
        <p className="muted small">{t("recent.none")}</p>
      ) : (
        <ul>
          {items.map((i) => (
            <li key={`${i.entity_type}-${i.entity_id}`}>
              <button onClick={() => onOpen(i.entity_type, i.entity_id)}>
                <span aria-hidden="true">{ICON[i.entity_type]}</span>
                <span className="recent-title">{i.title}</span>
                <span className="muted small">{t(`recent.${i.entity_type}`)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}
