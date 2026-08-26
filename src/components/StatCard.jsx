export default function StatCard({ label, value, color }) {
  return (
    <div className="stat-card" style={{ borderTop: `4px solid ${color}` }}>
      <p className="stat-value">{value}</p>
      <p className="stat-label">{label}</p>
    </div>
  );
}
