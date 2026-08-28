import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../services/api";

const WHATSAPP_CHANNEL = "https://whatsapp.com/channel/0029VbDc9Pj4inopcJjVrt1D";

const faqs = [
  ["How do I complete a task?", "Open Tasks, select an available review task, read the full text, rate with 1-5 stars, and click Claim Reward to receive your earnings."],
  ["How do I withdraw my earnings?", "Open Profile → Withdraw Rewards, link your JazzCash/EasyPaisa/Bank account, enter your 6-digit Fund Password, and submit your withdrawal request."],
  ["How are referral commissions calculated?", "You earn 10% on Level A, 3% on Level B, and 1% on Level C whenever team members complete tasks or subscribe to plans."],
  ["How does the 3-day Intern trial work?", "New accounts automatically receive 3 full days of free tasks (5 tasks per day at Rs. 30/task = Rs. 150/day). Afterward, you can upgrade to an F-Plan to continue."]
];

export default function HelpSupport() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(0);
  const [query, setQuery] = useState("");
  const [subject, setSubject] = useState("General Inquiry");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [error, setError] = useState("");
  const [inquiries, setInquiries] = useState([]);
  const [loadingInquiries, setLoadingInquiries] = useState(true);

  const loadInquiries = () => {
    api.getSupportInquiries()
      .then((res) => setInquiries(res?.requests || []))
      .catch(() => {})
      .finally(() => setLoadingInquiries(false));
  };

  useEffect(() => {
    loadInquiries();
  }, []);

  const filtered = faqs.filter(([q, a]) =>
    `${q} ${a}`.toLowerCase().includes(query.toLowerCase())
  );

  const handleSubmitInquiry = async (e) => {
    e.preventDefault();
    if (!message.trim()) {
      setError("Please describe your issue or inquiry.");
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      await api.createSupportInquiry({ subject, message: message.trim() });
      setMessage("");
      setSuccessMsg("✓ Your inquiry has been submitted! Our support team will review and reply here.");
      loadInquiries();
      setTimeout(() => setSuccessMsg(""), 5000);
    } catch (err) {
      setError(err.message || "Failed to submit inquiry.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="help-page">
      <div className="help-heading">
        <button className="round-back" onClick={() => navigate(-1)} aria-label="Go back">‹</button>
        <div>
          <h1>Help &amp; Support</h1>
          <p>Official community channels &amp; direct in-app support</p>
        </div>
      </div>

      {/* Official WhatsApp Channel Link Card */}
      <div className="support-options" style={{ marginBottom: "20px" }}>
        <a
          href={WHATSAPP_CHANNEL}
          target="_blank"
          rel="noopener noreferrer"
          className="support-link-card"
          style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", padding: "16px", borderRadius: "14px" }}
        >
          <span className="support-icon" style={{ background: "#25d366", color: "#fff", fontSize: "20px" }}>💬</span>
          <span>
            <strong style={{ color: "#166534" }}>Official WhatsApp Channel</strong>
            <small style={{ color: "#15803d" }}>Join for daily announcements, bonuses &amp; alerts</small>
          </span>
          <b style={{ color: "#166534" }}>Join ↗</b>
        </a>
      </div>

      {/* In-App Inquiry / Ticket Submission Box */}
      <div className="help-card" style={{ marginBottom: "20px" }}>
        <h2>Submit Support Inquiry</h2>
        <p style={{ color: "#52606d", fontSize: "13px", marginTop: "2px" }}>
          Have a question about your account, task rewards, or deposits? Send your query directly to our support team.
        </p>

        <form onSubmit={handleSubmitInquiry} style={{ marginTop: "12px", display: "flex", flexDirection: "column", gap: "10px" }}>
          <div>
            <label style={{ fontSize: "12px", fontWeight: 600, color: "#374151", marginBottom: "4px", display: "block" }}>
              Inquiry Category
            </label>
            <select
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              style={{ width: "100%", padding: "10px 12px", borderRadius: "10px", border: "1px solid #d1d5db", fontSize: "14px", background: "#fff" }}
            >
              <option value="General Inquiry">General Inquiry</option>
              <option value="Deposit & Payment">Deposit &amp; Payment</option>
              <option value="Withdrawal Issue">Withdrawal Issue</option>
              <option value="Task & Rewards">Task &amp; Rewards</option>
              <option value="Account & Security">Account &amp; Security</option>
              <option value="Team & Commission">Team &amp; Commission</option>
            </select>
          </div>

          <div>
            <label style={{ fontSize: "12px", fontWeight: 600, color: "#374151", marginBottom: "4px", display: "block" }}>
              Message / Details
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Describe your inquiry in detail so we can assist you..."
              className="support-message"
              rows={4}
              style={{ width: "100%", padding: "12px", borderRadius: "10px", border: "1px solid #d1d5db", fontSize: "14px", resize: "vertical" }}
            />
          </div>

          {error && <div style={{ color: "#dc2626", fontSize: "13px", fontWeight: 600 }}>{error}</div>}
          {successMsg && <div style={{ color: "#16a34a", fontSize: "13px", fontWeight: 600 }}>{successMsg}</div>}

          <button
            type="submit"
            className="contact-button"
            disabled={submitting}
            style={{ marginTop: "4px", cursor: submitting ? "not-allowed" : "pointer" }}
          >
            {submitting ? "Submitting Inquiry…" : "Send Inquiry to Admin"}
          </button>
        </form>
      </div>

      {/* User Inquiries & Admin Replies History */}
      <div className="faq-card" style={{ marginBottom: "20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
          <h2 style={{ margin: 0 }}>My Inquiries &amp; Admin Replies</h2>
          <button
            type="button"
            onClick={loadInquiries}
            style={{ background: "none", border: "none", color: "#008747", fontSize: "12px", fontWeight: 600, cursor: "pointer" }}
          >
            ↻ Refresh
          </button>
        </div>

        {inquiries.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {inquiries.map((inq) => {
              const isAnswered = inq.status === "answered" || Boolean(inq.admin_reply);
              return (
                <div
                  key={inq.id}
                  style={{
                    background: "#f9fafb",
                    border: "1px solid #e5e7eb",
                    borderRadius: "12px",
                    padding: "14px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "8px"
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <strong style={{ fontSize: "14px", color: "#111827" }}>{inq.subject}</strong>
                    <span
                      style={{
                        fontSize: "11px",
                        fontWeight: 700,
                        padding: "3px 8px",
                        borderRadius: "10px",
                        background: isAnswered ? "#dcfce7" : "#fef3c7",
                        color: isAnswered ? "#166534" : "#92400e"
                      }}
                    >
                      {isAnswered ? "✓ Answered" : "⏳ Pending Review"}
                    </span>
                  </div>

                  <p style={{ margin: 0, fontSize: "13px", color: "#4b5563", lineHeight: 1.45 }}>
                    {inq.message}
                  </p>
                  <small style={{ color: "#9ca3af", fontSize: "11px" }}>
                    Submitted on {inq.created_at ? new Date(inq.created_at).toLocaleString() : "Recently"}
                  </small>

                  {/* Admin Reply Display */}
                  {inq.admin_reply && (
                    <div
                      style={{
                        marginTop: "8px",
                        background: "#ecfdf5",
                        borderLeft: "3px solid #10b981",
                        borderRadius: "8px",
                        padding: "10px 12px"
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                        <span style={{ fontSize: "12px", fontWeight: 700, color: "#065f46" }}>
                          🛡️ Admin Response
                        </span>
                        <small style={{ color: "#047857", fontSize: "10px" }}>
                          {inq.replied_at ? new Date(inq.replied_at).toLocaleString() : "Just now"}
                        </small>
                      </div>
                      <p style={{ margin: 0, fontSize: "13px", color: "#064e3b", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>
                        {inq.admin_reply}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ textAlign: "center", padding: "20px 0", color: "#6b7280", fontSize: "13px" }}>
            {loadingInquiries ? "Loading your inquiries..." : "No support inquiries submitted yet."}
          </div>
        )}
      </div>

      {/* FAQ Section */}
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
    </section>
  );
}
