import { useNavigate } from "react-router-dom";
const funds=[
 ["Reader Circle Fund","OnlineBookClub.org","5 days · Daily profit 2.8%","11%"],
 ["Ghostwriting Growth Fund","Ghostwriting LLC","6 days · Daily profit 3.1%","37%"],
 ["NetGalley Review Fund","NetGalley","7 days · Daily profit 3.4%","62%"],
 ["Edelweiss+ Elite Fund","Edelweiss+","8 days · Daily profit 3.75%","84%"],
];
export default function WealthFund(){
 const navigate=useNavigate();
 return <section className="feature-page wealth-page">
  <header className="feature-header"><button className="round-back" onClick={()=>navigate(-1)}>‹</button><div><h1>Wealth Fund</h1><p>Partner book funds · 5–8 day terms</p></div></header>
  <div className="wealth-stats"><article className="feature-card"><span>↗ Funds in progress</span><b>Rs. 0</b></article><article className="feature-card"><span>🎁 Expected profit</span><b>Rs. 0</b></article></div>
  <div className="wealth-meta">▣ Personal Rs. 0 · Commission Rs. 0</div>
  <h2 className="feature-section-title">Hot funds</h2>
  <div className="fund-list">{funds.map(([a,b,c,d])=><article className="fund-item feature-card" key={a}><div className="fund-logo">ZF</div><div><strong>{a}</strong><span>{b}</span><b>{c}</b></div><em>{d}</em></article>)}</div>
  <h2 className="feature-section-title">Purchase history</h2>
  <section className="empty-feature feature-card">No fund saved yet. Pick a partner fund above to start.</section>
 </section>;
}
