import { useEffect } from "react";
import { useI18n } from "../i18n/I18nContext";

export default function Modal({ title, onClose, children }) {
  const { t } = useI18n();
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="btn-small" onClick={onClose}>{t("m.close")}</button>
        </div>
        {children}
      </div>
    </div>
  );
}
