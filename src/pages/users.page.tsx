import { useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createUserSchema } from '@/utils/validation.schemas';
import type { CreateUserFormData } from '@/utils/validation.schemas';
import { Button, Dialog, DialogContent, DialogHeader, DialogTitle, Input, Label, Card, CardContent } from '@/components/ui';
import type { User } from '@/types';
import { authService, userService } from '@/services';
import { getErrorMessage } from '@/utils/helpers';
import { useTwoFactorStore } from '@/store/two-factor.store';

export function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isFormSubmitting, setIsFormSubmitting] = useState(false);
  const openChallenge = useTwoFactorStore((state) => state.openChallenge);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<CreateUserFormData>({
    resolver: zodResolver(createUserSchema),
  });

  // Load users
  const loadUsers = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await userService.getUsers();
      setUsers(response.data);
    } catch (error) {
      setError(getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const handleFormSubmit = async (data: CreateUserFormData) => {
    try {
      setIsFormSubmitting(true);
      await userService.createUser(data);
      await loadUsers();
      setIsFormOpen(false);
      reset();
    } catch (error) {
      setError(getErrorMessage(error));
    } finally {
      setIsFormSubmitting(false);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('¿Estás seguro de que deseas eliminar este usuario?')) {
      return;
    }
    try {
      const challenge = await authService.createTwoFactorChallenge('user_deletion');

      openChallenge(
        challenge.challenge_id,
        'Eliminación de usuario',
        async (totpCode) => {
          await authService.verifyTwoFactor({
            challenge_id: challenge.challenge_id,
            totp_code: totpCode,
          });
          await userService.deleteUser(userId);
          await loadUsers();
        }
      );
    } catch (error) {
      setError(getErrorMessage(error));
    }
  };

  const handleResetPassword = async (userId: string) => {
    try {
      const response = await userService.resetPassword(userId);
      alert(`Contraseña temporal: ${response.temporary_password}`);
    } catch (error) {
      setError(getErrorMessage(error));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Gestión de Usuarios</h1>
          <p className="text-muted-foreground mt-1">Total de usuarios: {users.length}</p>
        </div>
        <Button onClick={() => {
          reset();
          setIsFormOpen(true);
        }}>
          Crear usuario
        </Button>
      </div>

      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <p className="text-red-700">{error}</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <p className="text-center text-muted-foreground">Cargando...</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-4 font-medium">Nombre</th>
                    <th className="text-left py-2 px-4 font-medium">Email</th>
                    <th className="text-left py-2 px-4 font-medium">Rol</th>
                    <th className="text-left py-2 px-4 font-medium">Estado</th>
                    <th className="text-left py-2 px-4 font-medium">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id} className="border-b hover:bg-muted/50">
                      <td className="py-2 px-4">{user.name}</td>
                      <td className="py-2 px-4">{user.email}</td>
                      <td className="py-2 px-4">
                        <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-medium">
                          {user.role}
                        </span>
                      </td>
                      <td className="py-2 px-4">
                        <span className={user.is_active ? 'text-green-600' : 'text-red-600'}>
                          {user.is_active ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td className="py-2 px-4">
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleResetPassword(user.id)}
                          >
                            Resetear contraseña
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleDeleteUser(user.id)}
                          >
                            Eliminar
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {users.length === 0 && (
                <p className="text-center text-muted-foreground py-4">
                  No hay usuarios
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Crear nuevo usuario</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
            <div>
              <Label htmlFor="name">Nombre *</Label>
              <Input
                id="name"
                {...register('name')}
                className={errors.name ? 'border-red-500' : ''}
              />
              {errors.name && <p className="text-red-500 text-sm mt-1">{errors.name.message}</p>}
            </div>

            <div>
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                {...register('email')}
                className={errors.email ? 'border-red-500' : ''}
              />
              {errors.email && <p className="text-red-500 text-sm mt-1">{errors.email.message}</p>}
            </div>

            <div>
              <Label htmlFor="role">Rol *</Label>
              <select
                id="role"
                {...register('role')}
                className="w-full border rounded px-3 py-2"
              >
                <option value="">Seleccionar rol</option>
                <option value="waiter">Mesero</option>
                <option value="kitchen">Cocina</option>
                <option value="manager">Gerente</option>
                <option value="admin">Admin</option>
              </select>
              {errors.role && <p className="text-red-500 text-sm mt-1">{errors.role.message}</p>}
            </div>

            <div className="flex gap-2 justify-end pt-4">
              <Button type="button" variant="outline" onClick={() => setIsFormOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isFormSubmitting}>
                {isFormSubmitting ? 'Creando...' : 'Crear'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

