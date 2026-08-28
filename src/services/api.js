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

export const api = {
  health: () => request("/health"),

  register: (p) =>
    request("/auth/register", {
      method: "POST",
      body: JSON.stringify(p)
    }),

  login: (p) =>
    request("/auth/login", {
      method: "POST",
      body: JSON.stringify(p)
    }),

  me: () => request("/me"),

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

  dashboard: () => request("/dashboard"),

  plans: () => request("/plans"),

  myPlans: () => request("/plans/mine"),

  purchasePlan: (id) =>
    request(`/plans/${id}/purchase`, { method: "POST" }),

  activatePlan: (id) =>
    request(`/plans/${id}/purchase`, { method: "POST" }),

  tasks: () => request("/tasks"),

  task: (id) => request(`/tasks/${id}`),

  taskLibrary: () => request("/tasks/library"),

  completedTasks: () => request("/tasks/completed"),

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

  payoutAccounts: () =>
    request("/wallet/accounts"),

  addPayoutAccount: (p) =>
    request("/wallet/accounts", {
      method: "POST",
      body: JSON.stringify(p)
    }),

  withdrawals: () =>
    request("/withdrawals"),

  deposits: () => request("/deposits"),

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

  team: () => request("/team"),

  rewards: () => request("/rewards"),

  news: () => request("/content/news"),

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

  adminDeposits: () =>
    request("/admin/deposits"),

  adminUpdateDeposit: (id, p) =>
    request(`/admin/deposits/${id}`, {
      method: "PATCH",
      body: JSON.stringify(p)
    }),

  adminWithdrawals: () =>
    request("/admin/withdrawals"),

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

  adminSupport: () =>
    request("/admin/support"),

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
