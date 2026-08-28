import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../services/api";

export default function Wallet() {
  const navigate = useNavigate();
  const [fundPassword, setFundPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [accounts, setAccounts] = useState([]);
  const [deposits, setDeposits] = useState([]);
  const [user, setUser] = useState(null);
  const [showAccountForm, setShowAccountForm] = useState(false);
  const [accountMethod, setAccountMethod] = useState("JazzCash");
  const [accountName, setAccountName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  useEffect(() => {
    api.me().then(({user}) => setUser(user)).catch(() => {});
    api.payoutAccounts().then(({accounts}) => setAccounts(accounts)).catch(() => {});
    api.deposits().then(({deposits}) => setDeposits(deposits)).catch(() => {});
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
    } catch (err) { setMessage(err.message); }
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
    api.setFundPassword({fundPassword,confirmFundPassword:confirmPassword}).then(() => setMessage("Fund password saved successfully.")).catch((err) => setMessage(err.message));
    setFundPassword("");
    setConfirmPassword("");
  };

  return (
    <section className="wallet-page">
      <div className="wallet-heading">
        <button className="round-back" onClick={() => navigate(-1)} aria-label="Go back">‹</button>
        <div>
          <h1>My accounts</h1>
          <p>Saved payout accounts &amp; fund password</p>
        </div>
      </div>

      <div className="wallet-card wallet-balances-card"><div className="wallet-balance-grid"><div><small>Personal Wallet</small><strong>Rs. {Number(user?.wallet_balance||0).toLocaleString()}</strong><span>Deposits and plan purchases</span></div><div><small>Commission Wallet</small><strong>Rs. {Number(user?.commission_balance||0).toLocaleString()}</strong><span>Task and referral rewards</span></div></div></div>

      <div className="wallet-card">
        <div className="wallet-card-title">
          <span className="wallet-icon">▣</span>
          <strong>Saved accounts</strong>
          <button className="add-button" onClick={() => setShowAccountForm(true)}>
            <span>＋</span> Add
          </button>
        </div>
        {accounts.length === 0 ? <p className="wallet-help">No saved accounts yet. Add JazzCash, EasyPaisa, Bank or BEP-20 details for faster withdrawals.</p> : <div className="saved-account-list">{accounts.map(a => <div className="saved-account-row" key={a.id}><span><strong>{a.method}</strong><small>{a.account_name}</small></span><b>{a.account_number}</b></div>)}</div>}
        {showAccountForm && <div className="account-modal-backdrop"><form className="account-modal" onSubmit={saveAccount}><div className="account-modal-head"><strong>Create payout account</strong><button type="button" onClick={() => setShowAccountForm(false)}>×</button></div><label>Account type<select value={accountMethod} onChange={e=>setAccountMethod(e.target.value)}><option>JazzCash</option><option>EasyPaisa</option><option>Bank</option><option>BEP-20</option></select></label><label>Account holder name<input value={accountName} onChange={e=>setAccountName(e.target.value)} placeholder="Your full name" /></label><label>Account / wallet number<input value={accountNumber} onChange={e=>setAccountNumber(e.target.value)} placeholder="03XXXXXXXXX" /></label><button className="save-fund-button" type="submit">Save account</button></form></div>}
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

      <div className="wallet-card">
        <div className="history-title"><strong>Deposit history</strong><button onClick={() => navigate("/recharge")}>New deposit <span>↗</span></button></div>
        {deposits.length === 0 ? <div className="empty-history"><strong>Not yet</strong><span>You have not submitted any deposit request. Your records will appear here.</span></div> : <div className="wallet-history-list">{deposits.slice(0,5).map(d => <div className="wallet-history-row" key={d.id}><span><strong>{d.plan_code}</strong><small>Rs. {Number(d.amount).toLocaleString()} · {d.tid}</small></span><b>{d.status}</b></div>)}</div>}
      </div>

      <HistoryCard title="Withdrawal history" action="New withdraw" onAction={() => setMessage("Withdrawal flow will be connected after payout accounts and fund password are configured.")}>
        You have not requested any withdrawal so far. Your records will appear here.
      </HistoryCard>
    </section>
  );
}

function HistoryCard({ title, action, onAction, children }) {
  return (
    <div className="wallet-card">
      <div className="history-title">
        <strong>{title}</strong>
        <button onClick={onAction}>{action} <span>↗</span></button>
      </div>
      <div className="empty-history">
        <strong>Not yet</strong>
        <span>{children}</span>
      </div>
    </div>
  );
}
