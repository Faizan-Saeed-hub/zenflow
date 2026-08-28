import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { api, getCachedData } from "../services/api";

const DEFAULT_SEGMENTS = [50, 100, 200, 300, 450, 500, 550, 600, 650, 700];

const SEGMENT_COLORS = [
  "#10b981", // Emerald
  "#3b82f6", // Blue
  "#f59e0b", // Amber
  "#8b5cf6", // Purple
  "#ec4899", // Pink
  "#06b6d4", // Cyan
  "#f97316", // Orange
  "#14b8a6", // Teal
  "#e11d48", // Rose
  "#eab308"  // Gold
];

export default function LuckyWheel() {
  const navigate = useNavigate();
  const [spinsAvailable, setSpinsAvailable] = useState(() => getCachedData("lucky_spins_count") ?? 0);
  const [segments, setSegments] = useState(DEFAULT_SEGMENTS);
  const [history, setHistory] = useState([]);
  const [isSpinning, setIsSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [winModal, setWinModal] = useState(null);
  const [error, setError] = useState("");
  const totalRotationRef = useRef(0);

  const loadStatus = async () => {
    try {
      const data = await api.luckyWheelStatus();
      setSpinsAvailable(data.spinsAvailable || 0);
      if (Array.isArray(data.segments) && data.segments.length === 10) {
        setSegments(data.segments);
      }
      setHistory(data.history || []);
    } catch (err) {
      console.error("Load lucky wheel status error:", err);
    }
  };

  useEffect(() => {
    loadStatus();
  }, []);

  const handleSpin = async () => {
    if (isSpinning) return;
    if (spinsAvailable < 1) {
      setError("You have 0 available spins. Complete a deposit or contact admin to receive spins!");
      return;
    }

    setError("");
    setIsSpinning(true);

    try {
      const result = await api.luckyWheelSpin();
      const numSegments = segments.map((s) => Number(s));
      const segmentAngle = 360 / (numSegments.length || 10);
      const targetIndex = result.segmentIndex !== undefined ? result.segmentIndex : 0;
      const prizeWon = result.amountWon;

      // Segment i center is located at (i * segmentAngle + segmentAngle / 2) from 12 o'clock.
      // To align segment i center exactly under the top pointer (0 deg):
      const targetAngleInCircle = (360 - (targetIndex * segmentAngle + segmentAngle / 2)) % 360;
      const currentAngleInCircle = totalRotationRef.current % 360;
      const deltaAngle = (targetAngleInCircle - currentAngleInCircle + 360) % 360;
      const baseSpins = 360 * 6; // 6 clean full rotations

      const nextRotation = totalRotationRef.current + baseSpins + deltaAngle;
      totalRotationRef.current = nextRotation;
      setRotation(nextRotation);

      // Wait exactly 5 seconds for the spin animation to complete
      setTimeout(() => {
        setIsSpinning(false);
        setSpinsAvailable(result.spinsRemaining);
        setWinModal(prizeWon);
        loadStatus(); // refresh history & balances
      }, 5000);
    } catch (err) {
      setIsSpinning(false);
      setError(err.message || "Failed to spin wheel.");
    }
  };

  return (
    <section className="feature-page lucky-wheel-page" style={{ maxWidth: "560px", margin: "0 auto", paddingBottom: "40px" }}>
      <header className="feature-header">
        <button className="round-back" onClick={() => navigate(-1)}>‹</button>
        <div>
          <h1>🎡 Lucky Draw Wheel</h1>
          <p>Spin to win instant cash prizes to your wallet!</p>
        </div>
      </header>

      {error && <div className="toast error-toast" style={{ margin: "12px 0" }}>{error}</div>}

      {/* Spins Available Highlight Badge */}
      <div
        style={{
          background: "linear-gradient(135deg, #008747 0%, #006030 100%)",
          color: "#fff",
          borderRadius: "14px",
          padding: "16px 20px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "20px",
          boxShadow: "0 4px 14px rgba(0, 135, 71, 0.25)"
        }}
      >
        <div>
          <span style={{ fontSize: "12px", opacity: 0.85, textTransform: "uppercase", letterSpacing: "0.5px" }}>Available Spins</span>
          <h2 style={{ margin: "2px 0 0", fontSize: "26px", fontWeight: 800 }}>
            {spinsAvailable} <span style={{ fontSize: "14px", fontWeight: 500 }}>{spinsAvailable === 1 ? "Spin Left" : "Spins Left"}</span>
          </h2>
        </div>
        <div
          style={{
            background: "rgba(255, 255, 255, 0.2)",
            padding: "8px 14px",
            borderRadius: "10px",
            fontSize: "13px",
            fontWeight: 700
          }}
        >
          🎁 100% Cash Prize
        </div>
      </div>

      {/* Wheel Container */}
      <div
        style={{
          position: "relative",
          width: "320px",
          height: "320px",
          margin: "0 auto 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center"
        }}
      >
        {/* Top Needle / Pointer */}
        <div
          style={{
            position: "absolute",
            top: "-14px",
            left: "50%",
            transform: "translateX(-50%)",
            width: "0",
            height: "0",
            borderLeft: "16px solid transparent",
            borderRight: "16px solid transparent",
            borderTop: "28px solid #f59e0b",
            filter: "drop-shadow(0 4px 6px rgba(0,0,0,0.3))",
            zIndex: 10
          }}
        />

        {/* Outer Wheel Golden Ring */}
        <div
          style={{
            position: "absolute",
            width: "324px",
            height: "324px",
            borderRadius: "50%",
            border: "8px solid #f59e0b",
            boxShadow: "0 0 20px rgba(245, 158, 11, 0.4), inset 0 0 10px rgba(0,0,0,0.2)",
            pointerEvents: "none",
            zIndex: 5
          }}
        />

        {/* Rotating Wheel Canvas / SVG */}
        <div
          style={{
            width: "300px",
            height: "300px",
            borderRadius: "50%",
            overflow: "hidden",
            transition: isSpinning ? "transform 5s cubic-bezier(0.15, 0.9, 0.2, 1)" : "none",
            transform: `rotate(${rotation}deg)`,
            boxShadow: "0 6px 20px rgba(0,0,0,0.15)",
            position: "relative"
          }}
        >
          <svg viewBox="0 0 300 300" width="300" height="300">
            {segments.map((amt, idx) => {
              const angle = 360 / segments.length;
              const startAngle = idx * angle - 90;
              const endAngle = (idx + 1) * angle - 90;

              const startRad = (startAngle * Math.PI) / 180;
              const endRad = (endAngle * Math.PI) / 180;

              const x1 = 150 + 150 * Math.cos(startRad);
              const y1 = 150 + 150 * Math.sin(startRad);
              const x2 = 150 + 150 * Math.cos(endRad);
              const y2 = 150 + 150 * Math.sin(endRad);

              const pathData = `M 150 150 L ${x1} ${y1} A 150 150 0 0 1 ${x2} ${y2} Z`;

              // Text position along radius
              const textAngle = startAngle + angle / 2;
              const textRad = (textAngle * Math.PI) / 180;
              const textX = 150 + 95 * Math.cos(textRad);
              const textY = 150 + 95 * Math.sin(textRad);

              return (
                <g key={idx}>
                  <path d={pathData} fill={SEGMENT_COLORS[idx % SEGMENT_COLORS.length]} />
                  <text
                    x={textX}
                    y={textY}
                    fill="#ffffff"
                    fontSize="13"
                    fontWeight="800"
                    textAnchor="middle"
                    dominantBaseline="central"
                    transform={`rotate(${textAngle + 90}, ${textX}, ${textY})`}
                    style={{ textShadow: "0 1px 3px rgba(0,0,0,0.4)" }}
                  >
                    Rs.{amt}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        {/* Center SPIN Button */}
        <button
          type="button"
          onClick={handleSpin}
          disabled={isSpinning || spinsAvailable < 1}
          style={{
            position: "absolute",
            width: "74px",
            height: "74px",
            borderRadius: "50%",
            background: spinsAvailable > 0 && !isSpinning ? "radial-gradient(circle, #f59e0b 0%, #d97706 100%)" : "#94a3b8",
            border: "4px solid #ffffff",
            color: "#ffffff",
            fontWeight: "900",
            fontSize: "15px",
            letterSpacing: "0.5px",
            cursor: isSpinning || spinsAvailable < 1 ? "not-allowed" : "pointer",
            boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
            zIndex: 8,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: 0
          }}
        >
          {isSpinning ? "..." : "SPIN"}
        </button>
      </div>

      {/* Main Action Button */}
      <div style={{ textAlign: "center", marginBottom: "24px" }}>
        <button
          type="button"
          className="primary-btn"
          onClick={handleSpin}
          disabled={isSpinning || spinsAvailable < 1}
          style={{
            width: "100%",
            fontSize: "16px",
            fontWeight: 700,
            padding: "14px 20px",
            background: spinsAvailable > 0 && !isSpinning ? "#008747" : "#94a3b8"
          }}
        >
          {isSpinning ? "🎡 Spinning Wheel..." : spinsAvailable > 0 ? `🎯 Spin Now (${spinsAvailable} left)` : "🔒 No Spins Available"}
        </button>
      </div>

      {/* Rules & Rewards Notice */}
      <section className="feature-card" style={{ marginBottom: "20px" }}>
        <h3 style={{ margin: "0 0 10px", fontSize: "15px", color: "#1e293b" }}>📜 Lucky Wheel Rules</h3>
        <ul style={{ margin: 0, paddingLeft: "20px", color: "#64748b", fontSize: "13px", lineHeight: "1.7" }}>
          <li>Every spin wins a guaranteed cash reward between <strong>Rs. 50 and Rs. 700</strong>.</li>
          <li>Winnings are automatically credited to your <strong>Commission / Reward Wallet</strong> instantly.</li>
          <li>Spins are assigned to eligible users and recharge depositors by the platform admin.</li>
        </ul>
      </section>

      {/* Winning History */}
      <section className="feature-card">
        <h3 style={{ margin: "0 0 12px", fontSize: "15px", color: "#1e293b" }}>🏆 Your Lucky Spin History</h3>
        {history.length === 0 ? (
          <p style={{ color: "#94a3b8", fontSize: "13px", margin: 0 }}>No spins yet. Use your available spins to win cash rewards!</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {history.map((item) => (
              <div
                key={item.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "10px 12px",
                  background: "#f8fafc",
                  borderRadius: "8px",
                  border: "1px solid #e2e8f0"
                }}
              >
                <div>
                  <strong style={{ color: "#0f172a", fontSize: "14px" }}>🎉 Won Rs. {Number(item.amount_won).toLocaleString()}</strong>
                  <small style={{ display: "block", color: "#64748b", fontSize: "11px" }}>
                    {item.created_at ? new Date(item.created_at).toLocaleString() : "Recently"}
                  </small>
                </div>
                <span
                  style={{
                    background: "#dcfce7",
                    color: "#166534",
                    fontSize: "12px",
                    fontWeight: 700,
                    padding: "3px 8px",
                    borderRadius: "6px"
                  }}
                >
                  Credited
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Winner Modal Celebration Popup */}
      {winModal !== null && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0, 0, 0, 0.7)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: "20px"
          }}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: "20px",
              padding: "28px 24px",
              maxWidth: "380px",
              width: "100%",
              textAlign: "center",
              boxShadow: "0 10px 30px rgba(0,0,0,0.3)",
              animation: "popIn 0.3s ease-out"
            }}
          >
            <div style={{ fontSize: "52px", marginBottom: "10px" }}>🎉</div>
            <h2 style={{ margin: "0 0 6px", fontSize: "22px", color: "#166534", fontWeight: 800 }}>
              Congratulations!
            </h2>
            <p style={{ margin: "0 0 16px", color: "#475569", fontSize: "14px" }}>
              You won the lucky wheel cash reward:
            </p>
            <div
              style={{
                background: "#ecfdf5",
                border: "2px dashed #10b981",
                borderRadius: "12px",
                padding: "14px",
                marginBottom: "20px"
              }}
            >
              <span style={{ fontSize: "32px", fontWeight: 900, color: "#065f46" }}>
                Rs. {Number(winModal).toLocaleString()}
              </span>
              <small style={{ display: "block", color: "#047857", fontWeight: 600, marginTop: "4px" }}>
                ✓ Credited to your Commission / Reward Wallet
              </small>
            </div>
            <button
              type="button"
              className="primary-btn"
              onClick={() => setWinModal(null)}
              style={{ width: "100%", padding: "12px", fontSize: "15px", fontWeight: 700 }}
            >
              Claim &amp; Continue
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
