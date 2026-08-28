import { useEffect } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const links = [
  ["/home", "Home", "⌂"],
  ["/tasks", "Tasks", "☷"],
  ["/plans", "Plans", "▤"],
  ["/team", "Team", "♧"],
  ["/profile", "Profile", "♙"],
];

export default function AppLayout() {
  const { user, logout, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !localStorage.getItem("zen_token")) {
      navigate("/login", { replace: true });
    }
  }, [loading, navigate]);

  const handleLogout = () => { logout(); navigate("/login", { replace: true }); };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <nav>
          {links.map(([to, label, icon]) => (
            <NavLink key={to} to={to} className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}>
              <span className="nav-icon">{icon}</span>
              <span>{label}</span>
            </NavLink>
          ))}
          <button type="button" className="nav-link nav-logout" onClick={handleLogout}>
            <span className="nav-icon">↪</span>
            <span>Logout</span>
          </button>
        </nav>
      </aside>
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}
