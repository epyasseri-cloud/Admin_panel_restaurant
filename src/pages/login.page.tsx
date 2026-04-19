import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { User, Lock } from 'lucide-react';
import { authService, apiClient } from '@/services';
import { useAuthStore } from '@/store/auth.store';
import { loginSchema } from '@/utils/validation.schemas';
import type { LoginFormData } from '@/utils/validation.schemas';
import { getErrorMessage } from '@/utils/helpers';
import { Button, Input } from '@/components/ui';

interface LocationState {
  from?: {
    pathname?: string;
  };
}

const CornerGraphics = () => (
  <div className="geo-corners">
    {/* Top Accent */}
    <svg className="absolute top-0 left-0 w-full h-24" viewBox="0 0 400 100" preserveAspectRatio="none">
      <path d="M0 0 L150 0 L100 80 L0 100 Z" fill="#2d7a4d" />
      <path d="M0 0 L100 0 L0 60 Z" fill="#1e5234" />
      <path d="M400 0 L250 0 L300 80 L400 100 Z" fill="#2d7a4d" />
      <path d="M400 0 L300 0 L400 60 Z" fill="#1e5234" />
    </svg>
    
    {/* Bottom Accent */}
    <svg className="absolute bottom-0 left-0 w-full h-24" viewBox="0 0 400 100" preserveAspectRatio="none">
      <path d="M0 100 L150 100 L110 20 L0 0 Z" fill="#2d7a4d" />
      <path d="M0 100 L80 100 L0 40 Z" fill="#1e5234" />
      <path d="M400 100 L250 100 L290 20 L400 0 Z" fill="#2d7a4d" />
      <path d="M400 100 L320 100 L400 40 Z" fill="#1e5234" />
    </svg>
  </div>
);

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const locationState = location.state as LocationState | null;
  const redirectTo = locationState?.from?.pathname || '/dashboard';

  useEffect(() => {
    if (user?.role === 'admin') {
      navigate('/dashboard', { replace: true });
    }
  }, [navigate, user]);

  if (user?.role === 'admin') {
    return <Navigate to="/dashboard" replace />;
  }

  const onSubmit = async (data: LoginFormData) => {
    try {
      setIsSubmitting(true);
      setError(null);

      const response = await authService.login(data.email, data.password);
      if (response.user.role !== 'admin') {
        throw new Error('Solo usuarios admin pueden acceder a este panel');
      }

      apiClient.setToken(response.token.access_token, response.user.id);
      setUser(response.user);
      navigate(redirectTo, { replace: true });
    } catch (submitError) {
      setError(getErrorMessage(submitError));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="geo-login-container">
      <div className="geo-login-card animate-in fade-in slide-in-from-bottom-8 duration-700">
        <CornerGraphics />
        
        <div className="geo-avatar-container">
          <User className="w-10 h-10 text-white" />
        </div>

        <div className="geo-login-content">
          <form onSubmit={handleSubmit(onSubmit)}>
            {/* User field */}
            <div className="mb-4">
              <label className="geo-field-label">User Name</label>
              <div className="geo-input-group">
                <div className="geo-icon-prefix">
                  <User className="w-5 h-5" />
                </div>
                <Input
                  id="email"
                  type="email"
                  placeholder="admin@restaurante.com"
                  autoComplete="email"
                  {...register('email')}
                  className={`geo-input-field ${errors.email ? 'ring-1 ring-red-500' : ''}`}
                  disabled={isSubmitting}
                />
              </div>
              {errors.email && (
                <p className="mt-[-1rem] mb-4 text-[10px] text-red-500 font-bold uppercase pl-14">{errors.email.message}</p>
              )}
            </div>

            {/* Password field */}
            <div className="mb-6">
              <label className="geo-field-label">Password</label>
              <div className="geo-input-group">
                <div className="geo-icon-prefix">
                  <Lock className="w-5 h-5" />
                </div>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  autoComplete="current-password"
                  {...register('password')}
                  className={`geo-input-field ${errors.password ? 'ring-1 ring-red-500' : ''}`}
                  disabled={isSubmitting}
                />
              </div>
              {errors.password && (
                <p className="mt-[-1rem] mb-4 text-[10px] text-red-500 font-bold uppercase pl-14">{errors.password.message}</p>
              )}
            </div>

            {error && (
              <div className="mb-6 rounded-lg border border-red-500/30 bg-red-50 p-3 text-[11px] text-red-600 font-bold text-center animate-in shake">
                {error}
              </div>
            )}

            <Button 
              className="geo-button" 
              type="submit" 
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Verificando...' : 'LOGIN'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
