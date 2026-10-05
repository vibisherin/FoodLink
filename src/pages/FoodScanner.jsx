import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useI18n } from "../i18n/I18nContext";

// Shrinks the photo in the browser so uploads stay small and fast.
function resizeToJpeg(file, max = 1024) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = () => reject(new Error("Could not read that image."));
    img.src = url;
  });
}

export default function FoodScanner() {
  const { user } = useAuth();
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  if (user.role !== "restaurant") {
    return <div className="page"><Navbar /><p className="center-note">{t("s.restaurantsOnly")}</p></div>;
  }

  const pick = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setResult(null); setError("");
    try { setPreview(await resizeToJpeg(file)); } catch (err) { setError(err.message); }
  };

  const analyze = async () => {
    setLoading(true); setResult(null); setError("");
    try {
      const r = await api("/scanner/analyze", { method: "POST", body: { image: preview, lang } });
      setResult(r.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Hand the scan result to the dashboard form, pre-filled.
  const addToInventory = () => {
    const hours = Math.max(1, result.estimated_shelf_hours);
    navigate("/dashboard", {
      state: {
        prefill: {
          name: result.detected_foods[0]?.name || "", category: result.category, unit: "kg",
          expiry_time: new Date(Date.now() + hours * 3600 * 1000).toISOString(),
        },
      },
    });
  };

  return (
    <div className="page">
      <Navbar />
      <div className="scanner-container">
        <h1>{t("s.title")}</h1>
        <p className="scanner-subtitle">{t("s.subtitle")}</p>

        <div className="upload-area">
          {!preview ? (
            <label className="upload-label">📤 {t("s.upload")}
              <input type="file" accept="image/*" onChange={pick} hidden />
            </label>
          ) : (
            <div className="preview-wrapper">
              <img src={preview} alt="" className="preview-image" />
              <div><label className="upload-label-small">{t("s.change")}<input type="file" accept="image/*" onChange={pick} hidden /></label></div>
            </div>
          )}
        </div>

        {preview && <button className="btn-primary" onClick={analyze} disabled={loading}>{loading ? t("s.analyzing") : t("s.analyze")}</button>}
        {error && <p className="form-error" role="alert">{error}</p>}

        {result && (
          <div className="result-box">
            {!result.is_food ? <p>{t("s.notFood")}</p> : (
              <>
                <h3>{t("s.detected")}</h3>
                <ul className="detected-list">
                  {result.detected_foods.map((f) => (
                    <li key={f.name}>{f.name} — <strong>{t("s.confidence", { pct: f.confidence })}</strong></li>
                  ))}
                </ul>
                <div className="result-details">
                  <p><strong>{t("s.category")}:</strong> {t(`cat.${result.category}`)}</p>
                  <p><strong>{t("s.freshness")}:</strong> {t(`s.${result.freshness}`)}</p>
                  <p><strong>{t("s.shelf")}:</strong> {t("s.hours", { n: result.estimated_shelf_hours })}</p>
                  <p className={result.safe_to_donate ? "ok-text" : "bad-text"}>{result.safe_to_donate ? t("s.safe") : t("s.unsafe")}</p>
                  {result.storage_tip && <p><strong>{t("s.storage")}:</strong> {result.storage_tip}</p>}
                  {result.reasoning && <p><strong>{t("s.why")}:</strong> {result.reasoning}</p>}
                </div>
                {result.safe_to_donate && <button className="btn-primary" onClick={addToInventory}>{t("s.add")}</button>}
                <p className="muted small mt">{t("s.aiNote")}</p>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
