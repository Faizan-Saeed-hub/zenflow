import { useState } from "react";
import { api, setSession } from "../services/api";

export default function AdminLogin() {
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await api.login({ phone: phone.trim(), password });
      if (data?.user?.role !== "admin") {
        throw new Error("This account does not have admin access.");
      }
      setSession(data);
      window.location.assign("/admin");
    } catch (err) {
      console.error("Admin login failed:", err);
      setError(err?.message || "Unable to log in.");
      setLoading(false);
    }
  };

  return <section className="admin-login-page">
    <form className="admin-login-card" onSubmit={submit}>
      <div className="admin-brand">Z</div>
      <h1>ZenFlow Admin</h1>
      <p>Secure Administration Portal</p>
      <label>Admin phone<input type="text" value={phone} onChange={e=>setPhone(e.target.value)} autoComplete="username" placeholder="Enter phone number" required /></label>
      <label>Password<input type="password" value={password} onChange={e=>setPassword(e.target.value)} autoComplete="current-password" placeholder="Enter password" required /></label>
      {error && <div className="admin-error">{error}</div>}
      <button type="submit" disabled={loading}>{loading ? "Signing in…" : "Open Admin Panel"}</button>
    </form>
  </section>;
}
