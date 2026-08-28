import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import AppLayout from "./layouts/AppLayout";
import CreateAccount from "./pages/CreateAccount";
import Login from "./pages/Login";
import Home from "./pages/Home";
import Tasks from "./pages/Tasks";
import Plans from "./pages/Plans";
import Team from "./pages/Team";
import Profile from "./pages/Profile";
import EditProfile from "./pages/EditProfile";
import Wallet from "./pages/Wallet";
import RewardHistory from "./pages/RewardHistory";
import Referral from "./pages/Referral";
import Notifications from "./pages/Notifications";
import Settings from "./pages/Settings";
import HelpSupport from "./pages/HelpSupport";
import NotFound from "./pages/NotFound";
import DailyCheckIn from "./pages/DailyCheckIn";
import LoanCenter from "./pages/LoanCenter";
import NewsCenter from "./pages/NewsCenter";
import WealthFund from "./pages/WealthFund";
import WithdrawRewards from "./pages/WithdrawRewards";
import Recharge from "./pages/Recharge";
import TaskDetail from "./pages/TaskDetail";
import TaskLibrary from "./pages/TaskLibrary";
import CompletedTasks from "./pages/CompletedTasks";
import AdminLogin from "./pages/AdminLogin";
import AdminDashboard from "./pages/AdminDashboard";
import { useAuth } from "./context/AuthContext";

function ProtectedRoute() {
  const { loading, isAuthenticated } = useAuth();
  const location = useLocation();
  if (loading) return <div className="app-loading">Loading ZenFlow…</div>;
  if (!isAuthenticated) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <AppLayout />;
}

function PublicOnly({ children }) {
  const { loading, isAuthenticated } = useAuth();
  if (loading) return <div className="app-loading">Loading ZenFlow…</div>;
  return isAuthenticated ? <Navigate to="/home" replace /> : children;
}

function readStoredUser() {
  try { return JSON.parse(localStorage.getItem("zen_user") || "null"); }
  catch { return null; }
}

function AdminGuard() {
  const token = localStorage.getItem("zen_token");
  const user = readStoredUser();
  if (!token) return <Navigate to="/admin/login" replace />;
  if (user?.role !== "admin") return <Navigate to="/admin/login" replace />;
  return <AdminDashboard />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/home" replace />} />
      <Route path="/create-account" element={<PublicOnly><CreateAccount /></PublicOnly>} />
      <Route path="/login" element={<PublicOnly><Login /></PublicOnly>} />

      <Route path="/admin/login" element={<AdminLogin />} />
      <Route path="/admin" element={<AdminGuard />} />

      <Route element={<ProtectedRoute />}>
        <Route path="/home" element={<Home />} />
        <Route path="/tasks" element={<Tasks />} />
        <Route path="/daily-check-in" element={<DailyCheckIn />} />
        <Route path="/loan" element={<LoanCenter />} />
        <Route path="/news" element={<NewsCenter />} />
        <Route path="/wealth-fund" element={<WealthFund />} />
        <Route path="/withdraw-rewards" element={<WithdrawRewards />} />
        <Route path="/recharge" element={<Recharge />} />
        <Route path="/tasks/view/:id" element={<TaskDetail />} />
        <Route path="/tasks/library" element={<TaskLibrary />} />
        <Route path="/tasks/completed" element={<CompletedTasks />} />
        <Route path="/plans" element={<Plans />} />
        <Route path="/team" element={<Team />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/profile/edit" element={<EditProfile />} />
        <Route path="/wallet" element={<Wallet />} />
        <Route path="/rewards" element={<RewardHistory />} />
        <Route path="/referral" element={<Referral />} />
        <Route path="/notifications" element={<Notifications />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/help" element={<HelpSupport />} />
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
