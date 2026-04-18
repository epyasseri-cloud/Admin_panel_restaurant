import { apiClient } from './api-client';
import type { AuthToken, AuthUser, TwoFactorChallenge, TwoFactorVerifyRequest, TwoFactorVerifyResponse } from '@/types';

interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  message?: string;
  error?: {
    code?: string;
    details?: unknown;
  } | null;
}

export class AuthService {
  private unwrap<T>(payload: ApiEnvelope<T>): T {
    if (!payload.success) {
      throw new Error(payload.message || 'Request failed');
    }
    return payload.data;
  }

  async login(email: string, password: string) {
    const response = await apiClient.post<ApiEnvelope<{ token: AuthToken; user: AuthUser }>>(
      '/auth-login',
      {
        email,
        password,
      }
    );
    return this.unwrap(response.data);
  }

  async logout() {
    const response = await apiClient.post('/auth-logout');
    return response.data;
  }

  async verifyToken() {
    const response = await apiClient.get<ApiEnvelope<AuthUser>>('/auth-me');
    return this.unwrap(response.data);
  }

  async createTwoFactorChallenge(action: string) {
    const response = await apiClient.post<ApiEnvelope<TwoFactorChallenge>>(
      '/auth-2fa-challenge',
      {
        action,
      }
    );
    return this.unwrap(response.data);
  }

  async verifyTwoFactor(request: TwoFactorVerifyRequest) {
    const response = await apiClient.post<ApiEnvelope<TwoFactorVerifyResponse>>(
      '/auth-2fa-verify',
      request
    );
    return this.unwrap(response.data);
  }

  async setupTwoFactor() {
    const response = await apiClient.post<ApiEnvelope<{ secret: string; qr_code: string }>>(
      '/auth-2fa-setup'
    );
    return this.unwrap(response.data);
  }

  async confirmTwoFactorSetup(totp_code: string) {
    const response = await apiClient.post('/auth-2fa-confirm', {
      totp_code,
    });
    return response.data;
  }

  async disableTwoFactor(totp_code: string) {
    const response = await apiClient.post('/auth-2fa-disable', {
      totp_code,
    });
    return response.data;
  }
}

export const authService = new AuthService();
