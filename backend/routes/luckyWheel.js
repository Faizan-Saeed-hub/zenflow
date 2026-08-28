import express from "express";
import { getPool } from "../config/db.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

const DEFAULT_SEGMENTS = [50, 100, 200, 300, 450, 500, 550, 600, 650, 700];

async function getSetting(key, fallback) {
  try {
    const [[row]] = await getPool().query(
      "SELECT setting_val FROM lucky_wheel_settings WHERE setting_key = ? LIMIT 1",
      [key]
    );
    if (row && row.setting_val) {
      try {
        return JSON.parse(row.setting_val);
      } catch (_) {
        return row.setting_val;
      }
    }
  } catch (_) {}
  return fallback;
}

// User: Get wheel status, available spins, segments, and winning history
router.get("/", requireAuth, async (req, res) => {
  const userId = req.user.id;
  const db = getPool();
  try {
    const [[spinRow]] = await db.query(
      "SELECT spins_available FROM lucky_spins WHERE user_id = ? LIMIT 1",
      [userId]
    );
    const spinsAvailable = spinRow ? Number(spinRow.spins_available || 0) : 0;

    const segments = await getSetting("wheel_segments", DEFAULT_SEGMENTS);

    const [history] = await db.query(
      "SELECT id, amount_won, created_at FROM lucky_spin_logs WHERE user_id = ? ORDER BY id DESC LIMIT 10",
      [userId]
    );

    res.json({
      spinsAvailable,
      segments: Array.isArray(segments) && segments.length === 10 ? segments : DEFAULT_SEGMENTS,
      history
    });
  } catch (err) {
    console.error("Lucky wheel error:", err);
    res.status(500).json({ message: "Unable to load lucky wheel details." });
  }
});

// User: Spin the wheel and claim prize
router.post("/spin", requireAuth, async (req, res) => {
  const userId = req.user.id;
  const db = getPool();
  const conn = await db.getConnection();

  try {
    await conn.beginTransaction();

    const [[spinRow]] = await conn.query(
      "SELECT spins_available, assigned_amount FROM lucky_spins WHERE user_id = ? FOR UPDATE",
      [userId]
    );

    const spinsAvailable = spinRow ? Number(spinRow.spins_available || 0) : 0;
    if (spinsAvailable < 1) {
      await conn.rollback();
      return res.status(400).json({
        message: "You have 0 available spins. Contact admin to receive spins!"
      });
    }

    const rawSegments = await getSetting("wheel_segments", DEFAULT_SEGMENTS);
    const segments = (Array.isArray(rawSegments) ? rawSegments : DEFAULT_SEGMENTS).map((s) => Number(s));
    const defaultWin = Number(await getSetting("default_win_amount", 100));

    let amountWon = defaultWin;
    if (spinRow && spinRow.assigned_amount !== null && Number(spinRow.assigned_amount) > 0) {
      amountWon = Number(spinRow.assigned_amount);
    }

    // Find the exact target segment index for the wheel landing
    let segmentIndex = segments.findIndex((amt) => Number(amt) === Number(amountWon));
    if (segmentIndex === -1) {
      // Find closest segment or fallback to first segment
      segmentIndex = 0;
      let minDiff = Math.abs(segments[0] - amountWon);
      for (let i = 1; i < segments.length; i++) {
        const diff = Math.abs(segments[i] - amountWon);
        if (diff < minDiff) {
          minDiff = diff;
          segmentIndex = i;
        }
      }
    }

    const newSpins = spinsAvailable - 1;
    await conn.query(
      `UPDATE lucky_spins
       SET spins_available = ?,
           assigned_amount = IF(? = 0, NULL, assigned_amount)
       WHERE user_id = ?`,
      [newSpins, newSpins, userId]
    );

    // Credit amount won to user's commission/reward wallet
    await conn.query(
      "UPDATE users SET commission_balance = commission_balance + ?, total_earned = total_earned + ? WHERE id = ?",
      [amountWon, amountWon, userId]
    );

    // Log the spin
    await conn.query(
      "INSERT INTO lucky_spin_logs (user_id, amount_won) VALUES (?, ?)",
      [userId, amountWon]
    );

    // Log into reward_history if exists
    try {
      await conn.query(
        "INSERT INTO reward_history (user_id, type, detail, amount, status) VALUES (?, 'Adjustment', 'Lucky Draw Wheel Cash Prize', ?, 'Completed')",
        [userId, amountWon]
      );
    } catch (_) {}

    await conn.commit();

    res.json({
      success: true,
      amountWon,
      segmentIndex,
      spinsRemaining: newSpins,
      message: `🎉 Congratulations! You won Rs. ${Number(amountWon).toLocaleString()}!`
    });
  } catch (err) {
    await conn.rollback();
    console.error("Spin execution error:", err);
    res.status(500).json({ message: "Unable to process spin: " + err.message });
  } finally {
    conn.release();
  }
});

export default router;
