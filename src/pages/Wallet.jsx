import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../services/api";

export default function Wallet() {
  const navigate = useNavigate();
  const [fundPassword, setFundPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [accounts, setAccounts] = useState([]);
  const [deposits, setDeposits] = useState([]);
  const [withdrawals, setWithdrawals] = useState([]);
  const [user, setUser] = useState(null);
  const [showAccountForm, setShowAccountForm] = useState(false);
  const [accountMethod, setAccountMethod] = useState("JazzCash");
  const [accountName, setAccountName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");

  const [recordTab, setRecordTab] = useState("deposits"); // 'deposits' | 'withdrawals'
  const [filterStartDate, setFilterStartDate] = useState("");
  const [filterEndDate, setFilterEndDate] = useState("");

  useEffect(() => {
    api.me().then(({ user }) => setUser(user)).catch(() => {});
    api.payoutAccounts().then(({ accounts }) => setAccounts(accounts)).catch(() => {});
    api.deposits().then(({ deposits }) => setDeposits(deposits || [])).catch(() => {});
    api.withdrawals().then(({ withdrawals }) => setWithdrawals(withdrawals || [])).catch(() => {});
  }, []);

  const saveAccount = async (e) => {
    e.preventDefault();
    setMessage("");
    if (!accountName.trim() || !accountNumber.trim()) {
      setMessage("Enter the account holder name and account number.");
      return;
    }
    try {
      await api.addPayoutAccount({ method: accountMethod, accountName: accountName.trim(), accountNumber: accountNumber.trim() });
      const { accounts: fresh } = await api.payoutAccounts();
      setAccounts(fresh);
      setAccountName("");
      setAccountNumber("");
      setShowAccountForm(false);
      setMessage("Payout account saved successfully.");
    } catch (err) {
      setMessage(err.message);
    }
  };

  const saveFundPassword = (e) => {
    e.preventDefault();
    setMessage("");
    if (!/^\d{6}$/.test(fundPassword)) {
      setMessage("Fund password must contain exactly 6 digits.");
      return;
    }
    if (fundPassword !== confirmPassword) {
      setMessage("Fund passwords do not match.");
      return;
    }
    api
      .setFundPassword({ fundPassword, confirmFundPassword: confirmPassword })
      .then(() => setMessage("Fund password saved successfully."))
      .catch((err) => setMessage(err.message));
    setFundPassword("");
    setConfirmPassword("");
  };

  const filteredDeposits = useMemo(() => {
    return deposits.filter((d) => {
      if (!d.submitted_at) return true;
      const dDate = d.submitted_at.slice(0, 10);
      if (filterStartDate && dDate < filterStartDate) return false;
      if (filterEndDate && dDate > filterEndDate) return false;
      return true;
    });
  }, [deposits, filterStartDate, filterEndDate]);

  const filteredWithdrawals = useMemo(() => {
    return withdrawals.filter((w) => {
      if (!w.requested_at) return true;
      const wDate = w.requested_at.slice(0, 10);
      if (filterStartDate && wDate < filterStartDate) return false;
      if (filterEndDate && wDate > filterEndDate) return false;
      return true;
    });
  }, [withdrawals, filterStartDate, filterEndDate]);

  return (
    <section className="wallet-page">
      <div className="wallet-heading">
        <button className="round-back" onClick={() => navigate(-1)} aria-label="Go back">‹</button>
        <div>
          <h1>My accounts</h1>
          <p>Deposit wallet, saved payout accounts &amp; records</p>
        </div>
      </div>

      <div className="wallet-card wallet-balances-card">
        <div className="wallet-balance-grid">
          <div>
            <small>Deposit Wallet (Personal)</small>
            <strong>Rs. {Number(user?.wallet_balance || 0).toLocaleString()}</strong>
            <span>Deposit funds for plan purchases only</span>
          </div>
          <div>
            <small>Commission Wallet</small>
            <strong>Rs. {Number(user?.commission_balance || 0).toLocaleString()}</strong>
            <span>Task earnings &amp; team commissions</span>
          </div>
        </div>
      </div>

      <div className="wallet-card">
        <div className="wallet-card-title">
          <span className="wallet-icon">▣</span>
          <strong>Saved accounts</strong>
          <button className="add-button" onClick={() => setShowAccountForm(true)}>
            <span>＋</span> Add
          </button>
        </div>
        {accounts.length === 0 ? (
          <p className="wallet-help">No saved accounts yet. Add JazzCash, EasyPaisa, Bank or BEP-20 details for faster withdrawals.</p>
        ) : (
          <div className="saved-account-list">
            {accounts.map((a) => (
              <div className="saved-account-row" key={a.id}>
                <span>
                  <strong>{a.method}</strong>
                  <small>{a.account_name}</small>
                </span>
                <b>{a.account_number}</b>
              </div>
            ))}
          </div>
        )}
        {showAccountForm && (
          <div className="account-modal-backdrop">
            <form className="account-modal" onSubmit={saveAccount}>
              <div className="account-modal-head">
                <strong>Create payout account</strong>
                <button type="button" onClick={() => setShowAccountForm(false)}>×</button>
              </div>
              <label>
                Account type
                <select value={accountMethod} onChange={(e) => setAccountMethod(e.target.value)}>
                  <option>JazzCash</option>
                  <option>EasyPaisa</option>
                  <option>Bank</option>
                  <option>BEP-20</option>
                </select>
              </label>
              <label>
                Account holder name
                <input value={accountName} onChange={(e) => setAccountName(e.target.value)} placeholder="Your full name" />
              </label>
              <label>
                Account / wallet number
                <input value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} placeholder="03XXXXXXXXX" />
              </label>
              <button className="save-fund-button" type="submit">Save account</button>
            </form>
          </div>
        )}
      </div>

      <div className="wallet-card">
        <div className="wallet-card-title">
          <span className="wallet-icon">♢</span>
          <strong>Create fund password</strong>
        </div>
        <p className="wallet-help">A 6-digit fund password is required to confirm every withdrawal.</p>

        <form onSubmit={saveFundPassword} className="fund-form">
          <label>
            Fund password
            <input
              inputMode="numeric"
              maxLength={6}
              value={fundPassword}
              onChange={(e) => setFundPassword(e.target.value.replace(/\D/g, ""))}
              placeholder="6 digits"
            />
          </label>
          <label>
            Confirm fund password
            <input
              inputMode="numeric"
              maxLength={6}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value.replace(/\D/g, ""))}
              placeholder="Re-enter 6 digits"
            />
          </label>
          <button className="save-fund-button" type="submit">Save fund password</button>
          {message && <p className="wallet-message">{message}</p>}
        </form>
      </div>

      {/* Transaction & History Section with Pills */}
      <div className="wallet-card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px", flexWrap: "wrap", gap: "8px" }}>
          {/* Pills Toggle: Deposits & Withdrawals */}
          <div style={{ display: "flex", background: "#f1f5f9", padding: "3px", borderRadius: "999px", gap: "4px" }}>
            <button
              type="button"
              onClick={() => setRecordTab("deposits")}
              style={{
                padding: "6px 18px",
                borderRadius: "999px",
                border: "none",
                fontWeight: 700,
                fontSize: "13px",
                cursor: "pointer",
                transition: "all 0.2s ease",
                background: recordTab === "deposits" ? "#008747" : "transparent",
                color: recordTab === "deposits" ? "#ffffff" : "#475569"
              }}
            >
              Deposits
            </button>
            <button
              type="button"
              onClick={() => setRecordTab("withdrawals")}
              style={{
                padding: "6px 18px",
                borderRadius: "999px",
                border: "none",
                fontWeight: 700,
                fontSize: "13px",
                cursor: "pointer",
                transition: "all 0.2s ease",
                background: recordTab === "withdrawals" ? "#008747" : "transparent",
                color: recordTab === "withdrawals" ? "#ffffff" : "#475569"
              }}
            >
              Withdrawals
            </button>
          </div>

          <button
            type="button"
            onClick={() => navigate(recordTab === "deposits" ? "/recharge" : "/withdraw")}
            style={{
              padding: "6px 14px",
              borderRadius: "8px",
              background: "#eefbf4",
              color: "#008747",
              border: "1px solid #bbf7d0",
              fontWeight: 600,
              fontSize: "12px",
              cursor: "pointer"
            }}
          >
            {recordTab === "deposits" ? "New deposit ↗" : "New withdrawal ↗"}
          </button>
        </div>

        {/* Date Filter Bar */}
        <div style={{ display: "flex", gap: "8px", alignItems: "center", marginBottom: "14px", flexWrap: "wrap", background: "#f8fafc", padding: "8px 10px", borderRadius: "8px" }}>
          <small style={{ fontWeight: 600, color: "#64748b" }}>Date Filter:</small>
          <input
            type="date"
            value={filterStartDate}
            onChange={(e) => setFilterStartDate(e.target.value)}
            style={{ padding: "4px 8px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "12px" }}
          />
          <span style={{ color: "#94a3b8" }}>to</span>
          <input
            type="date"
            value={filterEndDate}
            onChange={(e) => setFilterEndDate(e.target.value)}
            style={{ padding: "4px 8px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "12px" }}
          />
          {(filterStartDate || filterEndDate) && (
            <button
              type="button"
              onClick={() => { setFilterStartDate(""); setFilterEndDate(""); }}
              style={{ background: "#fee2e2", color: "#dc2626", border: "none", padding: "4px 8px", borderRadius: "6px", fontSize: "11px", cursor: "pointer" }}
            >
              Clear
            </button>
          )}
        </div>

        {/* Tab content */}
        {recordTab === "deposits" ? (
          filteredDeposits.length === 0 ? (
            <div className="empty-history">
              <strong>No deposit records</strong>
              <span>You have not submitted any deposit in this period.</span>
            </div>
          ) : (
            <div className="wallet-history-list">
              {filteredDeposits.map((d) => (
                <div className="wallet-history-row" key={d.id}>
                  <span>
                    <strong>Rs. {Number(d.amount).toLocaleString()} · {d.plan_code}</strong>
                    <small>
                      TID: {d.tid || "—"} · {d.submitted_at ? new Date(d.submitted_at).toLocaleString() : ""}
                    </small>
                  </span>
                  <b
                    style={{
                      textTransform: "capitalize",
                      color: d.status === "approved" ? "#166534" : d.status === "pending" ? "#92400e" : "#dc2626"
                    }}
                  >
                    {d.status}
                  </b>
                </div>
              ))}
            </div>
          )
        ) : filteredWithdrawals.length === 0 ? (
          <div className="empty-history">
            <strong>No withdrawal records</strong>
            <span>You have not requested any withdrawal in this period.</span>
          </div>
        ) : (
          <div className="wallet-history-list">
            {filteredWithdrawals.map((w) => (
              <div className="wallet-history-row" key={w.id}>
                <span>
                  <strong>Rs. {Number(w.amount).toLocaleString()} ({w.wallet_type || "commission"} wallet)</strong>
                  <small>
                    {w.method || "Payout"} · {w.requested_at ? new Date(w.requested_at).toLocaleString() : ""}
                  </small>
                </span>
                <b
                  style={{
                    textTransform: "capitalize",
                    color: w.status === "paid" || w.status === "approved" ? "#166534" : w.status === "pending" ? "#92400e" : "#dc2626"
                  }}
                >
                  {w.status}
                </b>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
