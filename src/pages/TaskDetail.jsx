import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../services/api";

const filler = (title) => [
  `${title} begins with a quiet moment that slowly reveals why ordinary days can carry the most memorable stories. The narrator notices a small detail, follows it through familiar places, and discovers that every simple choice has left a trace. The writing moves gently between present observation and remembered scenes, giving the chapter a reflective rhythm without losing its sense of movement.`,
  `As the story continues, the people around the narrator become part of the same unfolding picture. A conversation that seems unimportant at first changes the meaning of an earlier event, while a second character offers a different way of looking at the same problem. The details remain grounded in everyday life, but the emotional weight grows as the characters begin to understand what they have been avoiding.`,
  `The middle section is built from small changes rather than sudden turns. A familiar street looks different after sunset, an old message is read again, and a promise made years earlier begins to matter. These scenes give the reader time to notice the connections between memory, responsibility, and hope. The language stays accessible while allowing the mood to deepen from one paragraph to the next.`,
  `Near the end, the narrator finally sorts through the things that were left unfinished. Objects that appeared earlier return with a new meaning, and the final conversation gives the story its calmest and most direct moment. The result is less about a dramatic ending and more about seeing an ordinary life with greater honesty.`,
  `After everything is settled, the narrator looks back at the journey and recognizes how much changed through small acts of patience. The final pages leave a feeling of closure without closing every possible door. What remains is a simple idea: people can carry difficult memories without being defined by them, and a thoughtful choice today can make tomorrow feel lighter.`
];

export default function TaskDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [task, setTask] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState("");

  useEffect(() => {
    api.task(id)
      .then(({ task: t }) => setTask(t))
      .catch((e) => setError(e.message));
  }, [id]);

  if (error) return <div className="empty-task">{error}</div>;
  if (!task) return <div className="app-loading">Loading task…</div>;

  if (task.locked) {
    return (
      <div className="task-detail-overlay">
        <section className="task-detail-modal">
          <header>
            <strong>{task.title}</strong>
            <button onClick={() => navigate(-1)}>×</button>
          </header>
          <div className="detail-scroll">
            <div className="locked-task-panel">
              <div>🔒</div>
              <h2>{task.plan_required} plan required</h2>
              <p>Activate the required plan to unlock this review and earn its reward.</p>
              <button className="primary-btn" onClick={() => navigate("/plans")}>
                View plans
              </button>
            </div>
          </div>
        </section>
      </div>
    );
  }

  const completed = task.submission_status === "approved";
  const content =
    task.description && task.description.length > 500
      ? task.description.split(/\n+/)
      : filler(task.title);

  const handleComplete = async () => {
    setBusy(true);
    setError("");
    try {
      const r = await api.completeTask(task.id);
      const reward = Number(r.reward || task.reward || 30);
      setTask((t) => ({ ...t, submission_status: "approved" }));
      setToast(`✓ Rs. ${reward.toLocaleString()} credited directly to your Commission Wallet!`);
      setTimeout(() => navigate("/tasks"), 1200);
    } catch (e) {
      setError(e.message || "Failed to complete task.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="task-detail-overlay">
      <section className="task-detail-modal">
        <header>
          <strong>{task.title}</strong>
          <button onClick={() => navigate("/tasks")}>×</button>
        </header>
        <div className="detail-scroll">
          <img className="detail-cover" src={task.image_url} alt={task.title} />
          <h1>{task.title}</h1>
          <p>
            Reward Rs. {Number(task.reward || 30).toLocaleString()} · {task.plan_required || "Active plan"}
          </p>

          <article className="reading-article">
            {content.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
            <div className="the-end">— The End —</div>
          </article>

          {!completed ? (
            <button
              className="primary-btn"
              onClick={handleComplete}
              disabled={busy}
              style={{
                fontSize: "15px",
                fontWeight: 700,
                background: "#008747",
                padding: "14px",
                borderRadius: "10px",
                marginTop: "16px"
              }}
            >
              {busy ? "Submitting…" : `⚡ Submit Task & Earn Rs. ${Number(task.reward || 30).toLocaleString()}`}
            </button>
          ) : (
            <div className="reward-success" style={{ marginTop: "16px" }}>
              ✓ Task Completed · Rs. {Number(task.reward || 30).toLocaleString()} credited to your wallet
            </div>
          )}

          {error && <p className="form-error" style={{ marginTop: "12px" }}>{error}</p>}
          {toast && <div className="toast success-toast" style={{ marginTop: "12px" }}>{toast}</div>}
        </div>
      </section>
    </div>
  );
}
