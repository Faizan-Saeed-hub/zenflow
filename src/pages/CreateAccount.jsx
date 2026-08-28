import { useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import logo from "../assets/zenflow-logo.png";

function makeCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 5 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

export default function CreateAccount() {
  const navigate = useNavigate();
  const location = useLocation();
  const { register } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [code, setCode] = useState(makeCode);
  const [form, setForm] = useState(() => ({ phone: "", password: "", confirm: "", verification: "", invitation: new URLSearchParams(location.search).get("ref") || "" }));
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const isValid = useMemo(() => (
    form.phone.trim() &&
    form.password &&
    form.confirm &&
    form.verification.trim() &&
    form.password === form.confirm
  ), [form]);

  const update = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));

  const submit = async (event) => {
    event.preventDefault();
    const cleanPhone = form.phone.trim();
    if (!cleanPhone || !form.password || !form.confirm || !form.verification.trim()) {
      return setError("Please complete all required fields.");
    }
    if (!/^03\d{9}$/.test(cleanPhone) && !/^\d{11}$/.test(cleanPhone)) {
      return setError("Phone number must be exactly 11 digits (e.g. 03001234567).");
    }
    if (form.password !== form.confirm) {
      return setError("Passwords do not match.");
    }
    if (form.verification.trim().toUpperCase() !== code) {
      return setError("Verification code is incorrect.");
    }
    setError("");
    setSubmitting(true);
    try {
      await register({
        phone: cleanPhone,
        password: form.password,
        fullName: "",
        email: "",
        invitationCode: form.invitation.trim(),
      });
      navigate("/home", { replace: true });
    } catch (err) {
      setError(err.message || "Unable to create account.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="register-page">
      <div className="hex-bg" aria-hidden="true" />
      <section className="register-content">
        <header className="register-heading">
          <img src={logo} alt="ZenFlow" className="register-logo" />
          <h1>Create Account</h1>
          <p>Register with your phone number</p>
        </header>

        <form className="register-card" onSubmit={submit} noValidate>
          <FieldLabel>Phone Number</FieldLabel>
          <div className="input-shell phone-shell">
            <span className="field-icon">⌕</span>
            <select aria-label="Country code" defaultValue="+92">
              <option>PK +92</option>
            </select>
            <input value={form.phone} onChange={update("phone")} inputMode="tel" placeholder="Enter your phone number" />
          </div>

          <FieldLabel>Password</FieldLabel>
          <PasswordInput value={form.password} onChange={update("password")} placeholder="Choose any password you like" show={showPassword} onToggle={() => setShowPassword((v) => !v)} />

          <FieldLabel>Password</FieldLabel>
          <PasswordInput value={form.confirm} onChange={update("confirm")} placeholder="Enter password again to confirm" show={showConfirm} onToggle={() => setShowConfirm((v) => !v)} />

          <FieldLabel>Verification Code</FieldLabel>
          <div className="input-shell code-shell">
            <span className="field-icon">#</span>
            <input value={form.verification} onChange={update("verification")} placeholder="Enter verification code" autoComplete="one-time-code" />
            <button type="button" className="captcha" onClick={() => setCode(makeCode())} aria-label="Refresh verification code">{code} ↻</button>
          </div>

          <FieldLabel optional>Invitation Code</FieldLabel>
          <div className="input-shell">
            <span className="field-icon">✉</span>
            <input value={form.invitation} onChange={update("invitation")} placeholder="Leave empty to join directly" />
          </div>
          <p className="helper">No invitation code? Leave this empty — you can still create your account directly.</p>

          {error && <p className="form-error" role="alert">{error}</p>}

          <button className="register-button" type="submit" disabled={submitting}>{submitting ? "Creating account…" : "Register Now"}</button>
        </form>

        <p className="login-prompt">Already have an account? <Link to="/login">Login Now</Link></p>
      </section>
    </main>
  );
}

function FieldLabel({ children, optional }) {
  return <label className="field-label">{children}{optional && <span className="optional"> (optional)</span>}</label>;
}

function PasswordInput({ value, onChange, placeholder, show, onToggle }) {
  return (
    <div className="input-shell">
      <span className="field-icon">⚿</span>
      <input type={show ? "text" : "password"} value={value} onChange={onChange} placeholder={placeholder} autoComplete="new-password" />
      <button type="button" className="eye-button" onClick={onToggle} aria-label={show ? "Hide password" : "Show password"}>{show ? "◉" : "◎"}</button>
    </div>
  );
}
