import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { twoFactorSchema } from '@/utils/validation.schemas';
import type { TwoFactorFormData } from '@/utils/validation.schemas';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Button,
  Input,
  Label,
} from '@/components/ui';
import { useTwoFactorStore } from '@/store/two-factor.store';

export function TwoFactorModal() {
  const { isOpen, closeChallenge, action, onVerify } = useTwoFactorStore();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<TwoFactorFormData>({
    resolver: zodResolver(twoFactorSchema),
  });

  const handleClose = () => {
    reset();
    setError(null);
    closeChallenge();
  };

  const onSubmit = async (data: TwoFactorFormData) => {
    try {
      setIsSubmitting(true);
      setError(null);
      if (onVerify) {
        await onVerify(data.totp_code);
      }
      handleClose();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'No se pudo verificar el código 2FA';
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Verificación de dos factores</DialogTitle>
          <DialogDescription>
            Ingresa el código de tu aplicación autenticadora para confirmar esta
            acción crítica: <span className="font-semibold">{action}</span>
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <Label htmlFor="totp_code">Código de verificación (6 dígitos) *</Label>
            <Input
              id="totp_code"
              type="text"
              inputMode="numeric"
              placeholder="000000"
              maxLength={6}
              {...register('totp_code')}
              className={errors.totp_code ? 'border-red-500' : ''}
              disabled={isSubmitting}
            />
            {errors.totp_code && (
              <p className="text-red-500 text-sm mt-1">{errors.totp_code.message}</p>
            )}
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
              {error}
            </div>
          )}

          <DialogFooter className="space-x-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Verificando...' : 'Verificar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
