import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, getCachedData, getCachedUser } from "../services/api";
const amounts = [260, 1650, 6600, 17500, 114000, 1016000, 1525000, 2589000, 12955000];
export default function WithdrawRewards() {
 const navigate = useNavigate();
 const [user, setUser] = useState(() => getCachedUser());
 const [accounts, setAccounts] = useState(() => getCachedData("payoutAccounts")?.accounts || []);
 const [history, setHistory] = useState(() => getCachedData("withdrawals")?.withdrawals || []);
 const [source, setSource] = useState("commission");
 const [amount, setAmount] = useState("");
 const [method, setMethod] = useState("JazzCash");
 const [accountId, setAccountId] = useState(() => {
   const a = getCachedData("payoutAccounts")?.accounts;
   return a?.length ? String(a[0].id) : "";
 });
 const [fundPassword, setFundPassword] = useState("");
 const [message, setMessage] = useState("");
 const [error, setError] = useState("");
 const [busy, setBusy] = useState(false);
 const load = async () => {
   const [{ user: u }, { accounts: a }, { withdrawals: w }] = await Promise.all([api.me(), api.payoutAccounts(), api.withdrawals()]);
   setUser(u);
   setAccounts(a || []);
   setHistory(w || []);
   if (a?.length && !accountId) {
     setAccountId(String(a[0].id));
     setMethod(a[0].method);
   }
 };
 useEffect(() => { load().catch(e => setError(e.message)); }, []);
 const balance=source==='commission'?Number(user?.commission_balance||0):Number(user?.wallet_balance||0); const selected=Number(amount||0); const fee=selected*.12; const net=selected-fee;
 const filteredAccounts=useMemo(()=>accounts.filter(a=>a.method===method),[accounts,method]);
 useEffect(()=>{const a=filteredAccounts[0];setAccountId(a?String(a.id):"");},[method]);
 const submit=async()=>{setError("");setMessage("");if(!selected)return setError("Select a withdrawal amount.");if(selected>balance)return setError("Insufficient wallet balance.");if(!accountId)return setError("Add and select a payout account first.");if(!/^\d{6}$/.test(fundPassword))return setError("Enter your 6-digit fund password.");setBusy(true);try{const r=await api.submitWithdrawal({walletType:source,amount:selected,payoutAccountId:Number(accountId),fundPassword});setMessage(`✓ Withdrawal request submitted. Net payout: Rs. ${Number(r.netAmount).toLocaleString()}.`);setAmount("");setFundPassword("");await load();}catch(e){setError(e.message)}finally{setBusy(false)}};
 return <section className="feature-page withdraw-page">
  <header className="feature-header"><button className="round-back" onClick={()=>navigate(-1)}>‹</button><div><h1>Withdraw rewards</h1><p>{source==='commission'?'Commission':'Personal'} wallet Rs. {balance.toLocaleString()}</p></div></header>
  {error&&<div className="toast error-toast">{error}</div>}{message&&<div className="toast success-toast">{message}</div>}
  <section className="warning-box"><strong>Withdrawal availability</strong><span>Withdrawals are available Monday to Friday, 11:00 AM – 5:00 PM (PKT). Active plans are required.</span><button onClick={()=>navigate('/plans')}>View plans</button></section>
  <section className="open-box"><strong>Withdrawal window</strong><span>Monday–Friday · 11:00 AM–5:00 PM (PKT) · one request per day</span></section>
  <section className="feature-card withdraw-form"><h3>Withdraw from wallet</h3><div className="wallet-choice">{[['commission','Commission wallet','Task & referral income',user?.commission_balance],['personal','Personal wallet','Deposited funds',user?.wallet_balance]].map(([key,title,desc,val])=><button type="button" key={key} className={source===key?'selected':''} onClick={()=>setSource(key)}><strong>{title}</strong><span>{desc}</span><b>Rs. {Number(val||0).toLocaleString()}</b></button>)}</div>
   <div className="saved-head"><strong>Saved accounts</strong><button type="button" onClick={()=>navigate('/wallet')}>Manage accounts</button></div>{accounts.length===0?<p className="tiny">No saved account yet. Add JazzCash, EasyPaisa, Bank or BEP-20 details.</p>:<div className="saved-account-list">{accounts.map(a=><button type="button" key={a.id} className={`saved-account-row ${String(accountId)===String(a.id)?'selected':''}`} onClick={()=>{setAccountId(String(a.id));setMethod(a.method)}}><span><strong>{a.method}</strong><small>{a.account_name}</small></span><b>{a.account_number}</b></button>)}</div>}
   <label>Select withdrawal amount (PKR)</label><div className="amount-grid">{amounts.map(x=><button type="button" key={x} className={selected===x?'selected':''} disabled={x>balance} onClick={()=>setAmount(String(x))}>{x.toLocaleString()}</button>)}</div><small>{method==='JazzCash'||method==='EasyPaisa'?'12%':'Processing'} fee (Rs. {fee.toLocaleString(undefined,{maximumFractionDigits:2})}) · you'll receive Rs. {net.toLocaleString(undefined,{maximumFractionDigits:2})}</small>
   <label>Payout method<select value={method} onChange={e=>setMethod(e.target.value)}><option>JazzCash</option><option>EasyPaisa</option><option>Bank</option><option>BEP-20</option></select></label>
   <label>Account details<input value={filteredAccounts.find(a=>String(a.id)===String(accountId))?.account_number||''} readOnly placeholder="Select a saved account" /></label>
   <label>Fund password (6 digits)<input type="password" inputMode="numeric" maxLength={6} value={fundPassword} onChange={e=>setFundPassword(e.target.value.replace(/\D/g,''))} placeholder="••••••" /></label>
   <div className="soft-note">Only fixed withdrawal amounts can be selected. Wrong account details are the user's responsibility.</div><button className="primary-btn" onClick={submit} disabled={busy}>{busy?'Submitting…':'Submit request'}</button>
  </section>
  <section className="instructions feature-card"><h3>ZENFLOW WITHDRAWAL INSTRUCTIONS</h3><div><strong>Service fee</strong><p>JazzCash withdrawals: 12% commission deducted.<br/>EasyPaisa withdrawals: 12% commission deducted.<br/>Binance (BEP-20) withdrawals: $1 fixed processing fee deducted.</p></div><div><strong>Withdrawal process</strong><p>Enter amount, choose payout method and add correct account details. Requests are reviewed before payment is released.</p></div><div><strong>Withdrawal time</strong><p>Monday to Friday, 11:00 AM – 5:00 PM (PKT). Saturday and Sunday are off.</p></div><div><strong>Minimum amount & notice</strong><p>Only fixed withdrawal amounts shown on the withdrawal page can be selected.</p></div></section>
  <div className="support-buttons"><button type="button">◔ WhatsApp help</button><button type="button">⌕ Call helpline</button></div><button className="history-btn" type="button">↻ Withdrawal history</button>
  <section className="feature-card empty-feature"><strong>{history.length?`${history.length} withdrawal records`:'Not yet'}</strong>{history.length?<div className="withdraw-history-list">{history.map(w=><div className="withdraw-history-row" key={w.id}><span><strong>Rs. {Number(w.amount).toLocaleString()}</strong><small>{w.method||'Payout'} · {w.requested_at?new Date(w.requested_at).toLocaleString():''}</small></span><b>{w.status}</b></div>)}</div>:<span>You have not requested any withdrawal so far. Your records will appear here.</span>}</section>
 </section>;
}
