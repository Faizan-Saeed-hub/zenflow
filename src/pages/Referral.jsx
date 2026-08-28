import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../services/api";

export default function Referral() {
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  const [data, setData] = useState({ referralCode: "", summary: { A: 0, B: 0, C: 0 }, members: [] });

  useEffect(() => {
    api.team().then(setData).catch(() => {});
  }, []);

  const code = data.referralCode || "";
  const referralLink = code ? `${window.location.origin}/create-account?ref=${encodeURIComponent(code)}` : "";
  const shareText = `Join ZenFlow and start earning daily income and task rewards! Register using my referral link:\n${referralLink}`;

  const copyLink = async () => {
    if (!referralLink) return;
    try {
      await navigator.clipboard.writeText(referralLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (_) {}
  };

  const copyCode = async () => {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (_) {}
  };

  const shareReferral = async () => {
    if (!referralLink) return;
    if (navigator.share) {
      await navigator.share({ title: "Join ZenFlow", text: shareText, url: referralLink }).catch(() => {});
    } else {
      await copyLink();
    }
  };

  const shareWhatsApp = () => {
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(shareText)}`, "_blank");
  };

  const stats = [
    ["Level A", data.summary?.A || 0, "10% commission"],
    ["Level B", data.summary?.B || 0, "3% commission"],
    ["Level C", data.summary?.C || 0, "1% commission"]
  ];

  return (
    <section className="referral-page">
      <div className="referral-heading">
        <button className="round-back" onClick={() => navigate(-1)}>‹</button>
        <div>
          <h1>Referral &amp; Earn</h1>
          <p>Invite friends and earn from your team</p>
        </div>
      </div>
      <div className="referral-hero">
        <div className="hero-symbol">↗</div>
        <div>
          <span>Invite friends</span>
          <strong>Earn more together</strong>
          <p>Share your referral link and receive team commissions on every completed task.</p>
        </div>
      </div>
      
      <div className="referral-link-card">
        <span>Your Invitation Link</span>
        <input value={referralLink} readOnly onFocus={(e) => e.target.select()} />
        <button onClick={copyLink}>{copied ? "Copied!" : "Copy Link"}</button>
      </div>

      <div className="referral-code-card">
        <div>
          <span>Referral Code</span>
          <strong>{code || "Loading…"}</strong>
        </div>
        <button onClick={copyCode}>{copied ? "Copied!" : "Copy Code"}</button>
      </div>

      <div style={{ display: "flex", gap: "8px", margin: "12px 0" }}>
        <button className="share-referral" style={{ flex: 1, margin: 0 }} onClick={shareReferral}>
          Share Link <span>↗</span>
        </button>
        <button
          className="share-referral"
          style={{ flex: 1, margin: 0, background: "#25D366", borderColor: "#128C7E" }}
          onClick={shareWhatsApp}
        >
          WhatsApp <span>💬</span>
        </button>
      </div>

      <div className="referral-stats">
        {stats.map(([label, count, commission]) => (
          <div className="referral-stat" key={label}>
            <span>{label}</span>
            <strong>{count}</strong>
            <small>{commission}</small>
          </div>
        ))}
      </div>

      <div className="referral-card">
        <h2>How referral earnings work</h2>
        <div className="earning-row">
          <span>Level A</span>
          <strong>10%</strong>
          <small>Direct team</small>
        </div>
        <div className="earning-row">
          <span>Level B</span>
          <strong>3%</strong>
          <small>Second level</small>
        </div>
        <div className="earning-row">
          <span>Level C</span>
          <strong>1%</strong>
          <small>Third level</small>
        </div>
      </div>

      <div className="referral-card">
        <h2>Your team ({data.members?.length || 0})</h2>
        {data.members?.length ? (
          <div className="referral-member-list">
            {data.members.map((m) => (
              <div className="referral-member" key={m.id}>
                <span>{m.full_name || m.phone}</span>
                <b>Level {m.level === 1 ? "A" : m.level === 2 ? "B" : "C"}</b>
              </div>
            ))}
          </div>
        ) : (
          <p className="faq-empty">No referrals yet. Share your invitation link to start building your team.</p>
        )}
      </div>
    </section>
  );
}
