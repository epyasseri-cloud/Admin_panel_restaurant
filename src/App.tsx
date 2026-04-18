import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { Sidebar } from '@/components/layout/sidebar';
import { TwoFactorModal } from '@/components/auth/two-factor-modal';
import { LoginPage } from '@/pages/login.page';
import { MenuItemsPage } from '@/pages/menu-items.page';
import { UsersPage } from '@/pages/users.page';
import { SettingsPage } from '@/pages/settings.page';
import { ReportsPage } from '@/pages/reports.page';
import { AuditLogsPage } from '@/pages/audit-logs.page';
import { useAuthStore } from '@/store/auth.store';
import { apiClient, authService } from '@/services';

function DashboardPage() {
  const user = useAuthStore((state) => state.user);

  return (
    <div>
      <h1 className="text-3xl font-bold">Panel de Control</h1>
      <p className="text-muted-foreground mt-2">
        Bienvenido, {user?.name}. Selecciona una opción del menú para comenzar.
      </p>
    </div>
  );
}

function AdminLayout({ onLogout }: { onLogout: () => void }) {
  return (
    <div className="flex h-screen">
      <Sidebar onLogout={onLogout} />
      <main className="flex-1 overflow-auto">
        <div className="p-6">
          <Outlet />
        </div>
      </main>
      <TwoFactorModal />
    </div>
  );
}

export function App() {
  const logout = useAuthStore((state) => state.logout);

  const handleLogout = async () => {
    try {
      await authService.logout();
    } catch {
      // Logout should always continue on client side.
    }
    apiClient.clearToken();
    logout();
  };

  return (
    <Router>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        <Route element={<ProtectedRoute />}>
          <Route element={<AdminLayout onLogout={handleLogout} />}>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/menu-items" element={<MenuItemsPage />} />
            <Route path="/users" element={<UsersPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="/audit-logs" element={<AuditLogsPage />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
