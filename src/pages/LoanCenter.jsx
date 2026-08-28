import { useNavigate } from "react-router-dom";
const loans=[["Personal Loan","Flexible repayment terms","Rs. 20,000"],["Advance Loan","Higher approval limits","Rs. 50,000"],["Premium Loan","Priority processing","Rs. 100,000"]];
export default function LoanCenter(){
 const navigate=useNavigate();
 return <section className="feature-page loan-page">
  <header className="center-header"><button className="round-back" onClick={()=>navigate(-1)}>‹</button><div><h1>Loan Center</h1><p>Quick cash support</p></div></header>
  <section className="loan-hero feature-card"><div className="loan-icon">💵</div><h2>Need a loan in PKR?</h2><p>Choose an amount below and contact us. Our team will review and let you know if you qualify.</p></section>
  <div className="loan-list">{loans.map(([a,b,c])=><article className="loan-item feature-card" key={a}><div className="loan-item-icon">▣</div><div><strong>{a}</strong><span>{b}</span><b>{c}</b></div><em>Coming soon</em></article>)}</div>
  <p className="feature-footnote">Loan approval is subject to internal review and eligibility.</p>
 </section>;
}
