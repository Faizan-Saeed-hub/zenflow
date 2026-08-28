import { useEffect, useMemo, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { api, getCachedData } from "../services/api";

const fallbackImages = {
  "Glass Orchard": "/zenflow-images/task-cards/book-letters-to-shirin.png",
  "Midnight Street": "/zenflow-images/task-cards/book-midnight-bakery.png",
  "Silent Harbor": "/zenflow-images/task-cards/book-winter-swimmers.png",
  "Winter Sparrow": "/zenflow-images/task-cards/book-clockwork-orchid.png",
  "Kite City": "/zenflow-images/task-cards/book-the-blue-hour.png",
  "Blue Hour": "/zenflow-images/task-cards/book-the-blue-hour.png",
  "Golden Orchid": "/zenflow-images/task-cards/book-clockwork-orchid.png"
};

export default function Tasks() {
  const navigate = useNavigate();
  const [tab, setTab] = useState("Today");
  const [tasks, setTasks] = useState(() => getCachedData("tasks")?.tasks || []);
  const [meta, setMeta] = useState(() => getCachedData("tasks")?.meta || { dailyLimit: 5, completedToday: 0, remaining: 5, todayEarnings: 0 });
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [busyTaskId, setBusyTaskId] = useState(null);

  const load = () =>
    api.tasks().then(({ tasks: t, meta: m }) => {
      setTasks(t || []);
      setMeta(m || meta);
    }).catch((e) => setError(e.message));

  useEffect(() => {
    if (tab === "Completed") {
      api.completedTasks().then(({ tasks: t }) => setTasks(t || [])).catch((e) => setError(e.message));
    } else {
      load();
    }
  }, [tab]);

  const handleInstantComplete = async (taskId, rewardAmount) => {
    if (busyTaskId) return;
    setBusyTaskId(taskId);
    setError("");

    try {
      const res = await api.completeTask(taskId);
      const earned = Number(res.reward || rewardAmount || 30);

      // Instant optimistic update
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, submission_status: "approved" } : t))
      );
      setMeta((prev) => ({
        ...prev,
        completedToday: (prev.completedToday || 0) + 1,
        remaining: Math.max(0, (prev.remaining || 1) - 1),
        todayEarnings: (prev.todayEarnings || 0) + earned
      }));
      
      // Refresh user account balance in background
      api.me().catch(() => {});

      setToast(`🎉 Task completed! Rs. ${earned.toLocaleString()} credited to your Commission Wallet.`);
      setTimeout(() => setToast(""), 4000);
      load();
    } catch (err) {
      setError(err.message || "Failed to complete task.");
    } finally {
      setBusyTaskId(null);
    }
  };

  const visible = useMemo(
    () => (tab === "Completed" ? tasks : tasks.filter((t) => t.submission_status !== "approved")),
    [tab, tasks]
  );

  return (
    <div className="tasks-page">
      <header className="tasks-banner">
        <div>
          <strong>Book review tasks</strong>
          <span>
            {meta.trialExpired
              ? "3-day trial finished"
              : `${meta.remaining} of ${meta.dailyLimit} daily book reviews left today`}
          </span>
        </div>
        <div className="today-earnings">
          <small>Today's earnings</small>
          <b>Rs. {Number(meta.todayEarnings || 0).toLocaleString()}</b>
        </div>
      </header>

      <main className="tasks-content">
        <section className="plan-strip">
          <div className="plan-icon">♛</div>
          <div className="plan-copy">
            <strong>
              {meta.plan?.name ||
                (meta.trialExpired ? "Intern trial ended" : `Intern trial (Day ${meta.trialDay || 1}/3)`)}
            </strong>
            <span>
              {meta.trialExpired
                ? "Trial period completed"
                : `${meta.completedToday} of ${meta.dailyLimit} completed today · Rs. ${Number(meta.todayEarnings || 0).toLocaleString()} earned`}
            </span>
          </div>
          <NavLink to="/plans">View plans</NavLink>
        </section>

        {meta.trialExpired && (
          <div
            style={{
              background: "#fff5f5",
              border: "1px solid #fed7d7",
              borderRadius: "12px",
              padding: "14px 16px",
              marginBottom: "16px",
              color: "#c53030"
            }}
          >
            <strong>⏳ Your 3-Day Free Intern Trial Has Ended</strong>
            <p style={{ margin: "4px 0 10px", fontSize: "13px", color: "#742a2a" }}>
              Activate an official F-Plan to unlock unlimited daily tasks, higher income, and team commissions.
            </p>
            <button
              className="primary-btn"
              style={{ width: "auto", padding: "8px 20px", minHeight: "38px", margin: 0, fontSize: "13px" }}
              onClick={() => navigate("/plans")}
            >
              Upgrade to F-Plan
            </button>
          </div>
        )}

        {toast && <div className="toast success-toast" style={{ marginBottom: "12px" }}>{toast}</div>}

        <div className="task-tabs">
          {["Today", "Completed", "Library"].map((item) => (
            <button
              key={item}
              className={tab === item ? "selected" : ""}
              onClick={() => (item === "Library" ? navigate("/tasks/library") : setTab(item))}
            >
              {item}
            </button>
          ))}
        </div>

        {error && <div className="form-error">{error}</div>}

        <section className="task-grid">
          {visible.map((task) => {
            const done = task.submission_status === "approved";
            const isBusy = busyTaskId === task.id;
            return (
              <article className="task-card" key={task.id}>
                <div className="task-image-wrap" onClick={() => !done && navigate(`/tasks/view/${task.id}`)} style={{ cursor: done ? "default" : "pointer" }}>
                  <img
                    src={fallbackImages[task.title] || task.image_url || "/zenflow-images/task-cards/book-letters-to-shirin.png"}
                    alt={task.title}
                  />
                  <div className="task-image-title">
                    <strong>{task.title}</strong>
                    <small>BOOK REVIEW</small>
                  </div>
                </div>
                <div className="task-card-body">
                  <strong onClick={() => !done && navigate(`/tasks/view/${task.id}`)} style={{ cursor: done ? "default" : "pointer" }}>{task.title}</strong>
                  <small>Book Review</small>
                  <div className="reward-row">
                    <span>{done ? "Reward earned" : "Reward"}</span>
                    <b>Rs. {Number(task.reward || 30).toLocaleString()}</b>
                  </div>
                  <button
                    className={done ? "read-button done" : "read-button"}
                    disabled={done || isBusy}
                    onClick={() => {
                      if (!done) handleInstantComplete(task.id, task.reward);
                    }}
                    style={{
                      background: done ? "#e2e8f0" : "#008747",
                      color: done ? "#64748b" : "#ffffff",
                      fontWeight: 700,
                      cursor: done ? "default" : "pointer"
                    }}
                  >
                    {done ? "✓ Completed (+Rs. " + Number(task.reward || 30).toLocaleString() + ")" : isBusy ? "Submitting…" : "⚡ Submit Task (+Rs. " + Number(task.reward || 30).toLocaleString() + ")"}
                  </button>
                </div>
              </article>
            );
          })}
          {!visible.length && (
            <div className="empty-task">
              {meta.trialExpired
                ? "Your 3-day Intern trial has ended. Please activate a plan."
                : tab === "Completed"
                ? "No completed reviews yet."
                : "No reviews left for today."}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
