import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../services/api";

const faqs = [
  ["How do I complete a task?", "Open Task Hall, choose an available task, read the requirements, and submit your review before the task deadline."],
  ["How do I withdraw my earnings?", "Open Wallet & Withdrawal, add a supported payout account, create your fund password, and submit a withdrawal request."],
  ["How are referral commissions calculated?", "Eligible team activity can generate commissions according to the Level A, B and C rates shown in Plans and Referral & Earn."],
  ["Why can't I access a task?", "Some tasks require an active plan or may have reached their daily limit. Check Plans and Task Hall for your current eligibility."],
];

export default function HelpSupport() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(0);
  const [query, setQuery] = useState("");
  const [sent, setSent] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const filtered = faqs.filter(([q, a]) =>
    `${q} ${a}`.toLowerCase().includes(query.toLowerCase())
  );

  const contact = async () => {
    const value = message.trim();
    if (value) {
      try {
        await api.submitSupport({ subject: "Support request", message: value });
        setMessage("");
        setError("");
        setSent(true);
        setTimeout(() => setSent(false), 2000);
      } catch (e) {
        setError(e.message);
      }
    }
    window.open("https://t.me/faizdex", "_blank", "noopener,noreferrer");
  };

  return (
    <section className="help-page">
      <div className="help-heading">
        <button className="round-back" onClick={() => navigate(-1)} aria-label="Go back">‹</button>
        <div>
          <h1>Help &amp; Support</h1>
          <p>Find answers or contact our support team</p>
        </div>
      </div>

      <div className="help-search">
        <span>⌕</span>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search help"
          aria-label="Search help"
        />
      </div>

      <div className="support-options">
        <a
          href="https://t.me/faizdex"
          target="_blank"
          rel="noopener noreferrer"
          className="support-link-card"
        >
          <span className="support-icon">✈</span>
          <span>
            <strong>Contact Support (Telegram)</strong>
            <small>Direct message: t.me/faizdex</small>
          </span>
          <b>›</b>
        </a>
        <button type="button" onClick={() => navigate("/notifications")}>
          <span className="support-icon">i</span>
          <span><strong>Notifications</strong><small>Check your latest system updates</small></span>
          <b>›</b>
        </button>
        {error && <small className="support-error">{error}</small>}
      </div>

      <div className="faq-card">
        <h2>Frequently Asked Questions</h2>
        {filtered.length ? filtered.map(([question, answer], index) => {
          const isOpen = open === index;
          return (
            <div className="faq-item" key={question}>
              <button className="faq-question" onClick={() => setOpen(isOpen ? -1 : index)}>
                <span>{question}</span>
                <b>{isOpen ? "−" : "+"}</b>
              </button>
              {isOpen && <p>{answer}</p>}
            </div>
          );
        }) : (
          <div className="faq-empty">No matching help articles found.</div>
        )}
      </div>

      <div className="help-card">
        <h2>Need more help?</h2>
        <p>Send a support message or connect directly with our support team on Telegram (<strong>t.me/faizdex</strong>).</p>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Describe your issue (optional)"
          className="support-message"
        />
        <button className="contact-button" onClick={contact}>
          {sent ? "Message sent! Opening Telegram…" : "Contact support on Telegram"} <span>↗</span>
        </button>
        {error && <small className="support-error">{error}</small>}
      </div>
    </section>
  );
}
