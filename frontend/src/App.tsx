import { WaitingScreen } from "./components/WaitingScreen";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { AdminDashboard } from "./pages/AdminDashboard";
import { AuthPage } from "./pages/AuthPage";
import { UserDashboard } from "./pages/UserDashboard";

function AppContent() {
  const { token, user, setSession, logout } = useAuth();

  if (user && token) {
    if (user.role === "admin") {
      return <AdminDashboard token={token} user={user} onLogout={logout} />;
    }

    if (user.can_use_service) {
      return <UserDashboard token={token} user={user} onLogout={logout} />;
    }

    return <WaitingScreen user={user} onLogout={logout} />;
  }

  return <AuthPage onLoginSuccess={setSession} />;
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
