import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { api, clearSession, setSession } from "../services/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem("zen_user") || "null"); }
    catch { return null; }
  });
  const [loading, setLoading] = useState(Boolean(localStorage.getItem("zen_token")));

  useEffect(() => {
    if (!localStorage.getItem("zen_token")) { setLoading(false); return; }
    api.me()
      .then(({ user: freshUser }) => setUser(freshUser))
      .catch(() => { clearSession(); setUser(null); })
      .finally(() => setLoading(false));
  }, []);

  const register = async (payload) => {
    const result = await api.register(payload);
    setSession(result);
    setUser(result.user);
    return result;
  };

  const login = async (payload) => {
    const result = await api.login(payload);
    setSession(result);
    setUser(result.user);
    return result;
  };

  const logout = () => { clearSession(); setUser(null); };

  const value = useMemo(() => ({ user, loading, isAuthenticated: Boolean(user), register, login, logout }), [user, loading]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
