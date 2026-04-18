import { apiClient } from './api-client';
import type { AuthToken, AuthUser, TwoFactorChallenge, TwoFactorVerifyRequest, TwoFactorVerifyResponse } from '@/types';

export class AuthService {
  private basePath = '/auth';

  async login(email: string, password: string) {
    const response = await apiClient.post<{ token: AuthToken; user: AuthUser }>(
      `${this.basePath}/login`,
      {
        email,
        password,
      }
    );
    return response.data;
  }

  async logout() {
    const response = await apiClient.post(`${this.basePath}/logout`);
    return response.data;
  }

  async verifyToken() {
    const response = await apiClient.get<AuthUser>(`${this.basePath}/me`);
    return response.data;
  }

  async createTwoFactorChallenge(action: string) {
    const response = await apiClient.post<TwoFactorChallenge>(
      `${this.basePath}/2fa/challenge`,
      {
        action,
      }
    );
    return response.data;
  }

  async verifyTwoFactor(request: TwoFactorVerifyRequest) {
    const response = await apiClient.post<TwoFactorVerifyResponse>(
      `${this.basePath}/2fa/verify`,
      request
    );
    return response.data;
  }

  async setupTwoFactor() {
    const response = await apiClient.post<{ secret: string; qr_code: string }>(
      `${this.basePath}/2fa/setup`
    );
    return response.data;
  }

  async confirmTwoFactorSetup(totp_code: string) {
    const response = await apiClient.post(`${this.basePath}/2fa/confirm`, {
      totp_code,
    });
    return response.data;
  }

  async disableTwoFactor(totp_code: string) {
    const response = await apiClient.post(`${this.basePath}/2fa/disable`, {
      totp_code,
    });
    return response.data;
  }
}

export const authService = new AuthService();
