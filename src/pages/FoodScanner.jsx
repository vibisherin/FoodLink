import { useState } from "react";
import Navbar from "../components/Navbar";

// Mock AI analysis result generator
function getMockAnalysis() {
  return {
    detectedFoods: [
      { name: "Tomato", confidence: 94 },
      { name: "Potato", confidence: 91 },
      { name: "Bread", confidence: 87 },
    ],
    category: "Vegetables and Bakery",
    freshness: "Appears Fresh",
    storage: "Store vegetables in a cool environment.",
  };
}

export default function FoodScanner() {
  const [image, setImage] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setImage(file);
    setResult(null);

    // Generate a preview URL for the selected image
    const reader = new FileReader();
    reader.onload = () => setPreview(reader.result);
    reader.readAsDataURL(file);
  };

  const handleAnalyze = () => {
    if (!image) return;
    setLoading(true);
    setResult(null);

    // Simulate AI processing delay
    setTimeout(() => {
      setResult(getMockAnalysis());
      setLoading(false);
    }, 2000);
  };

  return (
    <div className="page">
      <Navbar />

      <div className="scanner-container">
        <h1>AI Food Scanner</h1>
        <p className="scanner-subtitle">
          Upload a food image to identify ingredients using AI.
        </p>

        <div className="upload-area">
          {!preview ? (
            <label className="upload-label">
              📤 Upload Food Image
              <input
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                hidden
              />
            </label>
          ) : (
            <div className="preview-wrapper">
              <img src={preview} alt="Food preview" className="preview-image" />
              <label className="upload-label-small">
                Change Image
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  hidden
                />
              </label>
            </div>
          )}
        </div>

        {preview && (
          <button className="btn-primary" onClick={handleAnalyze} disabled={loading}>
            {loading ? "Analyzing..." : "Analyze Food"}
          </button>
        )}

        {loading && <p className="analyzing-text">🔍 Analyzing image...</p>}

        {result && (
          <div className="result-box">
            <span className="demo-badge">Demo AI Analysis</span>

            <h3>Detected Food:</h3>
            <ul className="detected-list">
              {result.detectedFoods.map((food) => (
                <li key={food.name}>
                  {food.name} — <strong>{food.confidence}%</strong> confidence
                </li>
              ))}
            </ul>

            <div className="result-details">
              <p>
                <strong>Category:</strong> {result.category}
              </p>
              <p>
                <strong>Freshness Status:</strong> {result.freshness}
              </p>
              <p>
                <strong>Storage Recommendation:</strong> {result.storage}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
