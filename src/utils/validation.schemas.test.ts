import { describe, expect, it } from 'vitest';
import {
  createUserSchema,
  loginSchema,
  menuItemSchema,
  settingsSchema,
  twoFactorSchema,
} from './validation.schemas';

describe('Validation Schemas', () => {
  it('valida login correcto', () => {
    const result = loginSchema.safeParse({
      email: 'admin@test.com',
      password: '123456',
    });

    expect(result.success).toBe(true);
  });

  it('rechaza login sin password', () => {
    const result = loginSchema.safeParse({ email: 'admin@test.com', password: '' });

    expect(result.success).toBe(false);
  });

  it('valida codigo 2FA de 6 digitos', () => {
    const ok = twoFactorSchema.safeParse({ totp_code: '123456' });
    const fail = twoFactorSchema.safeParse({ totp_code: '12a456' });

    expect(ok.success).toBe(true);
    expect(fail.success).toBe(false);
  });

  it('aplica default available en menuItem', () => {
    const result = menuItemSchema.parse({
      name: 'Pizza',
      price: 10,
      category: 'Main',
    });

    expect(result.available).toBe(true);
  });

  it('rechaza currency invalida en settings', () => {
    const result = settingsSchema.safeParse({
      restaurant_name: 'Mi Restaurante',
      currency: 'US',
      timezone: 'America/Mexico_City',
    });

    expect(result.success).toBe(false);
  });

  it('valida createUser con rol permitido', () => {
    const result = createUserSchema.safeParse({
      email: 'user@test.com',
      name: 'User',
      role: 'manager',
      password: 'secret123',
    });

    expect(result.success).toBe(true);
  });
});
