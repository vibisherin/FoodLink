import { useNavigate, useLocation } from "react-router-dom";

export default function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();

  const links = [
    { label: "Home", path: "/" },
    { label: "Dashboard", path: "/dashboard" },
    { label: "Food Scanner", path: "/scanner" },
  ];

  return (
    <header className="navbar">
      <div className="navbar-logo" onClick={() => navigate("/")}>
        🌿 FoodLink
      </div>
      <nav className="navbar-links">
        {links.map((link) => (
          <button
            key={link.path}
            className={`nav-link ${location.pathname === link.path ? "active" : ""}`}
            onClick={() => navigate(link.path)}
          >
            {link.label}
          </button>
        ))}
      </nav>
    </header>
  );
}
