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
      if (section === "Deposits") setData({ deposits: (await api.adminDeposits()).deposits });
      if (section === "Withdrawals") setData({ withdrawals: (await api.adminWithdrawals()).withdrawals });
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
      {tab === "Deposits" && <Deposits rows={data.deposits || []} update={update} />}
      {tab === "Withdrawals" && <Withdrawals rows={data.withdrawals || []} update={update} />}
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
    { label: "Wallet balance", val: `Rs. ${Number(stats.walletBalance || 0).toFixed(2)}`, tab: "Users" },
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
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [linkLabel, setLinkLabel] = useState("Join Telegram Channel");
  const [active, setActive] = useState(true);

  const submit = async (e) => {
    e?.preventDefault();
    if (!title.trim() || !message.trim()) return alert("Title and message are required.");
    await update(async () => {
      await api.adminCreateAnnouncement({
        title: title.trim(),
        message: message.trim(),
        imageUrl: imageUrl.trim() || null,
        linkUrl: linkUrl.trim() || null,
        linkLabel: linkLabel.trim() || "Learn More",
        active: active ? 1 : 0
      });
      setTitle("");
      setMessage("");
      setImageUrl("");
      setLinkUrl("");
    });
  };

  return (
    <>
      <h2 className="admin-section-title">Announcements Popup Management</h2>
      <div className="admin-note">
        Create announcements that will pop up automatically for users when they open the website. Users can read the message, click links, and tap "OK / Understood" to enter the app.
      </div>

      <form
        onSubmit={submit}
        style={{
          background: "#f7fbf9",
          border: "1px solid #d4e6dc",
          borderRadius: "14px",
          padding: "16px",
          marginBottom: "20px",
          display: "grid",
          gap: "10px"
        }}
      >
        <h3 style={{ margin: "0 0 6px", fontSize: "15px" }}>Create New Announcement</h3>
        <input
          placeholder="Announcement title (e.g. Official Update / Telegram Group)"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />
        <textarea
          placeholder="Announcement message text (supports multiline text)"
          rows={4}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          required
        />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
          <input
            placeholder="Image URL (optional, e.g. https://...)"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
          />
          <input
            placeholder="Action link URL (e.g. https://t.me/faizdex)"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
          />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: "10px", alignItems: "center" }}>
          <input
            placeholder="Button text (e.g. Join Telegram Channel)"
            value={linkLabel}
            onChange={(e) => setLinkLabel(e.target.value)}
          />
          <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
            />
            Active
          </label>
          <button
            type="submit"
            style={{ padding: "10px 20px", background: "#008747", color: "#fff", border: "none", borderRadius: "8px", fontWeight: 700, cursor: "pointer" }}
          >
            Publish Announcement
          </button>
        </div>
      </form>

      <h3 style={{ fontSize: "16px", margin: "16px 0 8px" }}>Published Announcements</h3>
      <Table headers={["Title & Message", "Link / Button", "Status", "Date", "Actions"]}>
        {rows.map((r) => (
          <tr key={r.id}>
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
  return (
    <>
      <h2 className="admin-section-title">Plans</h2>
      <Table headers={["Plan", "Price", "Daily income", "Status", "Action"]}>
        {rows.map((r) => (
          <tr key={r.id}>
            <td>
              <strong>{r.name}</strong>
              <small>{r.code}</small>
            </td>
            <td>Rs. {Number(r.price).toFixed(2)}</td>
            <td>Rs. {Number(r.daily_income).toFixed(2)}</td>
            <td>{r.status}</td>
            <td>
              <button
                onClick={() =>
                  update(() =>
                    api.adminUpdatePlan(r.id, {
                      status: r.status === "active" ? "coming_soon" : "active"
                    })
                  )
                }
              >
                {r.status === "active" ? "Disable" : "Enable"}
              </button>
            </td>
          </tr>
        ))}
      </Table>
    </>
  );
}

function Tasks({ rows, update }) {
  return (
    <>
      <h2 className="admin-section-title">Tasks / Books</h2>
      <Table headers={["Book", "Reward", "Plan", "Status", "Action"]}>
        {rows.map((r) => (
          <tr key={r.id}>
            <td>
              <strong>{r.title}</strong>
              <small>{r.description?.slice(0, 90) || ""}</small>
            </td>
            <td>Rs. {Number(r.reward).toFixed(2)}</td>
            <td>{r.plan_required || "Any"}</td>
            <td>{r.status}</td>
            <td>
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
            </td>
          </tr>
        ))}
      </Table>
    </>
  );
}

function Deposits({ rows, update }) {
  return (
    <>
      <h2 className="admin-section-title">Recharge / Deposits</h2>
      <Table headers={["User", "Plan / TID", "Amount", "Proof", "Status", "Action"]}>
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
            <td>{r.status}</td>
            <td>
              {r.status === "pending" && (
                <>
                  <button onClick={() => update(() => api.adminUpdateDeposit(r.id, { status: "approved" }))}>
                    Approve
                  </button>
                  <button onClick={() => update(() => api.adminUpdateDeposit(r.id, { status: "rejected" }))}>
                    Reject
                  </button>
                </>
              )}
            </td>
          </tr>
        ))}
      </Table>
    </>
  );
}

function Withdrawals({ rows, update }) {
  return (
    <>
      <h2 className="admin-section-title">Withdrawals</h2>
      <Table headers={["User", "Payout", "Amount", "Status", "Action"]}>
        {rows.map((r) => (
          <tr key={r.id}>
            <td>
              <strong>{r.full_name || r.phone}</strong>
              <small>{r.wallet_type} wallet</small>
            </td>
            <td>
              {r.method || "No account"} · {r.account_number || ""}
            </td>
            <td>
              Rs. {Number(r.amount).toFixed(2)}
              <small>Net Rs. {Number(r.net_amount).toFixed(2)}</small>
            </td>
            <td>{r.status}</td>
            <td>
              {r.status === "pending" && (
                <>
                  <button onClick={() => update(() => api.adminUpdateWithdrawal(r.id, { status: "approved" }))}>
                    Approve
                  </button>
                  <button onClick={() => update(() => api.adminUpdateWithdrawal(r.id, { status: "rejected" }))}>
                    Reject
                  </button>
                </>
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
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  return (
    <>
      <h2 className="admin-section-title">News</h2>
      <div className="admin-form">
        <input
          placeholder="News title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <input
          placeholder="Short summary"
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
        />
        <button
          onClick={() =>
            update(async () => {
              await api.adminCreateNews({ title, summary, body: summary, status: "published" });
              setTitle("");
              setSummary("");
            })
          }
        >
          Publish News
        </button>
      </div>
      <Table>
        {rows.map((r) => (
          <tr key={r.id}>
            <td>
              <strong>{r.title}</strong>
              <small>{r.summary}</small>
            </td>
            <td>{r.status}</td>
            <td>
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
  const upload = (method, e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type.startsWith("image/")) return alert("Upload an image QR code.");
    if (f.size > 5 * 1024 * 1024) return alert("QR image must be 5 MB or smaller.");
    const rd = new FileReader();
    rd.onload = () => change(method, "qr_data", String(rd.result || ""));
    rd.readAsDataURL(f);
  };
  return (
    <>
      <h2 className="admin-section-title">Bank / Recharge Settings</h2>
      <div className="admin-note">
        Change the receiving account and QR code used on the public Recharge page. Changes apply immediately after saving.
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
                QR code
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(e) => upload(r.method, e)}
                />
              </label>
              {d.qr_data && <img className="admin-qr-preview" src={d.qr_data} alt="QR preview" />}
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
  return (
    <>
      <h2 className="admin-section-title">Support</h2>
      <Table headers={["Subject", "Status", "Action"]}>
        {rows.map((r) => (
          <tr key={r.id}>
            <td>
              <strong>{r.subject}</strong>
              <small>{r.full_name || r.phone || "Guest"}</small>
            </td>
            <td>{r.status}</td>
            <td>
              <button
                onClick={() =>
                  update(() =>
                    api.adminUpdateSupport(r.id, {
                      status: r.status === "closed" ? "open" : "closed"
                    })
                  )
                }
              >
                {r.status === "closed" ? "Reopen" : "Close"}
              </button>
            </td>
          </tr>
        ))}
      </Table>
    </>
  );
}
