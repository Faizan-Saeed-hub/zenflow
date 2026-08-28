import { useEffect, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { api, getCachedData } from "../services/api";

const quickActions = [
  ["/zenflow-images/home-icons/invite-CVO0YD4_.png", "Invite Friends", "/referral"],
  ["/zenflow-images/home-icons/recharge-0CfxG94l.png", "Recharge", "/recharge"],
  ["/zenflow-images/home-icons/withdraw-CW5U27iq.png", "Withdraw", "/withdraw-rewards"],
  ["/zenflow-images/home-icons/wealth-BYi6Orb0.png", "Wealth Fund", "/wealth-fund"],
  ["/zenflow-images/home-icons/checkin-C7plALg_.png", "Daily Check-in", "/daily-check-in"],
  ["/zenflow-images/home-icons/news-8MOaXlE-.png", "News Center", "/news"],
  ["/zenflow-images/home-icons/loan-BUOINAkF.png", "Loan", "/loan"],
  ["/zenflow-images/home-icons/draw-DCUxEfsO.png", "Lucky Draw", "/tasks"],
];

const heroBanners = [
  "/zenflow-images/home-banners/event-community.jpg",
  "/zenflow-images/home-banners/event-malaysia.jpg",
  "/zenflow-images/home-banners/event-team-women.jpg",
  "/zenflow-images/home-banners/event-leadership.jpg",
  "/zenflow-images/home-banners/event-chamber.jpg",
];

const taskImageByTitle = {
  "Glass Orchard": "/zenflow-images/task-cards/book-letters-to-shirin.png",
  "Midnight Street": "/zenflow-images/task-cards/book-midnight-bakery.png",
  "Silent Harbor": "/zenflow-images/task-cards/book-winter-swimmers.png",
  "Winter Sparrow": "/zenflow-images/task-cards/book-clockwork-orchid.png",
  "Kite City": "/zenflow-images/task-cards/book-the-blue-hour.png",
  "Blue Hour": "/zenflow-images/task-cards/book-the-blue-hour.png",
  "Golden Orchid": "/zenflow-images/task-cards/book-clockwork-orchid.png",
};

const rankings = [
  ["+92 3****1000", "Rs. 800"],
  ["+86 13****8919", "Rs. 3,171"],
  ["+92 3****7838", "Rs. 5,542"],
  ["+86 15****6757", "Rs. 7,913"],
  ["+92 3****4421", "Rs. 9,240"],
  ["+86 18****2264", "Rs. 11,520"],
];

const partners = [
  ["Online Book Club", "/zenflow-images/partners/onlinebookclub.png"],
  ["Ghostwriting LLC", "/zenflow-images/partners/partner-ghostwriting.png"],
  ["NetGalley", "/zenflow-images/partners/netgalley.png"],
  ["Edelweiss+", "/zenflow-images/partners/partner-edelweiss.png"],
  ["Reedsy Discovery", "/zenflow-images/partners/partner-reedsy.png"],
];

const defaultTasks = [
  { id: 1, title: "Book Review", reward: 30, image_url: "/zenflow-images/task-cards/book-letters-to-shirin.png" },
  { id: 2, title: "Midnight Street", reward: 30, image_url: "/zenflow-images/task-cards/book-midnight-bakery.png" },
  { id: 3, title: "Silent Harbor", reward: 30, image_url: "/zenflow-images/task-cards/book-winter-swimmers.png" },
  { id: 4, title: "Winter Sparrow", reward: 30, image_url: "/zenflow-images/task-cards/book-clockwork-orchid.png" },
  { id: 5, title: "Kite City", reward: 30, image_url: "/zenflow-images/task-cards/book-the-blue-hour.png" },
];

export default function Home() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [heroIndex, setHeroIndex] = useState(0);
  const [taskIndex, setTaskIndex] = useState(0);
  const [stats, setStats] = useState(() => getCachedData("dashboard_stats") || null);
  const [taskCards, setTaskCards] = useState(() => (getCachedData("tasks")?.tasks || []).slice(0, 5));
  const [announcement, setAnnouncement] = useState(() => getCachedData("active_announcement") || null);
  const [showAnnouncement, setShowAnnouncement] = useState(false);

  useEffect(() => {
    api.dashboard().then(({stats: s}) => setStats(s)).catch(() => {});
    api.tasks().then(({tasks}) => {
      if (tasks && tasks.length) setTaskCards(tasks.slice(0, 5));
    }).catch(() => {});

    api.getActiveAnnouncement().then(({announcement: ann}) => {
      if (ann && ann.id) {
        setAnnouncement(ann);
        setShowAnnouncement(true);
      }
    }).catch(() => {});
  }, []);

  const dismissAnnouncement = () => {
    setShowAnnouncement(false);
  };

  const displayTasks = taskCards.length >= 5
    ? taskCards.slice(0, 5)
    : (taskCards.length > 0
        ? [...taskCards, ...defaultTasks.slice(taskCards.length)]
        : defaultTasks);

  // Automatic hero rotation.
  useEffect(() => {
    const timer = window.setInterval(() => {
      setHeroIndex(i => (i + 1) % heroBanners.length);
    }, 3000);
    return () => window.clearInterval(timer);
  }, []);

  // Automatic task-hall rotation (always rotates continuously).
  useEffect(() => {
    const timer = window.setInterval(() => {
      setTaskIndex(i => (i + 1) % displayTasks.length);
    }, 2200);
    return () => window.clearInterval(timer);
  }, [displayTasks.length]);

  return (
    <div className="home-page">
      {/* Announcement Popup Modal */}
      {showAnnouncement && announcement && (
        <div className="announcement-modal-overlay">
          <div className="announcement-modal">
            <div className="announcement-header">
              <div className="announcement-icon">📢</div>
              <h3>{announcement.title}</h3>
            </div>
            <div className="announcement-body">
              {announcement.image_url && (
                <img
                  src={announcement.image_url}
                  alt={announcement.title}
                  className="announcement-image"
                />
              )}
              <p className="announcement-text">{announcement.message}</p>
              {announcement.link_url && (
                <a
                  href={announcement.link_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="announcement-link-btn"
                >
                  {announcement.link_label || "Open Link"} ↗
                </a>
              )}
            </div>
            <div className="announcement-footer">
              <button className="announcement-ok-btn" onClick={dismissAnnouncement}>
                OK / Understood
              </button>
            </div>
          </div>
        </div>
      )}

      <header className="home-topbar">
        <div className="user-summary">
          <div className="avatar">👨🏻</div>
          <div>
            <strong>{user?.phone || "ZenFlow member"}</strong>
            <span>ID: {user?.id || "—"}</span>
          </div>
        </div>
        <button className="notification-button" aria-label="Notifications" onClick={() => navigate("/notifications")}>
          ♧<b>1</b>
        </button>
      </header>

      <div className="home-content">
        <section className="hero-card home-auto-slider">
          <img key={heroIndex} src={heroBanners[heroIndex]} alt="ZenFlow event" />
          <div className="hero-dots">
            {heroBanners.map((_, i) => (
              <button key={i} className={heroIndex === i ? "active" : ""} onClick={() => setHeroIndex(i)} aria-label={`Show banner ${i + 1}`} />
            ))}
          </div>
        </section>

        <section className="quick-actions panel">
          {quickActions.map(([icon, label, to]) => (
            <NavLink to={to} key={label} className="quick-action">
              <span className="quick-icon"><img src={icon} alt="" /></span>
              <span>{label}</span>
            </NavLink>
          ))}
        </section>

        <section className="wallet-grid">
          <NavLink to="/wallet" className="balance-card">
            <div className="balance-title"><span>▣</span> Personal wallet</div>
            <strong>Rs. {Number(stats?.personalWallet || 0).toLocaleString()}</strong>
          </NavLink>
          <NavLink to="/wallet" className="balance-card">
            <div className="balance-title blue"><span>🎁</span> Earning & commission</div>
            <strong>Rs. {Number(stats?.commissionWallet || 0).toLocaleString()}</strong>
          </NavLink>
        </section>
        <p className="available-balance">Available balance: Rs. {(Number(stats?.personalWallet || 0) + Number(stats?.commissionWallet || 0)).toLocaleString()}</p>

        <section className="task-hall panel">
          <div className="section-head">
            <strong><span>▣</span> Task Hall</strong>
            <NavLink to="/tasks">View more ›</NavLink>
          </div>
          <div className="task-hall-stage">
            {displayTasks.map((task, i) => {
              const total = displayTasks.length;
              let offset = (i - taskIndex) % total;
              if (offset > total / 2) offset -= total;
              if (offset < -total / 2) offset += total;
              if (Math.abs(offset) > 2) return null;
              return (
                <button
                  key={task.id || i}
                  className={`hall-card hall-card-${offset}`}
                  onClick={() => navigate(task.id && typeof task.id === "number" ? `/tasks/view/${task.id}` : "/tasks")}
                  style={{ zIndex: 10 - Math.abs(offset) }}
                >
                  <img
                    src={taskImageByTitle[task.title] || task.image_url || "/zenflow-images/task-cards/book-letters-to-shirin.png"}
                    alt={task.title}
                  />
                  <span>{task.title}</span>
                  <b>Rs. {Number(task.reward || 30).toLocaleString()}</b>
                </button>
              );
            })}
          </div>
          <div className="hall-dots">
            {displayTasks.map((_, i) => (
              <i
                key={i}
                className={i === (taskIndex % displayTasks.length) ? "active" : ""}
                onClick={() => setTaskIndex(i)}
                style={{ cursor: "pointer" }}
              />
            ))}
          </div>
        </section>

        <section className="rankings panel">
          <div className="section-head">
            <strong><span>🏆</span> Member Rankings</strong>
          </div>
          <div className="ranking-window">
            <div className="ranking-track">
              {[...rankings, ...rankings].map(([phone, earning], i) => (
                <div className="ranking-row" key={`${phone}-${i}`}>
                  <span className="ranking-medal">🏆</span>
                  <div><strong>Congratulations: {phone}</strong><small>Weekly income</small></div>
                  <b>{earning}</b>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="partnership">
          <h3><span></span>Partnership</h3>
          <div className="partner-grid">
            {partners.map(([name, image]) => (
              <div className="partner-card" key={name}>
                <div className="partner-logo">
                  <img src={image} alt={name} />
                </div>
                <strong>{name}</strong>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
