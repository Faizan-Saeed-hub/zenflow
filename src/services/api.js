const RAW_BASE = (import.meta.env.VITE_API_URL || "").trim();
const API_BASE = RAW_BASE
  ? (RAW_BASE.endsWith("/api") ? RAW_BASE : `${RAW_BASE.replace(/\/+$/, "")}/api`)
  : "/api";

// Pre-warm backend on page load (eliminates Render cold start delay)
if (typeof window !== "undefined") {
  fetch(`${API_BASE}/health`, { method: "GET" }).catch(() => {});
}

async function request(path, options = {}) {
  const token = localStorage.getItem("zen_token");

  const headers = {
    ...(options.body ? { "Content-Type": "application/json" } : {}),
    ...(options.headers || {})
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let response;

  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers
    });
  } catch {
    throw new Error(
      "Cannot reach ZenFlow API. Please check your internet connection or verify the server status."
    );
  }

  const contentType = response.headers.get("content-type") || "";
  const data = contentType.includes("application/json")
    ? await response.json().catch(() => ({}))
    : {};

  if (!response.ok) {
    if (response.status === 401 && !path.startsWith("/auth/login") && !path.startsWith("/auth/register")) {
      localStorage.removeItem("zen_token");
      localStorage.removeItem("zen_user");
      if (
        typeof window !== "undefined" &&
        !window.location.pathname.includes("/login") &&
        !window.location.pathname.includes("/register")
      ) {
        window.location.assign("/login");
      }
    }
    throw new Error(
      data.message ||
      `Request failed (${response.status}).`
    );
  }

  return data;
}

export const getCachedData = (key, fallback = null) => {
  try {
    const raw = localStorage.getItem(`zen_cache_${key}`);
    return raw ? JSON.parse(raw) : fallback;
  } catch (_) {
    return fallback;
  }
};

export const setCachedData = (key, data) => {
  try {
    localStorage.setItem(`zen_cache_${key}`, JSON.stringify(data));
  } catch (_) {}
};

export const getCachedUser = () => {
  try {
    const raw = localStorage.getItem("zen_user");
    return raw ? JSON.parse(raw) : null;
  } catch (_) {
    return null;
  }
};

export const api = {
  health: () => request("/health"),

  register: async (p) => {
    const res = await request("/auth/register", {
      method: "POST",
      body: JSON.stringify(p)
    });
    if (res?.token && res?.user) setSession(res);
    return res;
  },

  login: async (p) => {
    const res = await request("/auth/login", {
      method: "POST",
      body: JSON.stringify(p)
    });
    if (res?.token && res?.user) setSession(res);
    return res;
  },

  me: async () => {
    const res = await request("/me");
    if (res?.user) {
      localStorage.setItem("zen_user", JSON.stringify(res.user));
      setCachedData("user_me", res.user);
    }
    return res;
  },

  updateMe: (p) =>
    request("/me", {
      method: "PATCH",
      body: JSON.stringify(p)
    }),

  changePassword: (p) =>
    request("/me/password", {
      method: "POST",
      body: JSON.stringify(p)
    }),

  setFundPassword: (p) =>
    request("/me/fund-password", {
      method: "POST",
      body: JSON.stringify(p)
    }),

  dashboard: async () => {
    const res = await request("/dashboard");
    if (res?.stats) setCachedData("dashboard_stats", res.stats);
    return res;
  },

  plans: async () => {
    const res = await request("/plans");
    if (res?.plans) setCachedData("plans", res);
    return res;
  },

  myPlans: async () => {
    const res = await request("/plans/mine");
    if (res) setCachedData("my_plans", res);
    return res;
  },

  purchasePlan: (id) =>
    request(`/plans/${id}/purchase`, { method: "POST" }),

  activatePlan: (id) =>
    request(`/plans/${id}/purchase`, { method: "POST" }),

  tasks: async () => {
    const res = await request("/tasks");
    if (res) setCachedData("tasks", res);
    return res;
  },

  task: (id) => request(`/tasks/${id}`),

  taskLibrary: () => request("/tasks/library"),

  completedTasks: async () => {
    const res = await request("/tasks/completed");
    if (res) setCachedData("completed_tasks", res);
    return res;
  },

  finishTaskReading: (id) => request(`/tasks/${id}/read`, { method: "POST" }),

  submitTask: (id, p) =>
    request(`/tasks/${id}/submit`, { method: "POST", body: JSON.stringify(p) }),

  claimTaskReward: (id) => request(`/tasks/${id}/claim`, { method: "POST" }),

  checkin: () => request("/checkin"),

  doCheckin: () =>
    request("/checkin", {
      method: "POST"
    }),

  notifications: () => request("/notifications"),

  readAllNotifications: () =>
    request("/notifications/read-all", {
      method: "POST"
    }),

  readNotification: (id) =>
    request(`/notifications/${id}/read`, {
      method: "POST"
    }),

  walletTransactions: () =>
    request("/wallet/transactions"),

  payoutAccounts: async () => {
    const res = await request("/wallet/accounts");
    if (res) setCachedData("payoutAccounts", res);
    return res;
  },

  addPayoutAccount: (p) =>
    request("/wallet/accounts", {
      method: "POST",
      body: JSON.stringify(p)
    }),

  withdrawals: async () => {
    const res = await request("/withdrawals");
    if (res) setCachedData("withdrawals", res);
    return res;
  },

  deposits: async () => {
    const res = await request("/deposits");
    if (res) setCachedData("deposits", res);
    return res;
  },

  paymentSettings: () => request("/wallet/payment-settings"),

  submitDeposit: (p) =>
    request("/deposits", {
      method: "POST",
      body: JSON.stringify(p)
    }),

  submitWithdrawal: (p) =>
    request("/withdrawals", {
      method: "POST",
      body: JSON.stringify(p)
    }),

  team: async () => {
    const res = await request("/team");
    if (res) setCachedData("team", res);
    return res;
  },

  rewards: async () => {
    const res = await request("/rewards");
    if (res) setCachedData("rewards", res);
    return res;
  },

  news: async () => {
    const res = await request("/content/news");
    if (res) setCachedData("news", res);
    return res;
  },

  funds: () => request("/content/funds"),

  loans: () => request("/content/loans"),

  submitLoan: (p) =>
    request("/content/loans", {
      method: "POST",
      body: JSON.stringify(p)
    }),

  submitSupport: (p) =>
    request("/content/support", {
      method: "POST",
      body: JSON.stringify(p)
    }),

  adminDashboard: () =>
    request("/admin/dashboard"),

  adminUsers: () =>
    request("/admin/users"),

  adminResetUserPassword: (id) => request(`/admin/users/${id}/reset-password`, { method: "POST" }),

  adminTeam: () => request("/admin/team"),

  adminUpdateUser: (id, p) =>
    request(`/admin/users/${id}`, {
      method: "PATCH",
      body: JSON.stringify(p)
    }),

  adminPlans: () =>
    request("/admin/plans"),

  adminUpdatePlan: (id, p) =>
    request(`/admin/plans/${id}`, {
      method: "PATCH",
      body: JSON.stringify(p)
    }),

  adminTasks: () =>
    request("/admin/tasks"),

  adminUpdateTask: (id, p) =>
    request(`/admin/tasks/${id}`, {
      method: "PATCH",
      body: JSON.stringify(p)
    }),

  adminDeposits: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/admin/deposits${query ? `?${query}` : ""}`);
  },

  adminUpdateDeposit: (id, p) =>
    request(`/admin/deposits/${id}`, {
      method: "PATCH",
      body: JSON.stringify(p)
    }),

  adminWithdrawals: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/admin/withdrawals${query ? `?${query}` : ""}`);
  },

  adminUpdateWithdrawal: (id, p) =>
    request(`/admin/withdrawals/${id}`, {
      method: "PATCH",
      body: JSON.stringify(p)
    }),

  adminLoans: () =>
    request("/admin/loans"),

  adminUpdateLoan: (id, p) =>
    request(`/admin/loans/${id}`, {
      method: "PATCH",
      body: JSON.stringify(p)
    }),

  getSupportInquiries: () =>
    request("/content/support"),

  createSupportInquiry: (p) =>
    request("/content/support", {
      method: "POST",
      body: JSON.stringify(p)
    }),

  adminSupport: () =>
    request("/admin/support"),

  adminReplySupport: (id, p) =>
    request(`/admin/support/${id}/reply`, {
      method: "POST",
      body: JSON.stringify(p)
    }),

  adminDeleteSupport: (id) =>
    request(`/admin/support/${id}`, {
      method: "DELETE"
    }),

  adminBankSettings: async () => {
    try { return await request("/admin/bank-settings"); }
    catch (e) {
      if (String(e.message || "").includes("404")) return request("/admin/bank");
      throw e;
    }
  },

  adminUpdateBankSetting: async (method,p) => {
    try { return await request(`/admin/bank-settings/${encodeURIComponent(method)}`, { method:"PATCH", body:JSON.stringify(p) }); }
    catch (e) {
      if (String(e.message || "").includes("404")) return request(`/admin/bank/${encodeURIComponent(method)}`, { method:"PATCH", body:JSON.stringify(p) });
      throw e;
    }
  },

  adminUpdateSupport: (id, p) =>
    request(`/admin/support/${id}`, {
      method: "PATCH",
      body: JSON.stringify(p)
    }),

  adminDeleteUser: (id) =>
    request(`/admin/users/${id}`, {
      method: "DELETE"
    }),

  adminResetFundPassword: (id, p) =>
    request(`/admin/users/${id}/reset-fund-password`, {
      method: "POST",
      body: JSON.stringify(p || {})
    }),

  getActiveAnnouncement: () => request("/content/announcements/active"),
  adminGetAnnouncements: () => request("/admin/announcements"),
  adminCreateAnnouncement: (p) =>
    request("/admin/announcements", {
      method: "POST",
      body: JSON.stringify(p)
    }),
  adminUpdateAnnouncement: (id, p) =>
    request(`/admin/announcements/${id}`, {
      method: "PATCH",
      body: JSON.stringify(p)
    }),
  adminDeleteAnnouncement: (id) =>
    request(`/admin/announcements/${id}`, {
      method: "DELETE"
    }),

  adminNews: () =>
    request("/admin/news"),

  adminCreateNews: (p) =>
    request("/admin/news", {
      method: "POST",
      body: JSON.stringify(p)
    }),

  adminUpdateNews: (id, p) =>
    request(`/admin/news/${id}`, {
      method: "PATCH",
      body: JSON.stringify(p)
    }),

  adminDeleteNews: (id) =>
    request(`/admin/news/${id}`, {
      method: "DELETE"
    }),

  adminGetPlans: () =>
    request("/admin/plans"),

  adminUpdatePlan: (id, p) =>
    request(`/admin/plans/${id}`, {
      method: "PATCH",
      body: JSON.stringify(p)
    }),

  adminGetTasks: () =>
    request("/admin/tasks"),

  adminCreateTask: (p) =>
    request("/admin/tasks", {
      method: "POST",
      body: JSON.stringify(p)
    }),

  adminUpdateTask: (id, p) =>
    request(`/admin/tasks/${id}`, {
      method: "PATCH",
      body: JSON.stringify(p)
    }),

  adminDeleteTask: (id) =>
    request(`/admin/tasks/${id}`, {
      method: "DELETE"
    }),

  adminEarnings: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/admin/earnings${query ? `?${query}` : ""}`);
  },

  adminExportUsers: () => request("/admin/export/users"),
  adminExportTeams: () => request("/admin/export/teams"),
  adminExportDeposits: () => request("/admin/export/deposits"),
  adminExportWithdrawals: () => request("/admin/export/withdrawals"),

  adminImportUsers: (users) =>
    request("/admin/import/users", {
      method: "POST",
      body: JSON.stringify({ users })
    }),

  adminImportDeposits: (deposits) =>
    request("/admin/import/deposits", {
      method: "POST",
      body: JSON.stringify({ deposits })
    }),

  adminImportWithdrawals: (withdrawals) =>
    request("/admin/import/withdrawals", {
      method: "POST",
      body: JSON.stringify({ withdrawals })
    }),

  // Lucky Wheel / Lucky Draw Client Endpoints
  luckyWheelStatus: () => request("/lucky-wheel"),
  luckyWheelSpin: () =>
    request("/lucky-wheel/spin", {
      method: "POST"
    }),

  // Lucky Wheel Admin Endpoints
  adminLuckyWheel: () => request("/admin/lucky-wheel"),
  adminGiveSpin: (payload) =>
    request("/admin/lucky-wheel/give-spin", {
      method: "POST",
      body: JSON.stringify(payload)
    }),
  adminSetUserSpins: (payload) =>
    request("/admin/lucky-wheel/set-user-spins", {
      method: "POST",
      body: JSON.stringify(payload)
    }),
  adminSaveWheelSettings: (payload) =>
    request("/admin/lucky-wheel/settings", {
      method: "POST",
      body: JSON.stringify(payload)
    }),
  adminResetUserSpins: (userId) =>
    request(`/admin/lucky-wheel/user/${userId}`, {
      method: "DELETE"
    })
};

export const setSession = (data) => {
  localStorage.setItem("zen_token", data.token);
  localStorage.setItem("zen_user", JSON.stringify(data.user));
};

export const clearSession = () => {
  localStorage.removeItem("zen_token");
  localStorage.removeItem("zen_user");
};
