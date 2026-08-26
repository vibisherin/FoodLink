import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import FoodCard from "../components/FoodCard";

export default function Home() {
  const navigate = useNavigate();

  return (
    <div className="page">
      <Navbar />

      {/* Hero Section */}
      <section className="hero">
        <h1>Reduce Food Waste. Feed Communities.</h1>
        <p className="hero-subtitle">
          FoodLink uses AI-assisted food identification and smart expiry
          monitoring to help restaurants donate surplus food to nearby NGOs
          before it goes to waste.
        </p>
        <div className="hero-buttons">
          <button className="btn-primary" onClick={() => navigate("/dashboard")}>
            Get Started
          </button>
          <button className="btn-secondary" onClick={() => navigate("/scanner")}>
            Scan Food
          </button>
        </div>
      </section>

      {/* Process Flow */}
      <section className="process-section">
        <h2>How It Works</h2>
        <div className="process-flow">
          <div className="process-step">Restaurant</div>
          <div className="process-arrow">↓</div>
          <div className="process-step">Food Scanner</div>
          <div className="process-arrow">↓</div>
          <div className="process-step">Expiry Monitoring</div>
          <div className="process-arrow">↓</div>
          <div className="process-step">Nearby NGO</div>
          <div className="process-arrow">↓</div>
          <div className="process-step">Food Donation</div>
        </div>
      </section>

      {/* Feature Cards */}
      <section className="features-section">
        <h2>Why FoodLink?</h2>
        <div className="features-grid">
          <FoodCard
            icon="📷"
            title="AI Food Scanner"
            description="Upload food images and let AI identify ingredients and estimate freshness instantly."
          />
          <FoodCard
            icon="⏱️"
            title="Smart Expiry Tracking"
            description="Automatically monitor expiry times so surplus food is used before it's too late."
          />
          <FoodCard
            icon="🤝"
            title="NGO Donation"
            description="Connect with nearby NGOs to donate surplus food quickly and easily."
          />
        </div>
      </section>

      <footer className="footer">
        <p>© 2026 FoodLink — Reducing Waste, Feeding Communities.</p>
      </footer>
    </div>
  );
}
