import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import StatCard from "../components/StatCard";
import FoodTable from "../components/FoodTable";
import { useFoodLink } from "../context/FoodLinkContext";

export default function Dashboard() {
  const navigate = useNavigate();
  const { restaurantName, foodItems, addFood } = useFoodLink();

  // Local state for dashboard statistics
  const [stats, setStats] = useState({
    total: 0,
    available: 0,
    expiringSoon: 0,
    donated: 0,
  });

  // Local state for the "Add Food" form
  const [showForm, setShowForm] = useState(false);
  const [formName, setFormName] = useState("");
  const [formQuantity, setFormQuantity] = useState("");
  const [formExpiry, setFormExpiry] = useState("");

  // useEffect: recalculate stats whenever foodItems changes
  useEffect(() => {
    const total = foodItems.length;
    const available = foodItems.filter((f) => f.status === "Available").length;
    const expiringSoon = foodItems.filter((f) => f.status === "Expiring Soon").length;
    const donated = foodItems.filter((f) => f.status === "Donated").length;
    setStats({ total, available, expiringSoon, donated });
  }, [foodItems]);

  const handleAddFood = (e) => {
    e.preventDefault();
    if (!formName || !formQuantity || !formExpiry) return;

    addFood({
      name: formName,
      quantity: formQuantity,
      expiryHours: Number(formExpiry),
    });

    setFormName("");
    setFormQuantity("");
    setFormExpiry("");
    setShowForm(false);
  };

  return (
    <div className="page">
      <Navbar />

      <div className="dashboard-container">
        <div className="dashboard-header">
          <h1>{restaurantName} — Dashboard</h1>
          <div className="dashboard-actions">
            <button className="btn-primary" onClick={() => setShowForm(!showForm)}>
              + Add Food
            </button>
            <button className="btn-secondary" onClick={() => navigate("/scanner")}>
              Scan Food
            </button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="stats-grid">
          <StatCard label="Total Food Items" value={stats.total} color="#2e7d32" />
          <StatCard label="Available" value={stats.available} color="#43a047" />
          <StatCard label="Expiring Soon" value={stats.expiringSoon} color="#f9a825" />
          <StatCard label="Donated" value={stats.donated} color="#1565c0" />
        </div>

        {/* Add Food Form */}
        {showForm && (
          <form className="add-food-form" onSubmit={handleAddFood}>
            <input
              type="text"
              placeholder="Food name"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
            />
            <input
              type="text"
              placeholder="Quantity (e.g. 5 kg)"
              value={formQuantity}
              onChange={(e) => setFormQuantity(e.target.value)}
            />
            <input
              type="number"
              placeholder="Expiry in hours"
              value={formExpiry}
              onChange={(e) => setFormExpiry(e.target.value)}
            />
            <button type="submit" className="btn-primary">
              Save
            </button>
          </form>
        )}

        {/* Food Inventory Table */}
        <h2 className="section-title">Food Inventory</h2>
        <FoodTable />
      </div>
    </div>
  );
}
