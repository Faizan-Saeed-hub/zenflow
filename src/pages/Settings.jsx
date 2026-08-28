import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../services/api";

export default function Settings() {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState(true);
  const [sound, setSound] = useState(false);
  const [language, setLanguage] = useState("English");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.me().then(({ user }) => {
      setNotifications(Boolean(user.push_notifications));
      setSound(Boolean(user.notification_sound));
      setLanguage(user.language || "English");
    }).catch(() => {});
  }, []);

  const save = async () => {
    try {
      await api.updateMe({ pushNotifications: notifications, notificationSound: sound, language });
      setSaved(true);
      setTimeout(() => setSaved(false), 1600);
    } catch (e) { window.alert(e.message); }
  };

  const clearLocalData = () => {
    setSound(false);
    setLanguage("English");
    setNotifications(true);
    setSaved(true);
    setTimeout(() => setSaved(false), 1600);
  };

  return (
    <section className="settings-page">
      <div className="settings-heading">
        <button className="round-back" onClick={() => navigate(-1)} aria-label="Go back">‹</button>
        <div>
          <h1>Settings</h1>
          <p>Manage your ZenFlow preferences</p>
        </div>
      </div>

      <div className="settings-card">
        <h2>Notifications</h2>
        <SettingRow
          title="Push notifications"
          description="Receive important account and task updates."
          control={<Toggle checked={notifications} onChange={setNotifications} />}
        />
        <SettingRow
          title="Notification sound"
          description="Play a sound when a notification arrives."
          control={<Toggle checked={sound} onChange={setSound} />}
        />
      </div>

      <div className="settings-card">
        <h2>Preferences</h2>
        <div className="select-row">
          <div>
            <strong>Language</strong>
            <span>Choose your preferred app language.</span>
          </div>
          <select value={language} onChange={(e) => setLanguage(e.target.value)}>
            <option>English</option>
            <option>Urdu</option>
          </select>
        </div>
      </div>

      <div className="settings-card">
        <h2>Account</h2>
        <button className="settings-action" onClick={() => navigate("/profile/edit")}>
          <span><strong>Edit profile</strong><small>Update your personal information</small></span><b>›</b>
        </button>
        <button className="settings-action" onClick={() => navigate("/wallet")}>
          <span><strong>Wallet &amp; withdrawal</strong><small>Manage payout and fund password</small></span><b>›</b>
        </button>
      </div>

      <div className="settings-card danger-card">
        <h2>Data</h2>
        <button className="clear-data" onClick={clearLocalData}>Reset local preferences</button>
      </div>

      <button className="settings-save" onClick={save}>{saved ? "Saved" : "Save settings"}</button>
    </section>
  );
}

function SettingRow({ title, description, control }) {
  return (
    <div className="setting-row">
      <div><strong>{title}</strong><span>{description}</span></div>
      {control}
    </div>
  );
}

function Toggle({ checked, onChange }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      className={checked ? "toggle on" : "toggle"}
      onClick={() => onChange(!checked)}
    >
      <span />
    </button>
  );
}
