import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { api } from "../services/api";

const METHODS = {
  JazzCash: { subtitle: "Business Till · instant", accountLabel: "JazzCash Business Till", account: "980203437", logo: "/zenflow-images/payment-methods/jazzcash.png", hint: "Pay to the business till shown below." },
  SadaPay: { subtitle: "Mobile account · instant", accountLabel: "SadaPay account number", account: "03254138875", logo: "/zenflow-images/payment-methods/sadapay.png", hint: "Pay to the SadaPay account shown below." },
  EasyPaisa: { subtitle: "Business Till · instant", accountLabel: "EasyPaisa Business Till", account: "03001234567", logo: "/zenflow-images/payment-methods/easypaisa.png", hint: "Pay to the EasyPaisa account shown below." },
  "Binance (BEP-20)": { subtitle: "USDT · BNB Smart Chain", accountLabel: "USDT BEP-20 address", account: "0x7E2F000000000000000000000000000000000001", logo: "/zenflow-images/payment-methods/binance.png", hint: "Send USDT only on the BEP-20 network." }
};
const PLANS=[{code:"F1",price:4500},{code:"F2",price:16500},{code:"F3",price:60000},{code:"F4",price:216000,soon:true},{code:"F5",price:480000,soon:true},{code:"F6",price:1455000,soon:true},{code:"F7",price:3870000,soon:true},{code:"F8",price:7350000,soon:true},{code:"F9",price:15150000,soon:true}];
const money=n=>Number(n||0).toLocaleString("en-US");

export default function Recharge(){
 const navigate=useNavigate(); const location=useLocation();
 const requestedPlan=new URLSearchParams(location.search).get("plan");
 const [step,setStep]=useState(1); const [method,setMethod]=useState("JazzCash");
 const [planCode,setPlanCode]=useState(PLANS.find(p=>p.code===requestedPlan&&!p.soon)?.code||"F1");
 const selectedPlan=useMemo(()=>PLANS.find(p=>p.code===planCode)||PLANS[0],[planCode]);
 const [walletNumber,setWalletNumber]=useState(""); const [tid,setTid]=useState(""); const [proofData,setProofData]=useState(""); const [proofName,setProofName]=useState("");
 const [secondsLeft,setSecondsLeft]=useState(300); const [paymentSettings,setPaymentSettings]=useState({}); const [submitting,setSubmitting]=useState(false); const [message,setMessage]=useState(""); const [error,setError]=useState(""); const [deposits,setDeposits]=useState([]);
 const methodInfo={...METHODS[method],...(paymentSettings[method]||{}),account:paymentSettings[method]?.account_number||METHODS[method].account,accountLabel:paymentSettings[method]?.account_label||METHODS[method].accountLabel,qrData:paymentSettings[method]?.qr_data||"/zenflow-images/payment-methods/dummy-qr.svg",hint:paymentSettings[method]?.instructions||METHODS[method].hint};
 useEffect(()=>{Promise.all([api.deposits(),api.paymentSettings?.()]).then(([d,ps])=>{setDeposits(d.deposits||[]);const map={};(ps?.settings||[]).forEach(x=>map[x.method]=x);setPaymentSettings(map)}).catch(()=>{});},[]);
 useEffect(()=>{if(step!==2)return;setSecondsLeft(300);const t=window.setInterval(()=>setSecondsLeft(s=>s>0?s-1:0),1000);return()=>window.clearInterval(t)},[step]);
 const time=`${String(Math.floor(secondsLeft/60)).padStart(2,"0")}:${String(secondsLeft%60).padStart(2,"0")}`;
 const handleProof=e=>{const file=e.target.files?.[0];if(!file)return;if(!/^image\/(png|jpe?g|webp)$/.test(file.type))return setError("Please upload a PNG, JPG or WEBP screenshot.");if(file.size>5*1024*1024)return setError("Payment screenshot must be 5 MB or smaller.");const reader=new FileReader();reader.onload=()=>{setProofData(String(reader.result||""));setProofName(file.name);setError("")};reader.readAsDataURL(file)};
 const submit=async e=>{e.preventDefault();setError("");setMessage("");if(secondsLeft===0)return setError("The payment timer has expired. Start a new recharge request.");if(method!=="Binance (BEP-20)"&&!/^03\d{9}$/.test(walletNumber.replace(/\s/g,"")))return setError("Enter a valid 11-digit mobile wallet number.");if(!tid.trim())return setError("Enter the transaction ID (TID) from your payment.");if(!proofData)return setError("Upload your payment screenshot before submitting.");setSubmitting(true);try{const r=await api.submitDeposit({planCode:selectedPlan.code,amount:selectedPlan.price,paymentMethod:method,tid:tid.trim(),walletNumber:walletNumber.replace(/\s/g,""),proofData});setMessage(r.message);setDeposits(prev=>[{id:r.id,plan_code:selectedPlan.code,amount:selectedPlan.price,payment_method:method,status:"pending",tid:tid.trim(),submitted_at:new Date().toISOString()},...prev]);setTid("");setProofData("");setProofName("");setStep(1)}catch(err){setError(err.message)}finally{setSubmitting(false)}};
 return <section className="feature-page recharge-page">
  <header className="feature-header"><button className="round-back" onClick={()=>step===1?navigate(-1):setStep(step-1)}>‹</button><div><h1>{step===1?"Deposit":method}</h1><p>{step===1?"Choose a payment method":"Pay, then upload your proof"}</p></div></header>
  {message&&<div className="recharge-success">✓ {message}</div>}{error&&<div className="recharge-error">{error}</div>}
  {step===1&&<>
   <section className="feature-card payment-method-card"><h2>Payment method</h2><div className="payment-method-grid">{Object.entries(METHODS).map(([name,info])=><button key={name} className={`payment-method-option ${method===name?"selected":""}`} onClick={()=>{setMethod(name);setStep(2);}}><span className="payment-logo"><img src={info.logo} alt="" /></span><span><strong>{name}</strong><small>{info.subtitle}</small></span><b>✓</b></button>)}</div><p>Tap a method to see the payment details. You get 5 minutes to pay and upload your proof.</p></section>
  </>}
  {step===2&&<>
   <button className="change-method" onClick={()=>setStep(1)}>← &nbsp; Change method</button>
   <section className="feature-card recharge-timer"><div className="timer-ring"><strong>{time}</strong></div><div><strong>Complete payment within 5 minutes</strong><span>{methodInfo.hint} Then submit your transaction ID and screenshot before the timer ends.</span></div></section>
   <section className="feature-card till-card"><div className="jazz-mark"><img src={methodInfo.logo} alt="" /></div><div><small>{methodInfo.accountLabel}</small><strong>{methodInfo.account}</strong></div><button type="button" onClick={()=>navigator.clipboard?.writeText(methodInfo.account)}>▣ &nbsp; Copy</button></section>{methodInfo.qrData&&<section className="feature-card payment-qr-card"><div><strong>Scan to pay</strong><span>Use your payment app to scan this QR code.</span></div><img src={methodInfo.qrData} alt={`${method} payment QR`} /></section>}
   <form className="feature-card recharge-form" onSubmit={submit}>
    <label>Amount (PKR)<input value={selectedPlan.price} readOnly /></label>
    <div className="recharge-plan-grid">{PLANS.map(plan=><button key={plan.code} type="button" disabled={plan.soon} className={planCode===plan.code?"selected":""} onClick={()=>setPlanCode(plan.code)}><span>{plan.code} Plan</span><strong>Rs. {money(plan.price)}</strong>{plan.soon&&<small>Coming soon</small>}</button>)}</div>
    {method!=="Binance (BEP-20)"&&<label>Your Wallet Number<input value={walletNumber} onChange={e=>setWalletNumber(e.target.value.replace(/[^0-9 ]/g,""))} placeholder="03XXXXXXXXX" inputMode="numeric" maxLength={12}/></label>}
    <label>Transaction ID (TID)<input value={tid} onChange={e=>setTid(e.target.value)} placeholder="e.g. 3948201933"/></label>
    <label>Payment screenshot<span className="recharge-help">After the payment, upload your payment screenshot here for verification.</span><input className="file-input" type="file" accept="image/png,image/jpeg,image/webp" onChange={handleProof}/><span className="upload-box">⇧<strong>{proofName||"Tap to upload screenshot"}</strong><small>PNG or JPG · up to 5 MB</small></span></label>
    <button className="primary-btn" disabled={submitting||secondsLeft===0}>{submitting?"Submitting…":`Deposit Rs. ${money(selectedPlan.price)}`}</button><p className="recharge-note">Deposits are verified manually and credited to your Personal Wallet after admin approval.</p>
   </form>
  </>}
  <section className="feature-card recharge-history"><div className="history-head"><strong>Deposit history</strong><span>{deposits.length} records</span></div>{deposits.length===0?<div className="empty-feature"><strong>Not yet</strong><span>You have not submitted any deposit request. Your records will appear here.</span></div>:<div className="deposit-list">{deposits.map(d=><div className="deposit-row" key={d.id}><div><strong>Rs. {money(d.amount)} · {d.payment_method||"Deposit"} · {d.plan_code}</strong><small>TID: {d.tid||"—"}</small></div><b className={`deposit-status ${d.status}`}>{d.status}</b></div>)}</div>}</section>
 </section>;
}
