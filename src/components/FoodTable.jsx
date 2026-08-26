import { useFoodLink } from "../context/FoodLinkContext";

const statusColors = {
  Available: "#2e7d32",
  "Expiring Soon": "#f9a825",
  Expired: "#c62828",
  Donated: "#1565c0",
};

export default function FoodTable() {
  const { foodItems, deleteFood } = useFoodLink();

  return (
    <div className="food-table-wrapper">
      <table className="food-table">
        <thead>
          <tr>
            <th>Food Name</th>
            <th>Quantity</th>
            <th>Expiry</th>
            <th>Status</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {foodItems.map((item) => (
            <tr key={item.id}>
              <td>{item.name}</td>
              <td>{item.quantity}</td>
              <td>{item.expiryHours}h</td>
              <td>
                <span
                  className="status-badge"
                  style={{ backgroundColor: statusColors[item.status] || "#999" }}
                >
                  {item.status}
                </span>
              </td>
              <td>
                <button className="btn-small" onClick={() => deleteFood(item.id)}>
                  Remove
                </button>
              </td>
            </tr>
          ))}
          {foodItems.length === 0 && (
            <tr>
              <td colSpan="5" style={{ textAlign: "center", padding: "1rem" }}>
                No food items yet. Add some!
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
