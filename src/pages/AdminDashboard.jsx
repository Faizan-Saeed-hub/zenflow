import React, { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { api, clearSession } from "../services/api";

const tabs = [
  "Overview",
  "Users",
  "User Access",
  "Team",
  "Announcements",
  "Plans",
  "Tasks",
  "Deposits",
  "Withdrawals",
  "Loans",
  "News",
  "Support",
  "Bank"
];
const BANK_METHODS = ["JazzCash", "SadaPay", "EasyPaisa", "Binance (BEP-20)"];

export function normalizeImageUrl(url) {
  if (!url || typeof url !== "string") return "";
  const trimmed = url.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("data:image/") || trimmed.startsWith("/")) return trimmed;

  const gDriveMatch = trimmed.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) ||
                      trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (gDriveMatch && (trimmed.includes("drive.google.com") || trimmed.includes("docs.google.com"))) {
    const fileId = gDriveMatch[1];
    return `https://drive.google.com/thumbnail?id=${fileId}&sz=w1200`;
  }

  if (trimmed.includes("dropbox.com")) {
    return trimmed.replace(/[?&]dl=0/, "?raw=1").replace(/[?&]dl=1/, "?raw=1");
  }

  return trimmed;
}

export function processImageUpload(file, maxWidth = 1200, quality = 0.85) {
  return new Promise((resolve, reject) => {
    if (!file) return resolve("");
    if (!file.type || !file.type.startsWith("image/")) {
      return reject(new Error("Please select a valid image file."));
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Failed to read image file."));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error("Failed to parse image file."));
      img.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          let width = img.width;
          let height = img.height;
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, width, height);
          const outputType = file.type === "image/png" && !file.name.endsWith(".jpg") ? "image/png" : "image/jpeg";
          const dataUrl = canvas.toDataURL(outputType, quality);
          resolve(dataUrl);
        } catch (_) {
          resolve(String(e.target.result || ""));
        }
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

export function exportToCsv(filename, headers, dataRows) {
  const escapeCsv = (val) => `"${String(val ?? "").replace(/"/g, '""')}"`;
  const csvContent = [
    headers.map(escapeCsv).join(","),
    ...dataRows.map((row) => row.map(escapeCsv).join(","))
  ].join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `${filename}_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [tab, setTab] = useState("Overview");
  const [data, setData] = useState({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async (section = tab, extraParams = {}) => {
    setError("");
    try {
      if (section === "Overview") setData({ dashboard: (await api.adminDashboard()).stats });
      if (section === "Users" || section === "User Access") {
        const queryStr = new URLSearchParams(extraParams).toString();
        const res = await fetch(`/api/admin/users?${queryStr}`, {
          headers: { Authorization: `Bearer ${localStorage.getItem("zen_token") || ""}` }
        }).then((r) => r.json());
        setData({ users: res.users || [] });
      }
      if (section === "Team") setData({ team: await api.adminTeam() });
      if (section === "Announcements") setData({ announcements: (await api.adminGetAnnouncements()).announcements || [] });
      if (section === "Plans") setData({ plans: (await api.adminPlans()).plans });
      if (section === "Tasks") setData({ tasks: (await api.adminTasks()).tasks });
      if (section === "Deposits") setData({ deposits: (await api.adminDeposits(extraParams)).deposits });
      if (section === "Withdrawals") setData({ withdrawals: (await api.adminWithdrawals(extraParams)).withdrawals });
      if (section === "Loans") setData({ loans: (await api.adminLoans()).loans });
      if (section === "News") setData({ news: (await api.adminNews()).news });
      if (section === "Support") setData({ support: (await api.adminSupport()).requests });
      if (section === "Bank") setData({ bank: (await api.adminBankSettings()).settings });
    } catch (e) {
      setError(e.message);
    }
  };

  useEffect(() => {
    load(tab);
  }, [tab]);

  const logout = () => {
    clearSession();
    navigate("/admin/login", { replace: true });
  };

  const update = async (fn) => {
    setBusy(true);
    setError("");
    try {
      await fn();
      await load(tab);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="admin-page">
      <header className="admin-topbar">
        <div>
          <span>ZENFLOW</span>
          <h1>Admin Panel</h1>
        </div>
        <button onClick={logout}>Logout</button>
      </header>
      <nav className="admin-tabs">
        {tabs.map((t) => (
          <button
            key={t}
            data-admin-tab={t}
            className={tab === t ? "active" : ""}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </nav>
      {error && <div className="admin-error">{error}</div>}
      {busy && <div className="admin-busy">Saving…</div>}
      {tab === "Overview" && <Overview stats={data.dashboard} onSelectTab={setTab} />}
      {tab === "Users" && <Users rows={data.users || []} update={update} onFilter={(p) => load("Users", p)} />}
      {tab === "User Access" && <UserAccess rows={data.users || []} update={update} />}
      {tab === "Team" && <AdminTeam data={data.team} />}
      {tab === "Announcements" && <Announcements rows={data.announcements || []} update={update} />}
      {tab === "Plans" && <Plans rows={data.plans || []} update={update} />}
      {tab === "Tasks" && <Tasks rows={data.tasks || []} update={update} />}
      {tab === "Deposits" && <Deposits rows={data.deposits || []} update={update} onFilter={(p) => load("Deposits", p)} />}
      {tab === "Withdrawals" && <Withdrawals rows={data.withdrawals || []} update={update} onFilter={(p) => load("Withdrawals", p)} />}
      {tab === "Loans" && <Loans rows={data.loans || []} update={update} />}
      {tab === "News" && <News rows={data.news || []} update={update} />}
      {tab === "Support" && <Support rows={data.support || []} update={update} />}
      {tab === "Bank" && <BankSettings rows={data.bank || []} update={update} />}
    </section>
  );
}

function Overview({ stats = {}, onSelectTab }) {
  const statCards = [
    { label: "Users", val: stats.users, tab: "Users" },
    { label: "Active tasks", val: stats.tasks, tab: "Tasks" },
    { label: "Plans", val: stats.plans, tab: "Plans" },
    { label: "Approved deposits (Wallet)", val: `Rs. ${Number(stats.walletBalance || 0).toFixed(2)}`, tab: "Deposits" },
    { label: "Pending deposits", val: stats.pendingDeposits, tab: "Deposits" },
    { label: "Pending withdrawals", val: stats.pendingWithdrawals, tab: "Withdrawals" },
    { label: "Pending loans", val: stats.pendingLoans, tab: "Loans" },
    { label: "Open support", val: stats.openSupport, tab: "Support" }
  ];

  return (
    <div className="admin-overview">
      <div className="admin-overview-stats admin-grid">
        {statCards.map(({ label, val, tab }) => (
          <button
            type="button"
            className="admin-stat admin-stat-button"
            key={label}
            onClick={() => tab && onSelectTab && onSelectTab(tab)}
            title={tab ? `Go to ${tab}` : undefined}
          >
            <span>{label}</span>
            <strong>{val ?? 0}</strong>
          </button>
        ))}
      </div>
    </div>
  );
}

function Table({ children, headers }) {
  return (
    <div className="admin-table-wrap">
      <table>
        {headers && (
          <thead>
            <tr>
              {headers.map((h) => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
        )}
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

function Users({ rows, update, onFilter }) {
  const [q, setQ] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [sort, setSort] = useState("newest");

  const applyFilter = (e) => {
    e?.preventDefault();
    onFilter({ q: q.trim(), startDate, endDate, sort });
  };

  const resetFilter = () => {
    setQ("");
    setStartDate("");
    setEndDate("");
    setSort("newest");
    onFilter({});
  };

  return (
    <>
      <h2 className="admin-section-title">Users &amp; Registration Filter</h2>
      
      {/* Date & Search Filter Form */}
      <form
        onSubmit={applyFilter}
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "8px",
          alignItems: "center",
          background: "#f4f8f5",
          border: "1px solid #d7e6dc",
          borderRadius: "12px",
          padding: "12px",
          marginBottom: "16px"
        }}
      >
        <input
          type="text"
          placeholder="Search by phone, name, referral code"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{ flex: "1 1 200px", minWidth: "160px", padding: "8px 12px", borderRadius: "8px", border: "1px solid #c8dbce" }}
        />
        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
          <small style={{ fontWeight: 600 }}>From:</small>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            style={{ padding: "7px 10px", borderRadius: "8px", border: "1px solid #c8dbce" }}
          />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
          <small style={{ fontWeight: 600 }}>To:</small>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            style={{ padding: "7px 10px", borderRadius: "8px", border: "1px solid #c8dbce" }}
          />
        </div>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          style={{ padding: "8px 10px", borderRadius: "8px", border: "1px solid #c8dbce" }}
        >
          <option value="newest">Newest registered</option>
          <option value="oldest">Oldest registered</option>
          <option value="balance_desc">Highest balance</option>
          <option value="earned_desc">Highest total earned</option>
        </select>
        <button
          type="submit"
          style={{ padding: "8px 16px", borderRadius: "8px", background: "#008747", color: "#fff", border: "none", cursor: "pointer", fontWeight: 600 }}
        >
          Filter
        </button>
        <button
          type="button"
          onClick={resetFilter}
          style={{ padding: "8px 14px", borderRadius: "8px", background: "#e2ede6", color: "#254030", border: "none", cursor: "pointer" }}
        >
          Reset
        </button>
      </form>

      <Table headers={["User / Phone", "Registered Date", "Wallet", "Commission", "Team", "Actions"]}>
        {rows.map((r) => (
          <tr key={r.id}>
            <td>
              <strong>{r.full_name || "Unnamed"}</strong>
              <small>{r.phone} · ID {r.id} · Ref: {r.referral_code}</small>
            </td>
            <td>
              <small>{r.created_at ? new Date(r.created_at).toLocaleString() : "—"}</small>
            </td>
            <td>Rs. {Number(r.wallet_balance).toFixed(2)}</td>
            <td>Rs. {Number(r.commission_balance).toFixed(2)}</td>
            <td>{r.direct_members || 0} direct</td>
            <td>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                <button
                  onClick={() => {
                    const n = prompt("New wallet balance", r.wallet_balance);
                    if (n !== null) update(() => api.adminUpdateUser(r.id, { walletBalance: n }));
                  }}
                >
                  Edit balance
                </button>
                <button
                  onClick={async () => {
                    const customPin = prompt("Enter new 6-digit Fund Password PIN (or leave blank to auto-generate):");
                    if (customPin === null) return;
                    try {
                      const out = await api.adminResetFundPassword(r.id, { fundPassword: customPin.trim() || undefined });
                      window.alert(`✓ New Fund PIN for ${r.phone}: ${out.temporaryFundPassword}\nGive this 6-digit PIN to the user securely.`);
                      await update(async () => {});
                    } catch (e) {
                      window.alert(e.message);
                    }
                  }}
                  style={{ background: "#2563eb", color: "#fff" }}
                >
                  Reset Fund PIN
                </button>
                <button
                  onClick={() => {
                    if (window.confirm(`⚠️ Are you sure you want to permanently DELETE user ${r.phone} (ID: ${r.id})?\n\nThis will remove their balance, tasks, referrals, deposits, and account permanently. This cannot be undone!`)) {
                      update(() => api.adminDeleteUser(r.id));
                    }
                  }}
                  style={{ background: "#dc2626", color: "#fff" }}
                >
                  Delete user
                </button>
              </div>
            </td>
          </tr>
        ))}
      </Table>
    </>
  );
}

function UserAccess({ rows, update }) {
  const reset = async (r) => {
    try {
      const out = await api.adminResetUserPassword(r.id);
      window.alert(
        `Temporary login password for ${r.phone}: ${out.temporaryPassword}\nGive it to the user securely. They must change it after login.`
      );
      await update(async () => {});
    } catch (e) {
      window.alert(e.message);
    }
  };

  const resetFund = async (r) => {
    const customPin = prompt("Enter new 6-digit Fund Password PIN (or leave blank to auto-generate):");
    if (customPin === null) return;
    try {
      const out = await api.adminResetFundPassword(r.id, { fundPassword: customPin.trim() || undefined });
      window.alert(`✓ New Fund Password PIN for ${r.phone}: ${out.temporaryFundPassword}\nGive this 6-digit PIN to the user securely.`);
      await update(async () => {});
    } catch (e) {
      window.alert(e.message);
    }
  };

  const deleteUser = async (r) => {
    if (window.confirm(`⚠️ Permanently DELETE user ${r.phone} (ID: ${r.id})? This action cannot be undone.`)) {
      update(() => api.adminDeleteUser(r.id));
    }
  };

  return (
    <>
      <h2 className="admin-section-title">User Access &amp; Credentials</h2>
      <div className="admin-note">
        Passwords are encrypted with industry-standard bcrypt. Use the quick actions below to securely reset login passwords, reset withdrawal fund PINs, or delete user accounts.
      </div>
      <Table headers={["Login / User", "Email", "Registered", "Actions"]}>
        {rows.map((r) => (
          <tr key={r.id}>
            <td>
              <strong>{r.phone}</strong>
              <small>{r.full_name || "Unnamed"} · ID {r.id}</small>
            </td>
            <td>{r.email || "—"}</td>
            <td>{r.created_at ? new Date(r.created_at).toLocaleDateString() : "—"}</td>
            <td>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                <button onClick={() => reset(r)}>Reset Password</button>
                <button onClick={() => resetFund(r)} style={{ background: "#2563eb", color: "#fff" }}>Reset Fund PIN</button>
                <button onClick={() => deleteUser(r)} style={{ background: "#dc2626", color: "#fff" }}>Delete</button>
              </div>
            </td>
          </tr>
        ))}
      </Table>
    </>
  );
}

function AdminTeam({ data = {} }) {
  const s = data.summary || {};
  const members = data.members || [];
  const [expandedLeader, setExpandedLeader] = useState(null);

  // Group members under leaders (Level 1 direct and Level 2 indirect)
  const teamTree = useMemo(() => {
    const leaderMap = {};
    members.forEach((m) => {
      if (m.direct_members > 0) {
        leaderMap[m.id] = {
          leader: m,
          directs: members.filter((child) => child.referrer_phone === m.phone)
        };
      }
    });
    return Object.values(leaderMap);
  }, [members]);

  return (
    <>
      <h2 className="admin-section-title">Team Structure &amp; Downline Hierarchy</h2>
      <div className="admin-grid">
        <div className="admin-stat">
          <span>Total members</span>
          <strong>{s.totalMembers || 0}</strong>
        </div>
        <div className="admin-stat">
          <span>Active members</span>
          <strong>{s.activeMembers || 0}</strong>
        </div>
        <div className="admin-stat">
          <span>Members' total earnings</span>
          <strong>Rs. {Number(s.teamEarnings || 0).toLocaleString()}</strong>
        </div>
      </div>

      <div className="admin-note" style={{ marginTop: "16px" }}>
        <strong>Hierarchy View:</strong> Leaders who have invited members are listed below. Click <strong>"View Downline"</strong> to expand and inspect all users invited under that leader (e.g. Leader A &rarr; Subordinates B &rarr; C).
      </div>

      {teamTree.length > 0 && (
        <div style={{ marginBottom: "24px" }}>
          <h3 style={{ fontSize: "16px", margin: "16px 0 8px", color: "#143925" }}>Team Leaders &amp; Downline Tree</h3>
          <Table headers={["Leader (Level A)", "Leader Phone", "Direct Team Size", "Team Earnings", "Downline Tree"]}>
            {teamTree.map(({ leader, directs }) => (
              <React.Fragment key={leader.id}>
                <tr style={{ background: expandedLeader === leader.id ? "#eef8f2" : undefined }}>
                  <td>
                    <strong>{leader.full_name || "Leader"}</strong>
                    <small>ID: {leader.id}</small>
                  </td>
                  <td><strong>{leader.phone}</strong></td>
                  <td>{leader.direct_members} direct invitees</td>
                  <td>Rs. {Number(leader.total_earned || 0).toLocaleString()}</td>
                  <td>
                    <button
                      onClick={() => setExpandedLeader(expandedLeader === leader.id ? null : leader.id)}
                      style={{ background: expandedLeader === leader.id ? "#006d39" : "#008747", color: "#fff" }}
                    >
                      {expandedLeader === leader.id ? "Hide Sub-members ▲" : `View Downline (${directs.length}) ▼`}
                    </button>
                  </td>
                </tr>
                {expandedLeader === leader.id && (
                  <tr>
                    <td colSpan={5} style={{ padding: "12px 18px", background: "#f8fcf9" }}>
                      <div style={{ borderLeft: "3px solid #008747", paddingLeft: "14px" }}>
                        <strong style={{ display: "block", marginBottom: "6px", color: "#006d39" }}>
                          Direct Invites under {leader.phone} ({leader.full_name || "Leader"}):
                        </strong>
                        {directs.length ? (
                          <table style={{ width: "100%", fontSize: "12px", background: "#fff", border: "1px solid #dce8e0", borderRadius: "8px" }}>
                            <thead>
                              <tr style={{ background: "#f1f7f3" }}>
                                <th style={{ padding: "6px 10px" }}>Subordinate</th>
                                <th style={{ padding: "6px 10px" }}>Phone</th>
                                <th style={{ padding: "6px 10px" }}>Joined Date</th>
                                <th style={{ padding: "6px 10px" }}>Task Earnings</th>
                                <th style={{ padding: "6px 10px" }}>Has Sub-team?</th>
                              </tr>
                            </thead>
                            <tbody>
                              {directs.map((d) => (
                                <tr key={d.id}>
                                  <td style={{ padding: "6px 10px" }}>{d.full_name || "Member"} (ID: {d.id})</td>
                                  <td style={{ padding: "6px 10px" }}><strong>{d.phone}</strong></td>
                                  <td style={{ padding: "6px 10px" }}>{d.created_at ? new Date(d.created_at).toLocaleDateString() : "—"}</td>
                                  <td style={{ padding: "6px 10px" }}>Rs. {Number(d.task_earnings || 0).toLocaleString()}</td>
                                  <td style={{ padding: "6px 10px" }}>{d.direct_members ? `Yes (${d.direct_members} members)` : "Direct only"}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        ) : (
                          <p style={{ margin: 0, color: "#687a71" }}>No active sub-members found.</p>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </Table>
        </div>
      )}

      <h3 style={{ fontSize: "16px", margin: "18px 0 8px", color: "#143925" }}>All Registered Members</h3>
      <Table headers={["Member", "Invited By (Referrer)", "Task Earnings", "Total Earned", "Direct Team"]}>
        {members.map((r) => (
          <tr key={r.id}>
            <td>
              <strong>{r.full_name || "Member"}</strong>
              <small>{r.phone} · ID {r.id}</small>
            </td>
            <td>{r.referrer_phone || "—"}</td>
            <td>Rs. {Number(r.task_earnings || 0).toLocaleString()}</td>
            <td>Rs. {Number(r.total_earned || 0).toLocaleString()}</td>
            <td>{r.direct_members || 0}</td>
          </tr>
        ))}
      </Table>
    </>
  );
}

function Announcements({ rows, update }) {
  const [editingId, setEditingId] = useState(null);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [linkLabel, setLinkLabel] = useState("Join WhatsApp Channel");
  const [active, setActive] = useState(true);

  const startEdit = (r) => {
    setEditingId(r.id);
    setTitle(r.title || "");
    setMessage(r.message || "");
    setImageUrl(r.image_url || "");
    setLinkUrl(r.link_url || "");
    setLinkLabel(r.link_label || "Learn More");
    setActive(Boolean(r.active));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setTitle("");
    setMessage("");
    setImageUrl("");
    setLinkUrl("");
    setLinkLabel("Join WhatsApp Channel");
    setActive(true);
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await processImageUpload(file);
      setImageUrl(dataUrl);
    } catch (err) {
      alert(err.message || "Failed to process image.");
    }
  };

  const submit = async (e) => {
    e?.preventDefault();
    if (!title.trim() || !message.trim()) return alert("Title and message are required.");
    await update(async () => {
      const payload = {
        title: title.trim(),
        message: message.trim(),
        imageUrl: normalizeImageUrl(imageUrl) || null,
        linkUrl: linkUrl.trim() || null,
        linkLabel: linkLabel.trim() || "Learn More",
        active: active ? 1 : 0
      };
      if (editingId) {
        await api.adminUpdateAnnouncement(editingId, payload);
      } else {
        await api.adminCreateAnnouncement(payload);
      }
      cancelEdit();
    });
  };

  return (
    <>
      <h2 className="admin-section-title">Announcements Popup Management</h2>
      <div className="admin-note">
        Create announcements that pop up automatically for users when they open the website. Users can view the banner image, read the text, tap action links, and dismiss.
      </div>

      <form
        onSubmit={submit}
        style={{
          background: "#f7fbf9",
          border: "1px solid #d4e6dc",
          borderRadius: "14px",
          padding: "18px",
          marginBottom: "24px",
          display: "grid",
          gap: "12px"
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ margin: 0, fontSize: "16px", color: "#008747" }}>
            {editingId ? `Edit Announcement #${editingId}` : "Create New Announcement"}
          </h3>
          {editingId && (
            <button
              type="button"
              onClick={cancelEdit}
              style={{ background: "#e5e7eb", color: "#374151", padding: "4px 12px", borderRadius: "6px", border: "none", fontSize: "12px", cursor: "pointer" }}
            >
              Cancel Edit
            </button>
          )}
        </div>

        <input
          placeholder="Announcement title (e.g. Official WhatsApp Channel / System Update)"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          style={{ padding: "10px 12px", borderRadius: "8px", border: "1px solid #c9d8d0", fontSize: "14px" }}
        />
        <textarea
          placeholder="Announcement message text (supports multiline text)"
          rows={4}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          required
          style={{ padding: "10px 12px", borderRadius: "8px", border: "1px solid #c9d8d0", fontSize: "14px", resize: "vertical" }}
        />

        {/* Image Options: Upload File OR Direct URL / Google Drive */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", background: "#ffffff", padding: "12px", borderRadius: "10px", border: "1px solid #e0eae4" }}>
          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#374151", marginBottom: "4px" }}>
              Upload Image (from Device)
            </label>
            <input
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              style={{ fontSize: "12px" }}
            />
          </div>
          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#374151", marginBottom: "4px" }}>
              Or Image / Google Drive URL
            </label>
            <input
              placeholder="https://... or Google Drive share link"
              value={imageUrl}
              onChange={(e) => setImageUrl(normalizeImageUrl(e.target.value))}
              style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid #c9d8d0", fontSize: "13px" }}
            />
            <small style={{ color: "#64748b", fontSize: "11px", display: "block", marginTop: "2px" }}>
              💡 Google Drive links (e.g. drive.google.com/file/d/...) are converted automatically!
            </small>
          </div>
          {imageUrl && (
            <div style={{ gridColumn: "span 2", display: "flex", alignItems: "center", gap: "12px", marginTop: "4px" }}>
              <img src={imageUrl} alt="Announcement preview" style={{ height: "60px", maxWidth: "160px", objectFit: "cover", borderRadius: "6px", border: "1px solid #d1d5db" }} />
              <button
                type="button"
                onClick={() => setImageUrl("")}
                style={{ background: "#fee2e2", color: "#dc2626", border: "1px solid #fecaca", padding: "4px 10px", borderRadius: "6px", fontSize: "12px", cursor: "pointer" }}
              >
                Remove Image
              </button>
            </div>
          )}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
          <input
            placeholder="Action link URL (e.g. https://whatsapp.com/channel/...)"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            style={{ padding: "10px 12px", borderRadius: "8px", border: "1px solid #c9d8d0", fontSize: "14px" }}
          />
          <input
            placeholder="Button text (e.g. Join Official WhatsApp)"
            value={linkLabel}
            onChange={(e) => setLinkLabel(e.target.value)}
            style={{ padding: "10px 12px", borderRadius: "8px", border: "1px solid #c9d8d0", fontSize: "14px" }}
          />
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "4px" }}>
          <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", cursor: "pointer", fontWeight: 600 }}>
            <input
              type="checkbox"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
            />
            Active (Pop up for users)
          </label>
          <button
            type="submit"
            style={{ padding: "10px 24px", background: "#008747", color: "#fff", border: "none", borderRadius: "8px", fontWeight: 700, cursor: "pointer" }}
          >
            {editingId ? "Save Changes" : "Publish Announcement"}
          </button>
        </div>
      </form>

      <h3 style={{ fontSize: "16px", margin: "16px 0 8px" }}>All Announcements</h3>
      <Table headers={["Banner", "Title & Message", "Link / Button", "Status", "Date", "Actions"]}>
        {rows.map((r) => (
          <tr key={r.id}>
            <td style={{ width: "80px" }}>
              {r.image_url ? (
                <img src={r.image_url} alt="" style={{ width: "60px", height: "40px", objectFit: "cover", borderRadius: "4px" }} />
              ) : (
                <span style={{ color: "#9ca3af", fontSize: "11px" }}>No img</span>
              )}
            </td>
            <td>
              <strong>{r.title}</strong>
              <p style={{ margin: "4px 0 0", fontSize: "12px", color: "#45594f", maxHeight: "60px", overflow: "hidden" }}>{r.message}</p>
            </td>
            <td>
              {r.link_url ? (
                <a href={r.link_url} target="_blank" rel="noopener noreferrer" style={{ color: "#008747", fontWeight: 600 }}>
                  {r.link_label || "Link"} ↗
                </a>
              ) : (
                "—"
              )}
            </td>
            <td>
              <span style={{ padding: "3px 8px", borderRadius: "6px", fontSize: "11px", fontWeight: 700, background: r.active ? "#e6f7ee" : "#f1f3f2", color: r.active ? "#008747" : "#718379" }}>
                {r.active ? "Active" : "Inactive"}
              </span>
            </td>
            <td>
              <small>{r.created_at ? new Date(r.created_at).toLocaleDateString() : "—"}</small>
            </td>
            <td>
              <div style={{ display: "flex", gap: "6px" }}>
                <button
                  type="button"
                  onClick={() => startEdit(r)}
                  style={{ background: "#0284c7", color: "#fff", border: "none", padding: "4px 10px", borderRadius: "6px", fontSize: "12px", cursor: "pointer" }}
                >
                  Edit
                </button>
                <button onClick={() => update(() => api.adminUpdateAnnouncement(r.id, { active: !r.active }))}>
                  {r.active ? "Deactivate" : "Activate"}
                </button>
                <button
                  onClick={() => {
                    if (confirm("Delete this announcement?")) {
                      update(() => api.adminDeleteAnnouncement(r.id));
                    }
                  }}
                  style={{ background: "#c73939", color: "#fff" }}
                >
                  Delete
                </button>
              </div>
            </td>
          </tr>
        ))}
      </Table>
    </>
  );
}

function Plans({ rows, update }) {
  const [editingPlan, setEditingPlan] = useState(null);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [dailyIncome, setDailyIncome] = useState("");
  const [dailyTasks, setDailyTasks] = useState("");
  const [commissionRate, setCommissionRate] = useState("");
  const [status, setStatus] = useState("active");

  const startEdit = (p) => {
    setEditingPlan(p);
    setName(p.name || p.code);
    setPrice(String(p.price || 0));
    setDailyIncome(String(p.daily_income || 0));
    setDailyTasks(String(p.daily_tasks || 5));
    setCommissionRate(String(p.commission_rate || 0.1));
    setStatus(p.status || "active");
  };

  const savePlan = async (e) => {
    e?.preventDefault();
    if (!editingPlan) return;
    await update(async () => {
      await api.adminUpdatePlan(editingPlan.id, {
        name: name.trim(),
        price: Number(price),
        dailyIncome: Number(dailyIncome),
        dailyTasks: Number(dailyTasks),
        commissionRate: Number(commissionRate),
        status
      });
      setEditingPlan(null);
    });
  };

  return (
    <>
      <h2 className="admin-section-title">VIP &amp; Upgrade Plans Management</h2>
      <div className="admin-note">
        Customize pricing, daily review tasks, daily income rates, and lock/unlock status for all membership plans.
      </div>

      {editingPlan && (
        <form
          onSubmit={savePlan}
          style={{
            background: "#eff6ff",
            border: "1px solid #bfdbfe",
            borderRadius: "14px",
            padding: "16px",
            marginBottom: "20px",
            display: "grid",
            gap: "10px"
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h3 style={{ margin: 0, fontSize: "16px", color: "#1e40af" }}>
              Edit Plan: {editingPlan.code} ({editingPlan.name})
            </h3>
            <button
              type="button"
              onClick={() => setEditingPlan(null)}
              style={{ background: "#e5e7eb", border: "none", padding: "4px 10px", borderRadius: "6px", fontSize: "12px", cursor: "pointer" }}
            >
              Cancel
            </button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px" }}>
            <label style={{ fontSize: "12px", fontWeight: 600 }}>
              Plan Name
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #93c5fd", marginTop: "4px" }}
              />
            </label>
            <label style={{ fontSize: "12px", fontWeight: 600 }}>
              Price (Rs.)
              <input
                type="number"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #93c5fd", marginTop: "4px" }}
              />
            </label>
            <label style={{ fontSize: "12px", fontWeight: 600 }}>
              Daily Income (Rs.)
              <input
                type="number"
                value={dailyIncome}
                onChange={(e) => setDailyIncome(e.target.value)}
                style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #93c5fd", marginTop: "4px" }}
              />
            </label>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px" }}>
            <label style={{ fontSize: "12px", fontWeight: 600 }}>
              Daily Tasks Count
              <input
                type="number"
                value={dailyTasks}
                onChange={(e) => setDailyTasks(e.target.value)}
                style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #93c5fd", marginTop: "4px" }}
              />
            </label>
            <label style={{ fontSize: "12px", fontWeight: 600 }}>
              Commission Rate (e.g. 0.10 for 10%)
              <input
                type="number"
                step="0.01"
                value={commissionRate}
                onChange={(e) => setCommissionRate(e.target.value)}
                style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #93c5fd", marginTop: "4px" }}
              />
            </label>
            <label style={{ fontSize: "12px", fontWeight: 600 }}>
              Status / Visibility
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #93c5fd", marginTop: "4px", background: "#fff" }}
              >
                <option value="active">Active (Available)</option>
                <option value="coming_soon">Coming Soon (Locked)</option>
              </select>
            </label>
          </div>
          <button
            type="submit"
            style={{ padding: "10px 20px", background: "#2563eb", color: "#fff", border: "none", borderRadius: "8px", fontWeight: 700, cursor: "pointer", justifySelf: "flex-end", marginTop: "6px" }}
          >
            Save Plan Settings
          </button>
        </form>
      )}

      <Table headers={["Plan Code", "Name", "Price", "Daily Income", "Daily Tasks", "Status", "Subscribers", "Actions"]}>
        {rows.map((r) => (
          <tr key={r.id}>
            <td>
              <strong>{r.code}</strong>
            </td>
            <td>{r.name}</td>
            <td>Rs. {Number(r.price).toLocaleString()}</td>
            <td>Rs. {Number(r.daily_income).toLocaleString()}</td>
            <td>{r.daily_tasks || 5} tasks/day</td>
            <td>
              <span style={{ padding: "3px 8px", borderRadius: "6px", fontSize: "11px", fontWeight: 700, background: r.status === "active" ? "#dcfce7" : "#fef3c7", color: r.status === "active" ? "#166534" : "#92400e" }}>
                {r.status === "active" ? "Active" : "Locked / Coming Soon"}
              </span>
            </td>
            <td>{r.active_subscribers || 0}</td>
            <td>
              <div style={{ display: "flex", gap: "6px" }}>
                <button
                  type="button"
                  onClick={() => startEdit(r)}
                  style={{ background: "#2563eb", color: "#fff", border: "none", padding: "4px 10px", borderRadius: "6px", fontSize: "12px", cursor: "pointer" }}
                >
                  Edit
                </button>
                <button
                  onClick={() =>
                    update(() =>
                      api.adminUpdatePlan(r.id, {
                        status: r.status === "active" ? "coming_soon" : "active"
                      })
                    )
                  }
                >
                  {r.status === "active" ? "Lock" : "Unlock"}
                </button>
              </div>
            </td>
          </tr>
        ))}
      </Table>
    </>
  );
}

function Tasks({ rows, update }) {
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [reward, setReward] = useState("30");
  const [planRequired, setPlanRequired] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [status, setStatus] = useState("active");

  const startEdit = (t) => {
    setEditingTaskId(t.id);
    setTitle(t.title || "");
    setDescription(t.description || "");
    setReward(String(t.reward || 30));
    setPlanRequired(t.plan_required || "");
    setImageUrl(t.image_url || "");
    setStatus(t.status || "active");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const cancelEdit = () => {
    setEditingTaskId(null);
    setTitle("");
    setDescription("");
    setReward("30");
    setPlanRequired("");
    setImageUrl("");
    setStatus("active");
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await processImageUpload(file);
      setImageUrl(dataUrl);
    } catch (err) {
      alert(err.message || "Failed to process image.");
    }
  };

  const submit = async (e) => {
    e?.preventDefault();
    if (!title.trim()) return alert("Task title is required.");
    await update(async () => {
      const payload = {
        title: title.trim(),
        description: description.trim(),
        reward: Number(reward || 30),
        planRequired: planRequired || null,
        imageUrl: normalizeImageUrl(imageUrl) || null,
        status
      };
      if (editingTaskId) {
        await api.adminUpdateTask(editingTaskId, payload);
      } else {
        await api.adminCreateTask(payload);
      }
      cancelEdit();
    });
  };

  return (
    <>
      <h2 className="admin-section-title">Daily Review Tasks / Books Management</h2>
      <div className="admin-note">
        Add new book review tasks, assign plan requirements (Intern or F1–F9), upload cover images, adjust rewards, and manage task availability.
      </div>

      <form
        onSubmit={submit}
        style={{
          background: "#f8fafc",
          border: "1px solid #cbd5e1",
          borderRadius: "14px",
          padding: "18px",
          marginBottom: "24px",
          display: "grid",
          gap: "12px"
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ margin: 0, fontSize: "16px", color: "#0284c7" }}>
            {editingTaskId ? `Edit Task #${editingTaskId}` : "Add New Task"}
          </h3>
          {editingTaskId && (
            <button
              type="button"
              onClick={cancelEdit}
              style={{ background: "#e2e8f0", border: "none", padding: "4px 12px", borderRadius: "6px", fontSize: "12px", cursor: "pointer" }}
            >
              Cancel Edit
            </button>
          )}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: "10px" }}>
          <input
            placeholder="Book / Task Title (e.g. The Glass Orchard)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            style={{ padding: "10px 12px", borderRadius: "8px", border: "1px solid #94a3b8", fontSize: "14px" }}
          />
          <input
            type="number"
            step="0.01"
            placeholder="Reward (Rs.)"
            value={reward}
            onChange={(e) => setReward(e.target.value)}
            required
            style={{ padding: "10px 12px", borderRadius: "8px", border: "1px solid #94a3b8", fontSize: "14px" }}
          />
          <select
            value={planRequired}
            onChange={(e) => setPlanRequired(e.target.value)}
            style={{ padding: "10px 12px", borderRadius: "8px", border: "1px solid #94a3b8", fontSize: "14px", background: "#fff" }}
          >
            <option value="">All Users (Intern &amp; Above)</option>
            <option value="INTERN_ONLY">Only Intern (3-Day Trial Only)</option>
            <option value="INTERN_F1">Intern &amp; F1 Only</option>
            <option value="F1">F1 &amp; Above</option>
            <option value="F2">F2 &amp; Above</option>
            <option value="F3">F3 &amp; Above</option>
            <option value="F4">F4 &amp; Above</option>
            <option value="F5">F5 &amp; Above</option>
            <option value="F6">F6 &amp; Above</option>
            <option value="F7">F7 &amp; Above</option>
            <option value="F8">F8 &amp; Above</option>
            <option value="F9">F9 Only</option>
            <option value="F1_ONLY">F1 Only (Exclusive)</option>
            <option value="F2_ONLY">F2 Only (Exclusive)</option>
            <option value="F3_ONLY">F3 Only (Exclusive)</option>
          </select>
        </div>

        <textarea
          placeholder="Task passage / review reading text (this is what the user reads before rating)..."
          rows={4}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          style={{ padding: "10px 12px", borderRadius: "8px", border: "1px solid #94a3b8", fontSize: "14px", resize: "vertical" }}
        />

        {/* Cover Image Upload or URL / Google Drive */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", background: "#ffffff", padding: "12px", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#334155", marginBottom: "4px" }}>
              Upload Cover Image (File)
            </label>
            <input
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              style={{ fontSize: "12px" }}
            />
          </div>
          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#334155", marginBottom: "4px" }}>
              Or Image / Google Drive URL
            </label>
            <input
              placeholder="https://... or Google Drive share link"
              value={imageUrl}
              onChange={(e) => setImageUrl(normalizeImageUrl(e.target.value))}
              style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "13px" }}
            />
            <small style={{ color: "#64748b", fontSize: "11px", display: "block", marginTop: "2px" }}>
              💡 Google Drive links (e.g. drive.google.com/file/d/...) are converted automatically!
            </small>
          </div>
          {imageUrl && (
            <div style={{ gridColumn: "span 2", display: "flex", alignItems: "center", gap: "12px", marginTop: "4px" }}>
              <img src={imageUrl} alt="Cover preview" style={{ height: "60px", maxWidth: "60px", objectFit: "cover", borderRadius: "6px", border: "1px solid #cbd5e1" }} />
              <button
                type="button"
                onClick={() => setImageUrl("")}
                style={{ background: "#fee2e2", color: "#dc2626", border: "1px solid #fecaca", padding: "4px 10px", borderRadius: "6px", fontSize: "12px", cursor: "pointer" }}
              >
                Clear Image
              </button>
            </div>
          )}
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            style={{ padding: "8px 12px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "13px", background: "#fff" }}
          >
            <option value="active">Active (Visible)</option>
            <option value="inactive">Inactive (Disabled)</option>
          </select>
          <button
            type="submit"
            style={{ padding: "10px 24px", background: "#0284c7", color: "#fff", border: "none", borderRadius: "8px", fontWeight: 700, cursor: "pointer" }}
          >
            {editingTaskId ? "Update Task" : "Add Task to Hall"}
          </button>
        </div>
      </form>

      <Table headers={["Cover", "Book / Task", "Reward", "Plan Required", "Status", "Submissions", "Actions"]}>
        {rows.map((r) => {
          const formatPlanBadge = (code) => {
            if (!code || code === "ALL") return { label: "All Users", color: "#166534", bg: "#dcfce7" };
            if (code === "INTERN_ONLY" || code === "INTERN") return { label: "Only Intern", color: "#9a3412", bg: "#ffedd5" };
            if (code === "INTERN_F1") return { label: "Intern & F1 Only", color: "#1e40af", bg: "#dbeafe" };
            if (code === "F1_ONLY" || code === "F2_ONLY" || code === "F3_ONLY") return { label: `${code.replace("_ONLY", "")} Only`, color: "#0e7490", bg: "#cffafe" };
            return { label: `${code} & Above`, color: "#6b21a8", bg: "#f3e8ff" };
          };
          const badge = formatPlanBadge(r.plan_required);
          return (
            <tr key={r.id}>
              <td style={{ width: "60px" }}>
                {r.image_url ? (
                  <img src={r.image_url} alt="" style={{ width: "45px", height: "45px", objectFit: "cover", borderRadius: "6px" }} />
                ) : (
                  <span style={{ color: "#94a3b8", fontSize: "11px" }}>No img</span>
                )}
              </td>
              <td>
                <strong>{r.title}</strong>
                <small style={{ display: "block", color: "#64748b", marginTop: "2px", maxHeight: "40px", overflow: "hidden" }}>
                  {r.description?.slice(0, 90) || ""}
                </small>
              </td>
              <td>Rs. {Number(r.reward).toFixed(2)}</td>
              <td>
                <span style={{ padding: "3px 8px", borderRadius: "6px", fontSize: "11px", fontWeight: 700, background: badge.bg, color: badge.color }}>
                  {badge.label}
                </span>
              </td>
            <td>
              <span style={{ padding: "3px 8px", borderRadius: "6px", fontSize: "11px", fontWeight: 700, background: r.status === "active" ? "#dcfce7" : "#f1f5f9", color: r.status === "active" ? "#166534" : "#64748b" }}>
                {r.status}
              </span>
            </td>
            <td>{r.total_submissions || 0}</td>
            <td>
              <div style={{ display: "flex", gap: "6px" }}>
                <button
                  type="button"
                  onClick={() => startEdit(r)}
                  style={{ background: "#0284c7", color: "#fff", border: "none", padding: "4px 10px", borderRadius: "6px", fontSize: "12px", cursor: "pointer" }}
                >
                  Edit
                </button>
                <button
                  onClick={() =>
                    update(() =>
                      api.adminUpdateTask(r.id, {
                        status: r.status === "active" ? "inactive" : "active"
                      })
                    )
                  }
                >
                  {r.status === "active" ? "Disable" : "Enable"}
                </button>
                <button
                  onClick={() => {
                    if (confirm("Permanently delete this task?")) {
                      update(() => api.adminDeleteTask(r.id));
                    }
                  }}
                  style={{ background: "#dc2626", color: "#fff" }}
                >
                  Delete
                </button>
              </div>
            </td>
          </tr>
        );
      })}
      </Table>
    </>
  );
}

function Deposits({ rows, update, onFilter }) {
  const [q, setQ] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState("newest");

  const applyFilter = (e) => {
    e?.preventDefault();
    onFilter({ q: q.trim(), startDate, endDate, status, sort });
  };

  const resetFilter = () => {
    setQ("");
    setStartDate("");
    setEndDate("");
    setStatus("all");
    setSort("newest");
    onFilter({});
  };

  const handleExportCsv = () => {
    const headers = ["ID", "User Phone", "User Name", "Plan Code", "Amount (PKR)", "Payment Method", "TID", "Wallet Number", "Status", "Date & Time"];
    const dataRows = rows.map((r) => [
      r.id,
      r.phone,
      r.full_name || "",
      r.plan_code || "",
      r.amount,
      r.payment_method || "",
      r.tid || "",
      r.wallet_number || "",
      r.status,
      r.submitted_at ? new Date(r.submitted_at).toLocaleString() : ""
    ]);
    exportToCsv("zenflow_deposits", headers, dataRows);
  };

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", flexWrap: "wrap", gap: "10px" }}>
        <h2 className="admin-section-title" style={{ margin: 0 }}>Recharge / Deposits ({rows.length} records)</h2>
        <button
          type="button"
          onClick={handleExportCsv}
          style={{ background: "#008747", color: "#fff", border: "none", padding: "8px 16px", borderRadius: "8px", fontWeight: 600, cursor: "pointer", fontSize: "13px" }}
        >
          💾 Save / Export CSV
        </button>
      </div>

      {/* Date & Time + Search Filter Form */}
      <form
        onSubmit={applyFilter}
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "8px",
          alignItems: "center",
          background: "#f4f8f5",
          border: "1px solid #d7e6dc",
          borderRadius: "12px",
          padding: "12px",
          marginBottom: "16px"
        }}
      >
        <input
          type="text"
          placeholder="Search phone, name, TID..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{ flex: "1 1 180px", minWidth: "140px", padding: "8px 12px", borderRadius: "8px", border: "1px solid #c8dbce" }}
        />
        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
          <small style={{ fontWeight: 600 }}>From:</small>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            style={{ padding: "7px 10px", borderRadius: "8px", border: "1px solid #c8dbce" }}
          />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
          <small style={{ fontWeight: 600 }}>To:</small>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            style={{ padding: "7px 10px", borderRadius: "8px", border: "1px solid #c8dbce" }}
          />
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          style={{ padding: "8px 10px", borderRadius: "8px", border: "1px solid #c8dbce" }}
        >
          <option value="all">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          style={{ padding: "8px 10px", borderRadius: "8px", border: "1px solid #c8dbce" }}
        >
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="amount_desc">Highest amount</option>
          <option value="amount_asc">Lowest amount</option>
        </select>
        <button
          type="submit"
          style={{ padding: "8px 16px", borderRadius: "8px", background: "#008747", color: "#fff", border: "none", cursor: "pointer", fontWeight: 600 }}
        >
          Filter
        </button>
        <button
          type="button"
          onClick={resetFilter}
          style={{ padding: "8px 14px", borderRadius: "8px", background: "#e2ede6", color: "#254030", border: "none", cursor: "pointer" }}
        >
          Reset
        </button>
      </form>

      <Table headers={["User", "Plan / TID", "Amount", "Date & Time", "Proof", "Status", "Action"]}>
        {rows.map((r) => (
          <tr key={r.id}>
            <td>
              <strong>{r.full_name || r.phone}</strong>
              <small>{r.phone}</small>
            </td>
            <td>
              {r.plan_code}
              <small>{r.payment_method} · TID {r.tid}</small>
            </td>
            <td>Rs. {Number(r.amount).toLocaleString()}</td>
            <td>
              <small>{r.submitted_at ? new Date(r.submitted_at).toLocaleString() : "—"}</small>
            </td>
            <td>
              {r.proof_data ? (
                <button
                  onClick={() => {
                    const w = window.open();
                    if (w) {
                      w.document.write(`<img src="${r.proof_data}" style="max-width:100%;height:auto"/>`);
                    }
                  }}
                >
                  View proof
                </button>
              ) : (
                "—"
              )}
            </td>
            <td>
              <span
                style={{
                  padding: "3px 8px",
                  borderRadius: "6px",
                  fontSize: "11px",
                  fontWeight: 700,
                  background: r.status === "approved" ? "#dcfce7" : r.status === "pending" ? "#fef3c7" : "#fee2e2",
                  color: r.status === "approved" ? "#166534" : r.status === "pending" ? "#92400e" : "#dc2626"
                }}
              >
                {r.status}
              </span>
            </td>
            <td>
              {r.status === "pending" && (
                <div style={{ display: "flex", gap: "6px" }}>
                  <button onClick={() => update(() => api.adminUpdateDeposit(r.id, { status: "approved" }))}>
                    Approve
                  </button>
                  <button onClick={() => update(() => api.adminUpdateDeposit(r.id, { status: "rejected" }))} style={{ background: "#dc2626", color: "#fff" }}>
                    Reject
                  </button>
                </div>
              )}
            </td>
          </tr>
        ))}
      </Table>
    </>
  );
}

function Withdrawals({ rows, update, onFilter }) {
  const [q, setQ] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState("newest");

  const applyFilter = (e) => {
    e?.preventDefault();
    onFilter({ q: q.trim(), startDate, endDate, status, sort });
  };

  const resetFilter = () => {
    setQ("");
    setStartDate("");
    setEndDate("");
    setStatus("all");
    setSort("newest");
    onFilter({});
  };

  const handleExportCsv = () => {
    const headers = ["ID", "User Phone", "User Name", "Wallet Type", "Amount (PKR)", "Fee (PKR)", "Net Amount (PKR)", "Payout Method", "Account Holder", "Account Number", "Status", "Date & Time"];
    const dataRows = rows.map((r) => [
      r.id,
      r.phone,
      r.full_name || "",
      r.wallet_type || "",
      r.amount,
      r.fee || 0,
      r.net_amount || r.amount,
      r.method || "",
      r.account_name || "",
      r.account_number || "",
      r.status,
      r.requested_at ? new Date(r.requested_at).toLocaleString() : ""
    ]);
    exportToCsv("zenflow_withdrawals", headers, dataRows);
  };

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", flexWrap: "wrap", gap: "10px" }}>
        <h2 className="admin-section-title" style={{ margin: 0 }}>Withdrawals ({rows.length} records)</h2>
        <button
          type="button"
          onClick={handleExportCsv}
          style={{ background: "#008747", color: "#fff", border: "none", padding: "8px 16px", borderRadius: "8px", fontWeight: 600, cursor: "pointer", fontSize: "13px" }}
        >
          💾 Save / Export CSV
        </button>
      </div>

      {/* Date & Time + Search Filter Form */}
      <form
        onSubmit={applyFilter}
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "8px",
          alignItems: "center",
          background: "#f4f8f5",
          border: "1px solid #d7e6dc",
          borderRadius: "12px",
          padding: "12px",
          marginBottom: "16px"
        }}
      >
        <input
          type="text"
          placeholder="Search user, phone, account..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{ flex: "1 1 180px", minWidth: "140px", padding: "8px 12px", borderRadius: "8px", border: "1px solid #c8dbce" }}
        />
        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
          <small style={{ fontWeight: 600 }}>From:</small>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            style={{ padding: "7px 10px", borderRadius: "8px", border: "1px solid #c8dbce" }}
          />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
          <small style={{ fontWeight: 600 }}>To:</small>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            style={{ padding: "7px 10px", borderRadius: "8px", border: "1px solid #c8dbce" }}
          />
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          style={{ padding: "8px 10px", borderRadius: "8px", border: "1px solid #c8dbce" }}
        >
          <option value="all">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="paid">Paid</option>
          <option value="rejected">Rejected</option>
        </select>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          style={{ padding: "8px 10px", borderRadius: "8px", border: "1px solid #c8dbce" }}
        >
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="amount_desc">Highest amount</option>
          <option value="amount_asc">Lowest amount</option>
        </select>
        <button
          type="submit"
          style={{ padding: "8px 16px", borderRadius: "8px", background: "#008747", color: "#fff", border: "none", cursor: "pointer", fontWeight: 600 }}
        >
          Filter
        </button>
        <button
          type="button"
          onClick={resetFilter}
          style={{ padding: "8px 14px", borderRadius: "8px", background: "#e2ede6", color: "#254030", border: "none", cursor: "pointer" }}
        >
          Reset
        </button>
      </form>

      <Table headers={["User", "Payout Account", "Amount", "Date & Time", "Status", "Action"]}>
        {rows.map((r) => (
          <tr key={r.id}>
            <td>
              <strong>{r.full_name || r.phone}</strong>
              <small>{r.wallet_type} wallet · {r.phone}</small>
            </td>
            <td>
              {r.method || "No account"} · {r.account_number || ""}
              {r.account_name && <small style={{ display: "block", color: "#64748b" }}>{r.account_name}</small>}
            </td>
            <td>
              Rs. {Number(r.amount).toFixed(2)}
              <small>Net Rs. {Number(r.net_amount || r.amount).toFixed(2)}</small>
            </td>
            <td>
              <small>{r.requested_at ? new Date(r.requested_at).toLocaleString() : "—"}</small>
            </td>
            <td>
              <span
                style={{
                  padding: "3px 8px",
                  borderRadius: "6px",
                  fontSize: "11px",
                  fontWeight: 700,
                  background: r.status === "paid" || r.status === "approved" ? "#dcfce7" : r.status === "pending" ? "#fef3c7" : "#fee2e2",
                  color: r.status === "paid" || r.status === "approved" ? "#166534" : r.status === "pending" ? "#92400e" : "#dc2626"
                }}
              >
                {r.status}
              </span>
            </td>
            <td>
              {r.status === "pending" && (
                <div style={{ display: "flex", gap: "6px" }}>
                  <button onClick={() => update(() => api.adminUpdateWithdrawal(r.id, { status: "approved" }))}>
                    Approve
                  </button>
                  <button onClick={() => update(() => api.adminUpdateWithdrawal(r.id, { status: "rejected" }))} style={{ background: "#dc2626", color: "#fff" }}>
                    Reject
                  </button>
                </div>
              )}
            </td>
          </tr>
        ))}
      </Table>
    </>
  );
}

function Loans({ rows, update }) {
  return (
    <>
      <h2 className="admin-section-title">Loans</h2>
      <Table headers={["Loan", "Amount", "Status", "Action"]}>
        {rows.map((r) => (
          <tr key={r.id}>
            <td>
              <strong>{r.product_name}</strong>
              <small>{r.full_name || r.phone || "Unassigned"}</small>
            </td>
            <td>Rs. {Number(r.amount).toFixed(2)}</td>
            <td>{r.status}</td>
            <td>
              {r.status === "pending" && (
                <button onClick={() => update(() => api.adminUpdateLoan(r.id, { status: "approved" }))}>
                  Approve
                </button>
              )}
            </td>
          </tr>
        ))}
      </Table>
    </>
  );
}

function News({ rows, update }) {
  const [editingNewsId, setEditingNewsId] = useState(null);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("Company");
  const [summary, setSummary] = useState("");
  const [body, setBody] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [status, setStatus] = useState("published");

  const startEdit = (n) => {
    setEditingNewsId(n.id);
    setTitle(n.title || "");
    setCategory(n.category || "Company");
    setSummary(n.summary || "");
    setBody(n.body || n.summary || "");
    setImageUrl(n.image_url || "");
    setStatus(n.status || "published");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const cancelEdit = () => {
    setEditingNewsId(null);
    setTitle("");
    setCategory("Company");
    setSummary("");
    setBody("");
    setImageUrl("");
    setStatus("published");
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await processImageUpload(file);
      setImageUrl(dataUrl);
    } catch (err) {
      alert(err.message || "Failed to process image.");
    }
  };

  const submit = async (e) => {
    e?.preventDefault();
    if (!title.trim()) return alert("News title is required.");
    await update(async () => {
      const payload = {
        title: title.trim(),
        category: category.trim(),
        summary: summary.trim(),
        body: body.trim() || summary.trim(),
        imageUrl: normalizeImageUrl(imageUrl) || null,
        status
      };
      if (editingNewsId) {
        await api.adminUpdateNews(editingNewsId, payload);
      } else {
        await api.adminCreateNews(payload);
      }
      cancelEdit();
    });
  };

  return (
    <>
      <h2 className="admin-section-title">News Channel Management</h2>
      <div className="admin-note">
        Publish platform news, partner milestones, and company updates. These appear directly in the user website News Center (/news).
      </div>

      <form
        onSubmit={submit}
        style={{
          background: "#faf5ff",
          border: "1px solid #e9d5ff",
          borderRadius: "14px",
          padding: "18px",
          marginBottom: "24px",
          display: "grid",
          gap: "12px"
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ margin: 0, fontSize: "16px", color: "#7e22ce" }}>
            {editingNewsId ? `Edit News Article #${editingNewsId}` : "Publish New Article"}
          </h3>
          {editingNewsId && (
            <button
              type="button"
              onClick={cancelEdit}
              style={{ background: "#e5e7eb", border: "none", padding: "4px 12px", borderRadius: "6px", fontSize: "12px", cursor: "pointer" }}
            >
              Cancel Edit
            </button>
          )}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "3fr 1fr", gap: "10px" }}>
          <input
            placeholder="Article Headline / Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            style={{ padding: "10px 12px", borderRadius: "8px", border: "1px solid #d8b4fe", fontSize: "14px" }}
          />
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            style={{ padding: "10px 12px", borderRadius: "8px", border: "1px solid #d8b4fe", fontSize: "14px", background: "#fff" }}
          >
            <option value="Company">Company</option>
            <option value="Milestone">Milestone</option>
            <option value="Updates">Updates</option>
            <option value="Community">Community</option>
            <option value="Security">Security</option>
          </select>
        </div>

        <input
          placeholder="Short summary (shown on article card preview)"
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          style={{ padding: "10px 12px", borderRadius: "8px", border: "1px solid #d8b4fe", fontSize: "14px" }}
        />

        <textarea
          placeholder="Full article body (shown when user opens article modal)..."
          rows={5}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          style={{ padding: "10px 12px", borderRadius: "8px", border: "1px solid #d8b4fe", fontSize: "14px", resize: "vertical" }}
        />

        {/* Cover Image Upload or URL / Google Drive */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", background: "#ffffff", padding: "12px", borderRadius: "10px", border: "1px solid #f3e8ff" }}>
          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#581c87", marginBottom: "4px" }}>
              Upload Banner Image (File)
            </label>
            <input
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              style={{ fontSize: "12px" }}
            />
          </div>
          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#581c87", marginBottom: "4px" }}>
              Or Image / Google Drive URL
            </label>
            <input
              placeholder="https://... or Google Drive share link"
              value={imageUrl}
              onChange={(e) => setImageUrl(normalizeImageUrl(e.target.value))}
              style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid #d8b4fe", fontSize: "13px" }}
            />
            <small style={{ color: "#64748b", fontSize: "11px", display: "block", marginTop: "2px" }}>
              💡 Google Drive links (e.g. drive.google.com/file/d/...) are converted automatically!
            </small>
          </div>
          {imageUrl && (
            <div style={{ gridColumn: "span 2", display: "flex", alignItems: "center", gap: "12px", marginTop: "4px" }}>
              <img src={imageUrl} alt="News banner preview" style={{ height: "60px", maxWidth: "120px", objectFit: "cover", borderRadius: "6px", border: "1px solid #d8b4fe" }} />
              <button
                type="button"
                onClick={() => setImageUrl("")}
                style={{ background: "#fee2e2", color: "#dc2626", border: "1px solid #fecaca", padding: "4px 10px", borderRadius: "6px", fontSize: "12px", cursor: "pointer" }}
              >
                Clear Image
              </button>
            </div>
          )}
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            style={{ padding: "8px 12px", borderRadius: "6px", border: "1px solid #d8b4fe", fontSize: "13px", background: "#fff" }}
          >
            <option value="published">Published (Live on Website)</option>
            <option value="draft">Draft (Hidden)</option>
          </select>
          <button
            type="submit"
            style={{ padding: "10px 24px", background: "#7e22ce", color: "#fff", border: "none", borderRadius: "8px", fontWeight: 700, cursor: "pointer" }}
          >
            {editingNewsId ? "Save Article Changes" : "Publish Article to News Center"}
          </button>
        </div>
      </form>

      <Table headers={["Banner", "Title & Summary", "Category", "Status", "Date", "Actions"]}>
        {rows.map((r) => (
          <tr key={r.id}>
            <td style={{ width: "80px" }}>
              {r.image_url ? (
                <img src={r.image_url} alt="" style={{ width: "65px", height: "45px", objectFit: "cover", borderRadius: "6px" }} />
              ) : (
                <span style={{ color: "#9ca3af", fontSize: "11px" }}>No img</span>
              )}
            </td>
            <td>
              <strong>{r.title}</strong>
              <small style={{ display: "block", color: "#6b7280", marginTop: "2px", maxHeight: "36px", overflow: "hidden" }}>
                {r.summary}
              </small>
            </td>
            <td>
              <span style={{ padding: "3px 8px", borderRadius: "6px", fontSize: "11px", fontWeight: 700, background: "#f3e8ff", color: "#7e22ce" }}>
                {r.category || "News"}
              </span>
            </td>
            <td>
              <span style={{ padding: "3px 8px", borderRadius: "6px", fontSize: "11px", fontWeight: 700, background: r.status === "published" ? "#dcfce7" : "#f3f4f6", color: r.status === "published" ? "#166534" : "#4b5563" }}>
                {r.status}
              </span>
            </td>
            <td>
              <small>{r.published_at ? new Date(r.published_at).toLocaleDateString() : "Draft"}</small>
            </td>
            <td>
              <div style={{ display: "flex", gap: "6px" }}>
                <button
                  type="button"
                  onClick={() => startEdit(r)}
                  style={{ background: "#7e22ce", color: "#fff", border: "none", padding: "4px 10px", borderRadius: "6px", fontSize: "12px", cursor: "pointer" }}
                >
                  Edit
                </button>
                <button
                  onClick={() =>
                    update(() =>
                      api.adminUpdateNews(r.id, {
                        status: r.status === "published" ? "draft" : "published"
                      })
                    )
                  }
                >
                  {r.status === "published" ? "Unpublish" : "Publish"}
                </button>
                <button
                  onClick={() => {
                    if (confirm("Delete this news article?")) {
                      update(() => api.adminDeleteNews(r.id));
                    }
                  }}
                  style={{ background: "#dc2626", color: "#fff" }}
                >
                  Delete
                </button>
              </div>
            </td>
          </tr>
        ))}
      </Table>
    </>
  );
}

function BankSettings({ rows, update }) {
  const [draft, setDraft] = useState({});
  const mergedRows = BANK_METHODS.map(
    (method) =>
      rows.find((r) => r.method === method) || {
        method,
        account_label: method,
        account_number: "",
        qr_data: "",
        instructions: "",
        active: 1
      }
  );

  useEffect(() => {
    const m = {};
    mergedRows.forEach((r) => (m[r.method] = { ...r }));
    setDraft(m);
  }, [rows]);

  const change = (method, key, val) =>
    setDraft((d) => ({ ...d, [method]: { ...(d[method] || {}), [key]: val } }));

  const upload = async (method, e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      const dataUrl = await processImageUpload(f);
      change(method, "qr_data", dataUrl);
    } catch (err) {
      alert(err.message || "Failed to process QR image.");
    }
  };

  const removeQr = (method) => {
    change(method, "qr_data", "");
  };

  return (
    <>
      <h2 className="admin-section-title">Bank / Recharge Settings</h2>
      <div className="admin-note">
        Change the receiving account, upload payment QR codes, or remove QR codes used on the public Recharge page. Changes apply immediately after saving.
      </div>
      <div className="bank-settings-grid">
        {mergedRows.map((r) => {
          const d = draft[r.method] || r;
          return (
            <section className="admin-bank-card" key={r.method}>
              <div className="admin-bank-head">
                <strong>{r.method}</strong>
                <span className={Number(d.active) ? "bank-active" : "bank-off"}>
                  {Number(d.active) ? "Active" : "Hidden"}
                </span>
              </div>
              <label>
                Account label
                <input
                  value={d.account_label || ""}
                  onChange={(e) => change(r.method, "account_label", e.target.value)}
                />
              </label>
              <label>
                Account number / address
                <input
                  value={d.account_number || ""}
                  onChange={(e) => change(r.method, "account_number", e.target.value)}
                />
              </label>
              <label>
                Payment instructions
                <textarea
                  value={d.instructions || ""}
                  onChange={(e) => change(r.method, "instructions", e.target.value)}
                />
              </label>
              <label>
                Upload QR code
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(e) => upload(r.method, e)}
                />
              </label>
              {d.qr_data ? (
                <div style={{ margin: "8px 0", display: "flex", flexDirection: "column", gap: "6px" }}>
                  <img className="admin-qr-preview" src={d.qr_data} alt="QR preview" />
                  <button
                    type="button"
                    onClick={() => removeQr(r.method)}
                    style={{ background: "#fee2e2", color: "#dc2626", border: "1px solid #fecaca", padding: "6px 12px", borderRadius: "6px", fontSize: "12px", cursor: "pointer", fontWeight: 600 }}
                  >
                    ✕ Remove QR Code
                  </button>
                </div>
              ) : (
                <div style={{ color: "#9ca3af", fontSize: "12px", margin: "4px 0" }}>No QR code uploaded</div>
              )}
              <button
                onClick={() =>
                  update(() =>
                    api.adminUpdateBankSetting(r.method, {
                      accountLabel: d.account_label,
                      accountNumber: d.account_number,
                      qrData: d.qr_data || null,
                      instructions: d.instructions,
                      active: Boolean(Number(d.active))
                    })
                  )
                }
              >
                Save {r.method}
              </button>
            </section>
          );
        })}
      </div>
    </>
  );
}

function Support({ rows, update }) {
  const [replyTicket, setReplyTicket] = useState(null);
  const [replyText, setReplyText] = useState("");

  const startReply = (ticket) => {
    setReplyTicket(ticket);
    setReplyText(ticket.admin_reply || "");
  };

  const sendReply = async (e) => {
    e?.preventDefault();
    if (!replyText.trim()) return alert("Please type a reply message.");
    await update(async () => {
      await api.adminReplySupport(replyTicket.id, { reply: replyText.trim() });
      setReplyTicket(null);
      setReplyText("");
    });
  };

  return (
    <>
      <h2 className="admin-section-title">Support Inquiries &amp; User Chat</h2>
      <div className="admin-note">
        Review user inquiries submitted from the website Help &amp; Support page. You can reply directly to each inquiry, and your response will appear immediately on the user's screen.
      </div>

      {replyTicket && (
        <form
          onSubmit={sendReply}
          style={{
            background: "#ecfdf5",
            border: "1px solid #a7f3d0",
            borderRadius: "14px",
            padding: "18px",
            marginBottom: "20px",
            display: "grid",
            gap: "10px"
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h3 style={{ margin: 0, fontSize: "16px", color: "#065f46" }}>
              Reply to Ticket #{replyTicket.id} · {replyTicket.phone || "User"}
            </h3>
            <button
              type="button"
              onClick={() => setReplyTicket(null)}
              style={{ background: "#e5e7eb", border: "none", padding: "4px 10px", borderRadius: "6px", fontSize: "12px", cursor: "pointer" }}
            >
              Cancel
            </button>
          </div>
          <div style={{ background: "#ffffff", padding: "12px", borderRadius: "8px", border: "1px solid #d1fae5" }}>
            <strong style={{ fontSize: "13px", color: "#111827" }}>User Question ({replyTicket.subject}):</strong>
            <p style={{ margin: "4px 0 0", fontSize: "13px", color: "#374151", lineHeight: 1.45 }}>{replyTicket.message}</p>
          </div>
          <label style={{ fontSize: "13px", fontWeight: 700, color: "#065f46" }}>
            Admin Response Message:
            <textarea
              rows={4}
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder="Type your official answer to the user here..."
              required
              style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid #6ee7b7", fontSize: "14px", marginTop: "4px", resize: "vertical" }}
            />
          </label>
          <button
            type="submit"
            style={{ padding: "10px 24px", background: "#059669", color: "#fff", border: "none", borderRadius: "8px", fontWeight: 700, cursor: "pointer", justifySelf: "flex-end" }}
          >
            Send Reply to User
          </button>
        </form>
      )}

      <Table headers={["User", "Category & Message", "Admin Reply", "Status", "Date", "Actions"]}>
        {rows.map((r) => {
          const isAnswered = r.status === "answered" || Boolean(r.admin_reply);
          return (
            <tr key={r.id}>
              <td>
                <strong>{r.full_name || r.phone || "User"}</strong>
                <small style={{ display: "block", color: "#6b7280" }}>{r.phone}</small>
              </td>
              <td>
                <strong style={{ fontSize: "13px", color: "#111827" }}>{r.subject}</strong>
                <p style={{ margin: "4px 0 0", fontSize: "12px", color: "#4b5563", lineHeight: 1.4, maxHeight: "60px", overflow: "hidden" }}>
                  {r.message}
                </p>
              </td>
              <td>
                {r.admin_reply ? (
                  <div style={{ background: "#f0fdf4", borderLeft: "3px solid #10b981", padding: "6px 10px", borderRadius: "4px", fontSize: "12px", color: "#065f46" }}>
                    <small style={{ display: "block", color: "#047857", fontWeight: 700 }}>Admin:</small>
                    {r.admin_reply}
                  </div>
                ) : (
                  <span style={{ color: "#9ca3af", fontSize: "12px" }}>No reply yet</span>
                )}
              </td>
              <td>
                <span
                  style={{
                    padding: "3px 8px",
                    borderRadius: "6px",
                    fontSize: "11px",
                    fontWeight: 700,
                    background: isAnswered ? "#dcfce7" : "#fef3c7",
                    color: isAnswered ? "#166534" : "#92400e"
                  }}
                >
                  {isAnswered ? "Answered" : "Pending"}
                </span>
              </td>
              <td>
                <small>{r.created_at ? new Date(r.created_at).toLocaleDateString() : "—"}</small>
              </td>
              <td>
                <div style={{ display: "flex", gap: "6px" }}>
                  <button
                    type="button"
                    onClick={() => startReply(r)}
                    style={{ background: "#059669", color: "#fff", border: "none", padding: "4px 10px", borderRadius: "6px", fontSize: "12px", cursor: "pointer" }}
                  >
                    {r.admin_reply ? "Edit Reply" : "Reply"}
                  </button>
                  <button
                    onClick={() => {
                      if (confirm("Delete this inquiry?")) {
                        update(() => api.adminDeleteSupport(r.id));
                      }
                    }}
                    style={{ background: "#dc2626", color: "#fff" }}
                  >
                    Delete
                  </button>
                </div>
              </td>
            </tr>
          );
        })}
      </Table>
    </>
  );
}
