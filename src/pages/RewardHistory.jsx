import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, getCachedData } from "../services/api";

export default function RewardHistory() {
  const navigate = useNavigate();
  const [tab, setTab] = useState("task"); // 'task' | 'commission' | 'all'
  const [data, setData] = useState(() => getCachedData("rewards") || { rewards: [], taskRewards: [], teamCommissions: [], total: 0, taskTotal: 0, commissionTotal: 0, count: 0 });
  const [error, setError] = useState("");

  useEffect(() => {
    api.rewards().then(setData).catch((e) => setError(e.message));
  }, []);

  const visibleList = useMemo(() => {
    if (tab === "task") {
      return data.rewards.filter((x) => x.type === "Task" || x.type === "Check-in");
    }
    if (tab === "commission") {
      return data.rewards.filter((x) => x.type === "Referral" || x.type === "Commission" || x.type === "Team");
    }
    return data.rewards;
  }, [data, tab]);

  const currentTotal = useMemo(() => {
    if (tab === "task") return data.taskTotal || visibleList.reduce((s, r) => s + Number(r.amount || 0), 0);
    if (tab === "commission") return data.commissionTotal || visibleList.reduce((s, r) => s + Number(r.amount || 0), 0);
    return data.total || 0;
  }, [data, tab, visibleList]);

  return (
    <section className="reward-page">
      <div className="reward-heading">
        <button className="round-back" onClick={() => navigate(-1)}>‹</button>
        <div>
          <h1>Reward History</h1>
          <p>Track your task earnings and team commissions</p>
        </div>
      </div>

      <div className="reward-summary" style={{ gridTemplateColumns: "repeat(2, 1fr)" }}>
        <div>
          <span>{tab === "task" ? "Task Earnings Total" : tab === "commission" ? "Team Commission Total" : "All Total Earnings"}</span>
          <strong>Rs. {Number(currentTotal).toFixed(2)}</strong>
        </div>
        <div>
          <span>Total Records</span>
          <strong>{visibleList.length}</strong>
        </div>
      </div>

      {/* Distinct separated tabs */}
      <div className="reward-tabs" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "6px" }}>
        <button
          className={tab === "task" ? "reward-tab active" : "reward-tab"}
          onClick={() => setTab("task")}
        >
          Task Rewards
        </button>
        <button
          className={tab === "commission" ? "reward-tab active" : "reward-tab"}
          onClick={() => setTab("commission")}
        >
          Team Commission
        </button>
        <button
          className={tab === "all" ? "reward-tab active" : "reward-tab"}
          onClick={() => setTab("all")}
        >
          All Activity
        </button>
      </div>

      <div className="reward-list">
        {error ? (
          <div className="reward-empty">
            <strong>Unable to load rewards</strong>
            <span>{error}</span>
          </div>
        ) : visibleList.length ? (
          visibleList.map((x) => (
            <article className="reward-item" key={x.id}>
              <div className="reward-mark" style={{ background: x.type === "Task" ? "#e6f7ee" : "#eef4ff", color: x.type === "Task" ? "#008747" : "#1e60d5" }}>
                {x.type === "Task" ? "📝" : "👥"}
              </div>
              <div className="reward-info">
                <strong>{x.type === "Task" ? "Book Review Task Reward" : x.type === "Referral" ? "Subordinate Commission" : x.type}</strong>
                <span>{x.detail}</span>
                <small>{new Date(x.created_at).toLocaleString()}</small>
              </div>
              <div className="reward-amount">
                <strong style={{ color: x.type === "Task" ? "#008747" : "#1e60d5" }}>
                  +Rs. {Number(x.amount).toFixed(2)}
                </strong>
                <span>{x.status || "Completed"}</span>
              </div>
            </article>
          ))
        ) : (
          <div className="reward-empty">
            <strong>No {tab === "task" ? "task reward" : tab === "commission" ? "team commission" : "reward"} records</strong>
            <span>
              {tab === "task"
                ? "Complete daily book reviews to earn task rewards."
                : tab === "commission"
                ? "When your invited team members complete tasks, commissions appear here."
                : "Your earning history will appear here."}
            </span>
          </div>
        )}
      </div>
    </section>
  );
}
