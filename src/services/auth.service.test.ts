import { beforeEach, describe, expect, it, vi } from 'vitest';
import { authService } from './auth.service';
import { apiClient } from './api-client';

vi.mock('./api-client', () => ({
  apiClient: {
    get: vi.fn(),
    getBlob: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    uploadFile: vi.fn(),
  },
}));

describe('AuthService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('hace login con email y password', async () => {
    const data = {
      token: { access_token: 'token', expires_in: 3600, token_type: 'Bearer' },
      user: { id: '1', email: 'admin@test.com', name: 'Admin', role: 'admin' },
    };
    const response = { success: true, data };
    vi.mocked(apiClient.post).mockResolvedValue({ data: response } as never);

    const result = await authService.login('admin@test.com', '123456');

    expect(apiClient.post).toHaveBeenCalledWith('/auth-login', {
      email: 'admin@test.com',
      password: '123456',
    });
    expect(result).toEqual(data);
  });

  it('verifica token con /auth-me', async () => {
    const user = { id: '1', email: 'admin@test.com', name: 'Admin', role: 'admin' };
    const response = { success: true, data: user };
    vi.mocked(apiClient.get).mockResolvedValue({ data: response } as never);

    const result = await authService.verifyToken();

    expect(apiClient.get).toHaveBeenCalledWith('/auth-me');
    expect(result).toEqual(user);
  });

  it('crea challenge 2FA', async () => {
    const challenge = {
      challenge_id: 'ch-1',
      action: 'user_deletion',
      created_at: '2026-01-01T00:00:00Z',
      expires_at: '2026-01-01T00:05:00Z',
    };
    const response = { success: true, data: challenge };
    vi.mocked(apiClient.post).mockResolvedValue({ data: response } as never);

    const result = await authService.createTwoFactorChallenge('user_deletion');

    expect(apiClient.post).toHaveBeenCalledWith('/auth-2fa-challenge', {
      action: 'user_deletion',
    });
    expect(result).toEqual(challenge);
  });

  it('verifica codigo 2FA', async () => {
    const payload = { challenge_id: 'ch-1', totp_code: '123456' };
    const verifyData = { success: true, message: 'ok' };
    const response = { success: true, data: verifyData };
    vi.mocked(apiClient.post).mockResolvedValue({ data: response } as never);

    const result = await authService.verifyTwoFactor(payload);

    expect(apiClient.post).toHaveBeenCalledWith('/auth-2fa-verify', payload);
    expect(result).toEqual(verifyData);
  });
});
