import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, getCachedData } from "../services/api";

const defaultNews = [
  {
    id: 1,
    title: "ZenFlow Platform Milestone: 100,000 Active Daily Readers",
    summary: "ZenFlow celebrates a record milestone as reader engagement and daily book review activity soar across all tiers.",
    body: "We are thrilled to announce that ZenFlow has officially crossed 100,000 active daily book reviewers! Our platform continues to deliver reliable daily income, seamless team commissions, and robust wealth fund management. Thank you to our global community for making this journey extraordinary.",
    image_url: "/zenflow-images/home-banners/event-community.jpg",
    category: "Milestone",
    published_at: new Date().toISOString()
  },
  {
    id: 2,
    title: "New High-Yield Wealth Funds & VIP Plan Upgrades Released",
    summary: "Explore higher returns and daily compounding interest with newly accredited literary review funds.",
    body: "ZenFlow has partnered with leading global publishers to bring exclusive wealth funds and VIP reward allocations. Check the Wealth and Plans tab to explore higher daily yields and enhanced commission tiers.",
    image_url: "/zenflow-images/home-banners/event-chamber.jpg",
    category: "Updates",
    published_at: new Date().toISOString()
  },
  {
    id: 3,
    title: "Official Community WhatsApp Channel Now Live",
    summary: "Join our verified official WhatsApp channel for real-time announcements, platform updates, and tips.",
    body: "Stay informed with verified news, daily bonus announcements, and community insights. Connect directly through our official WhatsApp channel: https://whatsapp.com/channel/0029VbDc9Pj4inopcJjVrt1D",
    image_url: "/zenflow-images/home-banners/event-leadership.jpg",
    category: "Community",
    published_at: new Date().toISOString()
  }
];

export default function NewsCenter() {
  const navigate = useNavigate();
  const [newsList, setNewsList] = useState(() => getCachedData("news")?.news || defaultNews);
  const [loading, setLoading] = useState(false);
  const [selectedArticle, setSelectedArticle] = useState(null);

  useEffect(() => {
    api.news()
      .then((res) => {
        if (res?.news && res.news.length > 0) {
          setNewsList(res.news);
        } else {
          setNewsList(defaultNews);
        }
      })
      .catch(() => setNewsList(defaultNews))
      .finally(() => setLoading(false));
  }, []);

  return (
    <section className="feature-page news-page">
      <header className="feature-header">
        <button className="round-back" onClick={() => navigate(-1)} aria-label="Go back">‹</button>
        <div>
          <h1>News Center</h1>
          <p>Official announcements &amp; platform updates</p>
        </div>
      </header>

      <section className="news-intro feature-card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <strong>ZENFLOW NEWS FEED</strong>
          <span style={{ fontSize: "12px", background: "#e1f5ec", color: "#008747", padding: "4px 10px", borderRadius: "12px", fontWeight: 600 }}>Live Updates</span>
        </div>
        <p style={{ marginTop: "6px", color: "#52606d", fontSize: "13px" }}>
          Stay updated with verified platform news, system releases, milestone events, and community developments.
        </p>
      </section>

      <div className="news-list">
        {newsList.map((item) => {
          const pubDate = item.published_at ? new Date(item.published_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "Recent";
          const img = item.image_url || "/zenflow-images/home-banners/event-community.jpg";

          return (
            <article className="news-card feature-card" key={item.id} style={{ display: "flex", flexDirection: "column", overflow: "hidden", padding: 0 }}>
              <div style={{ width: "100%", height: "180px", background: "#eef2f5", overflow: "hidden", position: "relative" }}>
                <img
                  src={img}
                  alt={item.title}
                  style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", transition: "transform 0.3s ease" }}
                  onError={(e) => { e.target.src = "/zenflow-images/home-banners/event-community.jpg"; }}
                />
                <span style={{ position: "absolute", top: "10px", right: "10px", background: "rgba(0, 0, 0, 0.65)", color: "#fff", padding: "4px 10px", borderRadius: "12px", fontSize: "11px", fontWeight: 600, backdropFilter: "blur(4px)" }}>
                  {item.category || "News"}
                </span>
              </div>
              <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "8px" }}>
                <small style={{ color: "#7a8794", fontSize: "11px", fontWeight: 600, textTransform: "uppercase" }}>
                  Published · {pubDate}
                </small>
                <h2 style={{ fontSize: "16px", fontWeight: 700, margin: 0, color: "#17202a", lineHeight: 1.35 }}>
                  {item.title}
                </h2>
                <p style={{ fontSize: "13px", color: "#52606d", margin: 0, lineHeight: 1.45, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                  {item.summary || item.body}
                </p>
                <button
                  type="button"
                  onClick={() => setSelectedArticle(item)}
                  style={{ alignSelf: "flex-start", marginTop: "6px", background: "#f0fdf4", color: "#008747", border: "1px solid #bbf7d0", padding: "6px 14px", borderRadius: "8px", fontWeight: 600, fontSize: "12px", cursor: "pointer" }}
                >
                  Read full article ›
                </button>
              </div>
            </article>
          );
        })}
      </div>

      {/* Full Article Reading Modal */}
      {selectedArticle && (
        <div
          className="announcement-modal-backdrop"
          onClick={() => setSelectedArticle(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.75)",
            backdropFilter: "blur(6px)",
            zIndex: 10000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "16px"
          }}
        >
          <div
            className="announcement-modal-card"
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#ffffff",
              borderRadius: "20px",
              maxWidth: "540px",
              width: "100%",
              maxHeight: "90vh",
              overflowY: "auto",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.35)",
              border: "1px solid rgba(255, 255, 255, 0.3)",
              animation: "modalZoomIn 0.25s cubic-bezier(0.16, 1, 0.3, 1)"
            }}
          >
            {selectedArticle.image_url && (
              <div style={{ width: "100%", maxHeight: "240px", overflow: "hidden", borderTopLeftRadius: "20px", borderTopRightRadius: "20px" }}>
                <img
                  src={selectedArticle.image_url}
                  alt={selectedArticle.title}
                  style={{ width: "100%", height: "240px", objectFit: "cover", display: "block" }}
                  onError={(e) => { e.target.style.display = "none"; }}
                />
              </div>
            )}
            <div style={{ padding: "22px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                <span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", background: "#e8f5e9", color: "#2e7d32", padding: "4px 10px", borderRadius: "10px" }}>
                  {selectedArticle.category || "ZenFlow News"}
                </span>
                <small style={{ color: "#6c757d", fontSize: "12px" }}>
                  {selectedArticle.published_at ? new Date(selectedArticle.published_at).toLocaleDateString() : ""}
                </small>
              </div>
              <h2 style={{ fontSize: "19px", fontWeight: 800, color: "#1a1a1a", lineHeight: 1.35, margin: "0 0 12px" }}>
                {selectedArticle.title}
              </h2>
              {selectedArticle.summary && (
                <p style={{ fontSize: "14px", fontWeight: 600, color: "#2b533d", margin: "0 0 14px", lineHeight: 1.5, background: "#f5fbf7", padding: "10px 14px", borderRadius: "10px", borderLeft: "3px solid #008747" }}>
                  {selectedArticle.summary}
                </p>
              )}
              <div style={{ fontSize: "14px", color: "#374151", lineHeight: 1.65, whiteSpace: "pre-wrap" }}>
                {selectedArticle.body || selectedArticle.summary}
              </div>
              <button
                type="button"
                onClick={() => setSelectedArticle(null)}
                style={{
                  width: "100%",
                  marginTop: "20px",
                  padding: "12px",
                  borderRadius: "12px",
                  background: "#008747",
                  color: "#ffffff",
                  border: "none",
                  fontWeight: 700,
                  fontSize: "14px",
                  cursor: "pointer"
                }}
              >
                Close Article
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
