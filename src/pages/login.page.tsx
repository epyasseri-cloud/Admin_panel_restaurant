import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { authService, apiClient } from '@/services';
import { useAuthStore } from '@/store/auth.store';
import { loginSchema } from '@/utils/validation.schemas';
import type { LoginFormData } from '@/utils/validation.schemas';
import { getErrorMessage } from '@/utils/helpers';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Label } from '@/components/ui';

interface LocationState {
  from?: {
    pathname?: string;
  };
}

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
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Acceso Administrador</CardTitle>
          <CardDescription>Ingresa tus credenciales para continuar</CardDescription>
        </CardHeader>

        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
            <div>
              <Label htmlFor="email">Correo electrónico</Label>
              <Input
                id="email"
                type="email"
                placeholder="admin@restaurante.com"
                autoComplete="email"
                {...register('email')}
                className={errors.email ? 'border-red-500' : ''}
                disabled={isSubmitting}
              />
              {errors.email && (
                <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="password">Contraseña</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                {...register('password')}
                className={errors.password ? 'border-red-500' : ''}
                disabled={isSubmitting}
              />
              {errors.password && (
                <p className="mt-1 text-sm text-red-600">{errors.password.message}</p>
              )}
            </div>

            {error && (
              <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <Button className="w-full" type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Ingresando...' : 'Ingresar'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
