import { useEffect, useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { authService, apiClient } from '@/services';
import { useAuthStore } from '@/store/auth.store';

export function ProtectedRoute() {
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);
  const logout = useAuthStore((state) => state.logout);
  const [isChecking, setIsChecking] = useState(true);
  const location = useLocation();

  useEffect(() => {
    let isMounted = true;

    const verifyAuth = async () => {
      const token = apiClient.getToken();
      if (!token) {
        if (isMounted) {
          setIsChecking(false);
        }
        return;
      }

      if (user) {
        if (isMounted) {
          setIsChecking(false);
        }
        return;
      }

      try {
        const authUser = await authService.verifyToken();
        if (authUser.role !== 'admin') {
          throw new Error('No tienes permisos para acceder a este panel');
        }

        if (isMounted) {
          setUser(authUser);
        }
      } catch (error) {
        apiClient.clearToken();
        logout();
      } finally {
        if (isMounted) {
          setIsChecking(false);
        }
      }
    };

    verifyAuth();

    return () => {
      isMounted = false;
    };
  }, [logout, setUser, user]);

  if (isChecking) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Verificando sesión...</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (user.role !== 'admin') {
    apiClient.clearToken();
    logout();
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
