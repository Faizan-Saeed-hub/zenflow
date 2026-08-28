import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, clearSession, getCachedData, getCachedUser } from "../services/api";
import { useAuth } from "../context/AuthContext";

const actions = [
  ["Edit profile", "/profile/edit", "↗"], ["Wallet & withdrawals", "/wallet", "▣"], ["Reward history", "/rewards", "◔"],
  ["Refer & earn", "/referral", "⌯"], ["Notifications", "/notifications", "♧"], ["Settings", "/settings", "⚙"], ["Help & support", "/help", "?"]
];

export default function Profile() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [user, setUser] = useState(() => getCachedUser());
  const [stats, setStats] = useState(() => getCachedData("dashboard_stats") || null);

  useEffect(() => {
    Promise.all([api.me(), api.dashboard()])
      .then(([m, d]) => {
        setUser(m.user);
        setStats(d.stats);
      })
      .catch(() => {});
  }, []);

  const handleLogout = () => {
    try {
      fetch("/api/auth/logout", {
        method: "POST",
        headers: { Authorization: `Bearer ${localStorage.getItem("zen_token") || ""}` }
      }).catch(() => {});
    } catch (_) {}
    clearSession();
    logout();
    navigate("/login", { replace: true });
  };

  const money = (v) => `Rs. ${Number(v || 0).toLocaleString()}`;
  const statRows = [
    ["Yesterday's Task Earnings", money(stats?.yesterdayTaskEarnings), "◉", "/rewards"],
    ["Today's Task Earnings", money(stats?.todayTaskEarnings), "◉", "/tasks"],
    ["Total Task Earnings", money(stats?.totalTaskEarnings), "▥", "/rewards"],
    ["This Week's Task Earnings", money(stats?.weekTaskEarnings), "▦", "/rewards"],
    ["Completed Today", stats?.completedToday || 0, "✓", "/tasks/completed"],
    ["Remaining Today", stats?.remainingToday ?? 0, "☷", "/tasks"],
    ["This Month's Task Earnings", money(stats?.monthTaskEarnings), "▦", "/rewards"],
    ["Team Task Commission", money(stats?.teamTaskCommission), "♧", "/team"],
    ["Referral Commission", money(stats?.referralCommission), "↗", "/referral"]
  ];

  return (
    <section className="profile-page">
      <div className="profile-content">
        <header className="profile-hero">
          <h1>Profile</h1>
        </header>
        <button
          className="profile-user-card"
          onClick={() => navigate("/profile/edit")}
          aria-label="Edit profile"
        >
          <img
            className="profile-avatar-image"
            src={
              user?.avatar === "female"
                ? "/zenflow-images/profile/female.png"
                : "/zenflow-images/profile/male.png"
            }
            alt="Profile"
          />
          <div className="profile-user-copy">
            <strong>{user?.phone || "Loading…"}</strong>
            <span>{user?.email || ""}</span>
            <small>Referral code {user?.referralCode || "—"}</small>
          </div>
        </button>
        <h2 className="profile-section-title">Account Overview</h2>
        <div className="profile-stats">
          {statRows.map(([label, value, icon, path]) => (
            <button className="profile-stat" key={label} onClick={() => navigate(path)}>
              <span>{label}</span>
              <div>
                <strong>{value}</strong>
                <i>{icon}</i>
              </div>
            </button>
          ))}
        </div>
        <div className="profile-actions">
          {actions.map(([label, path, icon]) => (
            <button key={label} onClick={() => navigate(path)}>
              <span className="profile-action-icon">{icon}</span>
              <span>{label}</span>
              <b>›</b>
            </button>
          ))}
        </div>
        <button
          className="profile-outline-button"
          onClick={() =>
            window.alert("Use your browser's Add to Home Screen option to install ZenFlow.")
          }
        >
          ⇩ <span>Download app</span>
        </button>
        <button className="profile-outline-button" onClick={handleLogout}>
          ⇥ <span>Log out</span>
        </button>
      </div>
    </section>
  );
}
