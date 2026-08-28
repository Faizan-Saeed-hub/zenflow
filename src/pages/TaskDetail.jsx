import { useEffect,useState } from "react";
import { useNavigate,useParams } from "react-router-dom";
import { api } from "../services/api";

const filler = (title) => [
  `${title} begins with a quiet moment that slowly reveals why ordinary days can carry the most memorable stories. The narrator notices a small detail, follows it through familiar places, and discovers that every simple choice has left a trace. The writing moves gently between present observation and remembered scenes, giving the chapter a reflective rhythm without losing its sense of movement.`,
  `As the story continues, the people around the narrator become part of the same unfolding picture. A conversation that seems unimportant at first changes the meaning of an earlier event, while a second character offers a different way of looking at the same problem. The details remain grounded in everyday life, but the emotional weight grows as the characters begin to understand what they have been avoiding.`,
  `The middle section is built from small changes rather than sudden turns. A familiar street looks different after sunset, an old message is read again, and a promise made years earlier begins to matter. These scenes give the reader time to notice the connections between memory, responsibility, and hope. The language stays accessible while allowing the mood to deepen from one paragraph to the next.`,
  `Near the end, the narrator finally sorts through the things that were left unfinished. Nothing is presented as a perfect solution; instead, the characters accept that some answers arrive only after they stop forcing them. Objects that appeared earlier return with a new meaning, and the final conversation gives the story its calmest and most direct moment. The result is less about a dramatic ending and more about seeing an ordinary life with greater honesty.`,
  `After everything is settled, the narrator looks back at the journey and recognizes how much changed through small acts of patience. The final pages leave a feeling of closure without closing every possible door. What remains is a simple idea: people can carry difficult memories without being defined by them, and a thoughtful choice today can make tomorrow feel lighter. The ending invites the reader to pause, remember the strongest image, and consider what the story was really asking from them.`,
];

export default function TaskDetail(){
 const {id}=useParams(); const navigate=useNavigate();
 const [task,setTask]=useState(null); const [rating,setRating]=useState(0); const [review,setReview]=useState(""); const [error,setError]=useState(""); const [busy,setBusy]=useState(false); const [toast,setToast]=useState("");
 useEffect(()=>{api.task(id).then(({task:t})=>{setTask(t);setRating(Number(t.rating||0));setReview(t.review_text||"")}).catch(e=>setError(e.message));},[id]);
 if(error)return <div className="empty-task">{error}</div>;
 if(!task)return <div className="app-loading">Loading task…</div>;
 if(task.locked) return <div className="task-detail-overlay"><section className="task-detail-modal"><header><strong>{task.title}</strong><button onClick={()=>navigate(-1)}>×</button></header><div className="detail-scroll"><div className="locked-task-panel"><div>🔒</div><h2>{task.plan_required} plan required</h2><p>Activate the required plan to unlock this review and earn its reward.</p><button className="primary-btn" onClick={()=>navigate("/plans")}>View plans</button></div></div></section></div>;
 const completed=task.submission_status==='approved';
 const claimable=task.submission_status==='reward_claimable';
 const content=task.description && task.description.length>500 ? task.description.split(/\n+/) : filler(task.title);
 const finishReading=async()=>{setBusy(true);setError("");try{const r=await api.finishTaskReading(task.id);setTask(t=>({...t,submission_status:r.status}));}catch(e){setError(e.message)}finally{setBusy(false)}};
 const submitRating=async()=>{if(!rating)return setError("Please select a rating first.");setBusy(true);setError("");try{const r=await api.submitTask(task.id,{reviewText:review,rating});setTask(t=>({...t,submission_status:r.status}));setToast("✓ Review submitted. You can claim your reward now.");}catch(e){setError(e.message)}finally{setBusy(false)}};
 const claim=async()=>{setBusy(true);setError("");try{const r=await api.claimTaskReward(task.id);setTask(t=>({...t,submission_status:'approved',reward_claimed_at:new Date().toISOString()}));setToast(`✓ Rs. ${Number(r.reward).toLocaleString()} credited to your wallet`);setTimeout(()=>navigate('/tasks'),900);}catch(e){setError(e.message)}finally{setBusy(false)}};
 return <div className="task-detail-overlay"><section className="task-detail-modal"><header><strong>{task.title}</strong><button onClick={()=>navigate('/tasks')}>×</button></header><div className="detail-scroll">
   <img className="detail-cover" src={task.image_url} alt={task.title}/>
   <h1>{task.title}</h1><p>Reward Rs. {Number(task.reward).toLocaleString()} · {task.plan_required||'Active plan'}</p>
   <article className="reading-article">{content.map((p,i)=><p key={i}>{p}</p>)}<div className="the-end">— The End —</div></article>
   {!completed && !claimable && <button className="primary-btn" onClick={finishReading} disabled={busy}>{busy?'Saving…':'I finished reading — rate it'}</button>}
   {completed && <div className="reward-success">✓ Rs. {Number(task.reward).toLocaleString()} credited to your wallet</div>}
   {(task.submission_status==='review_submitted'||claimable||completed) && !completed && <section className="rating-panel"><strong>Your rating</strong><div className="stars">{[1,2,3,4,5].map(n=><button key={n} className={rating>=n?'active':''} onClick={()=>setRating(n)} aria-label={`${n} stars`}>★</button>)}</div><small>Give 5 stars and submit — the reward follows your active plan.</small><textarea value={review} onChange={e=>setReview(e.target.value)} placeholder="Optional review note" rows={3}/>{claimable?<button className="primary-btn" onClick={claim} disabled={busy}>{busy?'Claiming…':`Claim reward Rs. ${Number(task.reward).toLocaleString()}`}</button>:<button className="primary-btn" onClick={submitRating} disabled={busy}>{busy?'Submitting…':'Submit rating'}</button>}</section>}
   {error&&<p className="form-error">{error}</p>}
   {toast&&<div className="toast success-toast">{toast}</div>}
 </div></section></div>;
}
