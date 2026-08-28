import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import logo from "../assets/zenflow-logo.png";

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [form, setForm] = useState({ phone: "", password: "" });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const savedPhone = localStorage.getItem("zen.rememberedPhone");
    if (savedPhone) setForm((current) => ({ ...current, phone: savedPhone }));
  }, []);

  const update = (key) => (event) => {
    setForm((current) => ({ ...current, [key]: event.target.value }));
    setError("");
  };

  const submit = async (event) => {
    event.preventDefault();
    const cleanPhone = form.phone.trim();
    if (!cleanPhone || !form.password) {
      setError("Please enter your phone number and password.");
      return;
    }
    if (!/^03\d{9}$/.test(cleanPhone) && !/^\d{11}$/.test(cleanPhone)) {
      setError("Phone number must be exactly 11 digits (e.g. 03001234567).");
      return;
    }

    if (remember) localStorage.setItem("zen.rememberedPhone", cleanPhone);
    else localStorage.removeItem("zen.rememberedPhone");

    setError("");
    setSubmitting(true);
    try {
      await login({ phone: cleanPhone, password: form.password });
      navigate("/home", { replace: true });
    } catch (err) {
      setError(err.message || "Unable to log in.");
    } finally {
      setSubmitting(false);
    }
  };

  const [showForgotNotice, setShowForgotNotice] = useState(false);

  return (
    <main className="login-page">
      <div className="hex-bg login-hex-bg" aria-hidden="true" />
      <section className="login-content">
        <header className="login-heading">
          <img src={logo} alt="ZenFlow" className="login-logo" />
          <h1>Welcome back</h1>
          <p>Sign in with your phone number</p>
        </header>

        <form className="login-card" onSubmit={submit} noValidate>
          <FieldLabel>Phone Number</FieldLabel>
          <div className="input-shell login-input phone-shell">
            <span className="field-icon phone-icon" aria-hidden="true">⌕</span>
            <select aria-label="Country code" defaultValue="PK +92">
              <option>PK +92</option>
            </select>
            <input value={form.phone} onChange={update("phone")} inputMode="tel" placeholder="Enter your phone number" autoComplete="tel" />
          </div>

          <FieldLabel>Password</FieldLabel>
          <div className="input-shell login-input">
            <span className="field-icon key-icon" aria-hidden="true">⚿</span>
            <input type={showPassword ? "text" : "password"} value={form.password} onChange={update("password")} placeholder="Enter your password" autoComplete="current-password" />
            <button type="button" className="eye-button login-eye" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Hide password" : "Show password"}>
              {showPassword ? "◉" : "◎"}
            </button>
          </div>

          <div className="login-options">
            <label className="remember-label">
              <input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} />
              <span>Remember me</span>
            </label>
            <button
              type="button"
              className="forgot-button"
              onClick={() => setShowForgotNotice((prev) => !prev)}
            >
              Forgot password?
            </button>
          </div>

          {showForgotNotice && (
            <div style={{ background: "#f1f8f4", border: "1px solid #c9e4d5", borderRadius: "10px", padding: "10px 12px", marginBottom: "14px", fontSize: "12px", color: "#255338", lineHeight: 1.4, animation: "fadeIn 0.2s ease" }}>
              💡 <strong>Forgot Password?</strong> Please contact the <strong>Admin / Customer Support</strong> to verify your identity and receive a secure password reset.
            </div>
          )}

          {error && <p className="login-error" role="alert">{error}</p>}

          <button className="login-button" type="submit" disabled={submitting}>{submitting ? "Signing in…" : "Login Now"}</button>
        </form>

        <p className="register-prompt">Don't have a ZenFlow account? <Link to="/create-account">Register Now</Link></p>
      </section>
    </main>
  );
}

function FieldLabel({ children }) {
  return <label className="field-label">{children}</label>;
}
