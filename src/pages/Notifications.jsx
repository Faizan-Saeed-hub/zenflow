import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../services/api";

export default function Notifications(){
 const navigate=useNavigate(),[items,setItems]=useState([]),[filter,setFilter]=useState("All"),[error,setError]=useState("");
 const load=()=>api.notifications().then(r=>setItems(r.notifications||[])).catch(e=>setError(e.message));
 useEffect(()=>{load();},[]);
 const unread=items.filter(x=>!x.is_read).length;
 const visible=useMemo(()=>filter==="All"?items:items.filter(x=>x.type===filter),[items,filter]);
 const markAll=async()=>{await api.readAllNotifications();load();};
 const mark=async id=>{await api.readNotification(id);load();};
 return <section className="notifications-page">
  <div className="notifications-heading"><button className="round-back" onClick={()=>navigate(-1)}>‹</button><div><h1>Notifications</h1><p>{unread?`${unread} unread notification${unread===1?"":"s"}`:"You're all caught up"}</p></div>{unread>0&&<button className="read-all" onClick={markAll}>Mark all read</button>}</div>
  <div className="notification-tabs">{["All","System","Task","Reward","Team"].map(x=><button key={x} className={filter===x?"notification-tab active":"notification-tab"} onClick={()=>setFilter(x)}>{x}</button>)}</div>
  <div className="notification-list">{error?<div className="notification-empty"><strong>Unable to load notifications</strong><span>{error}</span></div>:visible.length?visible.map(x=><article key={x.id} className={x.is_read?"notification-item":"notification-item unread"} onClick={()=>!x.is_read&&mark(x.id)}><div className="notification-icon">{iconFor(x.type)}</div><div className="notification-body"><div className="notification-title-row"><strong>{x.title}</strong>{!x.is_read&&<span className="unread-dot" />}</div><p>{x.message}</p><small>{new Date(x.created_at).toLocaleString()}</small></div></article>):<div className="notification-empty"><strong>No notifications</strong><span>New updates will appear here.</span></div>}</div>
 </section>;
}
function iconFor(t){if(t==="Task")return"✓";if(t==="Reward")return"◆";if(t==="Team")return"♧";return"i";}
