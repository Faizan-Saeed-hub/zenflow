import { useNavigate } from "react-router-dom";
const news=[
 ["ZenFlow Global Update","ZenFlow continues expanding its book-review community and partner network.","/src/assets/home-hero-reference.png"],
 ["Partner event highlights","Recent partner meetings and community events bring readers together.","/src/assets/home-hero-reference.png"],
 ["New task opportunities","More review categories and partner opportunities are being prepared.","/src/assets/home-hero-reference.png"],
 ["Community notice","Please check official announcements before taking action on your account.","/src/assets/home-hero-reference.png"],
];
export default function NewsCenter(){
 const navigate=useNavigate();
 return <section className="feature-page news-page">
  <header className="feature-header"><button className="round-back" onClick={()=>navigate(-1)}>‹</button><div><h1>News Center</h1><p>Latest ZenFlow updates</p></div></header>
  <section className="news-intro feature-card"><strong>ZENFLOW NEWS</strong><p>Stay updated with announcements, partner stories and important platform information.</p></section>
  <div className="news-list">{news.map(([title,text,img],i)=><article className="news-card feature-card" key={title}><img src={img} alt="" /><div><small>News · Aug {25-i}, 2026</small><h2>{title}</h2><p>{text}</p><button>Read more ›</button></div></article>)}</div>
 </section>;
}
