import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../services/api";

export default function Team() {
  const navigate = useNavigate();
  const [view, setView] = useState("my-team");
  const [level, setLevel] = useState("A");
  const [data, setData] = useState({ referralCode: "", summary:{A:0,B:0,C:0}, total:0, teamEarnings:0, members:[] });
  const [error, setError] = useState("");

  const load = () => api.team().then(setData).catch(e => setError(e.message));
  useEffect(() => { load(); }, []);

  const selectedMembers = useMemo(
    () => level === "ABC" ? data.members : data.members.filter(m => m.level === ({A:1,B:2,C:3}[level])),
    [level,data.members]
  );
  const selectedCount = selectedMembers.length;
  const selectedEarnings = selectedMembers.reduce((sum,m)=>sum+Number(m.total_earned||0),0);

  return <section className="team-page">
    <div className="team-content">
      <header className="team-hero"><div><h1>My team</h1><span>Referral code {data.referralCode || "—"}</span></div></header>
      <section className="team-summary card">
        <div className="team-total-label">A / B / C total members</div>
        <div className="team-total">{data.total}</div>
        <div className="team-levels">
          {["A","B","C"].map(k=><button key={k} className={`team-level level-${k.toLowerCase()}`} onClick={()=>setLevel(k)}><span>Level {k}</span><strong>{data.summary[k]||0}</strong></button>)}
        </div>
      </section>

      <div className="team-view-tabs">
        <button className={view==="overview"?"active":""} onClick={()=>setView("overview")}>Team overview</button>
        <button className={view==="my-team"?"active":""} onClick={()=>setView("my-team")}>My team</button>
      </div>
      <div className="team-level-tabs">
        {["A","B","C"].map(k=><button key={k} className={level===k?"active":""} onClick={()=>setLevel(k)}>Level {k}</button>)}
        <button className={level==="ABC"?"active":""} onClick={()=>setLevel("ABC")}>A/B/C</button>
      </div>

      {view==="overview" ? <section className="team-overview card">
        <div><strong>{data.total}</strong><span>Total members</span></div>
        <div><strong>Rs. {Number(data.teamEarnings||0).toLocaleString()}</strong><span>Team members' earnings</span></div>
        <article><strong>Rs. {Number(selectedEarnings||0).toLocaleString()}</strong><span>Selected level earnings</span></article>
      </section> :
      <><section className="team-stats">
        <div className="card"><strong>{selectedCount}</strong><span>Members</span></div>
        <div className="card"><strong>Rs. {Number(selectedEarnings||0).toLocaleString()}</strong><span>Members' earnings</span></div>
      </section>
      <section className="team-empty card">
        {error ? <><strong>Unable to load team</strong><span>{error}</span></> :
        selectedMembers.length ? <div className="team-member-list">{selectedMembers.map(m=><div className="team-member" key={m.id}>
          <div><strong>{m.full_name || "Member"}</strong><span>{m.phone}</span><small>Level {String.fromCharCode(64+m.level)} · {m.plan_name || "No active plan"}</small></div>
          <div className="team-member-earning"><small>Total earned</small><b>Rs. {Number(m.total_earned||0).toLocaleString()}</b><small>Task earnings: Rs. {Number(m.task_earnings||0).toLocaleString()}</small></div>
        </div>)}</div> :
        <><strong>No team members yet</strong><span>Invite friends with your code and grow your team.</span></>}
      </section></>}
      <button className="invite-button" onClick={()=>navigate("/referral")}><span aria-hidden="true">♧</span> Invite more friends</button>
    </div>
  </section>;
}
