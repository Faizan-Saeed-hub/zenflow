import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../services/api";

const defaults = { gender: "male", fullName: "", phone: "", email: "" };

export default function EditProfile() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(defaults);
  const [newPassword, setNewPassword] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    api.me().then(({ user }) => setProfile({
      ...defaults,
      fullName: user.fullName || "",
      phone: user.phone || "",
      email: user.email || "",
      avatar: user.avatar || "",
      gender: user.avatar === "female" ? "female" : "male"
    })).catch(e => setError(e.message));
  }, []);

  const update = (key, value) => { setProfile(current => ({ ...current, [key]: value })); setMessage(""); setError(""); };

  const saveProfile = async (event) => {
    event.preventDefault(); setMessage(""); setError("");
    if (!profile.fullName.trim() || !profile.phone.trim() || !profile.email.trim()) return setError("Please complete all profile fields.");
    try {
      await api.updateMe({ fullName: profile.fullName.trim(), email: profile.email.trim(), avatar: profile.gender });
      setMessage("Profile changes saved.");
    } catch (e) { setError(e.message); }
  };

  const updatePassword = async (event) => {
    event.preventDefault(); setMessage(""); setError("");
    if (newPassword.length < 6) return setError("Password must contain at least 6 characters.");
    try {
      await api.changePassword({ currentPassword, newPassword });
      setCurrentPassword(""); setNewPassword(""); setMessage("Password updated.");
    } catch (e) { setError(e.message); }
  };

  return (
    <section className="edit-profile-page">
      <div className="edit-profile-content">
        <header className="edit-profile-header"><button className="back-button" onClick={() => navigate("/profile")} aria-label="Back to profile">‹</button><div><h1>Edit profile</h1><p>Keep your details current</p></div></header>
        <form className="edit-card" onSubmit={saveProfile}>
          <div className="avatar-heading"><img className="avatar-preview" src={profile.gender === "female" ? "/zenflow-images/profile/female.png" : "/zenflow-images/profile/male.png"} alt="Profile avatar" /><div><strong>Profile avatar</strong><span>Choose a gender below to update your avatar.</span></div></div>
          <fieldset className="gender-fieldset"><legend>Profile picture</legend><div className="gender-options">{[["male","Male","/zenflow-images/profile/male.png"],["female","Female","/zenflow-images/profile/female.png"]].map(([value,label,image]) => <button type="button" key={value} className={`gender-option ${profile.gender===value?"selected":""}`} onClick={() => update("gender",value)}><img src={image} alt="" /><span>{label}</span></button>)}</div></fieldset>
          <label className="edit-field"><span>Full name</span><input value={profile.fullName} onChange={e=>update("fullName",e.target.value)} autoComplete="name" /></label>
          <label className="edit-field"><span>Phone number</span><input value={profile.phone} readOnly inputMode="tel" /></label>
          <label className="edit-field"><span>Email</span><input value={profile.email} onChange={e=>update("email",e.target.value)} type="email" autoComplete="email" /></label>
          <button className="save-profile-button" type="submit">Save changes</button>
        </form>
        <form className="edit-card password-card" onSubmit={updatePassword}>
          <h2>Change password</h2>
          <label className="edit-field"><span>Current password</span><input value={currentPassword} onChange={e=>setCurrentPassword(e.target.value)} type="password" placeholder="Current password" autoComplete="current-password" /></label>
          <label className="edit-field"><span>New password</span><input value={newPassword} onChange={e=>setNewPassword(e.target.value)} type="password" placeholder="Any password you like" autoComplete="new-password" /></label>
          <button className="update-password-button" type="submit">Update password</button>
        </form>
        {(message || error) && <p className={error ? "edit-profile-message error" : "edit-profile-message"} role="status">{error || message}</p>}
      </div>
    </section>
  );
}
