import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import RestaurantDashboard from "./RestaurantDashboard";
import NgoDashboard from "./NgoDashboard";

// /dashboard shows the right workspace for the signed-in role.
export default function Dashboard() {
  const { user } = useAuth();
  if (user.role === "admin") return <Navigate to="/admin" replace />;
  return user.role === "ngo" ? <NgoDashboard /> : <RestaurantDashboard />;
}
