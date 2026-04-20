import axios, { AxiosError } from 'axios';
import type { AxiosInstance, InternalAxiosRequestConfig } from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://api.restaurant.local';
type QueryParams = object;
type RequestData = unknown;
type FormFieldValue = string | number | boolean | Blob | File | null | undefined;

interface RefreshTokenResponse {
  success: boolean;
  data?: {
    token?: {
      access_token: string;
      refresh_token?: string;
      expires_in: number;
      token_type: string;
    };
  };
}

interface RetriableRequestConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

export class ApiClient {
  private client: AxiosInstance;
  private tokenKey = 'auth_token';
  private refreshTokenKey = 'refresh_token';
  private refreshPromise: Promise<string | null> | null = null;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    });

    this.client.interceptors.request.use(
      (config: InternalAxiosRequestConfig) => {
        const token = this.getToken();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        // Add timestamp and user_id for audit
        const userId = this.getUserId();
        if (userId) {
          config.headers['X-User-ID'] = userId;
          config.headers['X-Timestamp'] = new Date().toISOString();
        }
        return config;
      },
      (error: AxiosError) => {
        return Promise.reject(error);
      }
    );

    this.client.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        const originalRequest = error.config as RetriableRequestConfig | undefined;
        const status = error.response?.status;
        const requestUrl = originalRequest?.url ?? '';

        const canAttemptRefresh =
          status === 401 &&
          !!originalRequest &&
          !originalRequest._retry &&
          !requestUrl.includes('/auth-refresh') &&
          !requestUrl.includes('/auth-login');

        if (canAttemptRefresh && originalRequest) {
          originalRequest._retry = true;
          const nextAccessToken = await this.refreshAccessToken();

          if (nextAccessToken) {
            originalRequest.headers.Authorization = `Bearer ${nextAccessToken}`;
            return this.client(originalRequest);
          }
        }

        if (status === 401) {
          this.clearToken();
          window.location.href = '/login';
        }

        return Promise.reject(error);
      }
    );
  }

  setToken(token: string, userId: string, refreshToken?: string) {
    localStorage.setItem(this.tokenKey, token);
    localStorage.setItem('user_id', userId);
    if (refreshToken) {
      localStorage.setItem(this.refreshTokenKey, refreshToken);
    }
  }

  getToken(): string | null {
    return localStorage.getItem(this.tokenKey);
  }

  getRefreshToken(): string | null {
    return localStorage.getItem(this.refreshTokenKey);
  }

  getUserId(): string | null {
    return localStorage.getItem('user_id');
  }

  clearToken() {
    localStorage.removeItem(this.tokenKey);
    localStorage.removeItem(this.refreshTokenKey);
    localStorage.removeItem('user_id');
  }

  private async refreshAccessToken(): Promise<string | null> {
    const refreshToken = this.getRefreshToken();
    if (!refreshToken) {
      return null;
    }

    if (!this.refreshPromise) {
      this.refreshPromise = (async () => {
        try {
          const response = await axios.post<RefreshTokenResponse>(
            `${API_BASE_URL}/auth-refresh`,
            {
              refresh_token: refreshToken,
            },
            {
              headers: {
                'Content-Type': 'application/json',
              },
              timeout: 30000,
            }
          );

          const nextToken = response.data.data?.token;
          if (!response.data.success || !nextToken?.access_token) {
            return null;
          }

          localStorage.setItem(this.tokenKey, nextToken.access_token);
          if (nextToken.refresh_token) {
            localStorage.setItem(this.refreshTokenKey, nextToken.refresh_token);
          }

          return nextToken.access_token;
        } catch {
          return null;
        } finally {
          this.refreshPromise = null;
        }
      })();
    }

    return this.refreshPromise;
  }

  async get<T>(url: string, params?: QueryParams) {
    return this.client.get<T>(url, { params });
  }

  async getBlob(url: string, params?: QueryParams) {
    return this.client.get<Blob>(url, {
      params,
      responseType: 'blob',
    });
  }

  async post<T>(url: string, data?: RequestData) {
    return this.client.post<T>(url, data);
  }

  async put<T>(url: string, data?: RequestData) {
    return this.client.put<T>(url, data);
  }

  async patch<T>(url: string, data?: RequestData) {
    return this.client.patch<T>(url, data);
  }

  async delete<T>(url: string) {
    return this.client.delete<T>(url);
  }

  async uploadFile<T>(
    url: string,
    file: File,
    additionalData?: object
  ) {
    const formData = new FormData();
    formData.append('file', file);

    if (additionalData) {
      Object.entries(additionalData as Record<string, FormFieldValue>).forEach(([key, value]) => {
        if (value === null || value === undefined) {
          return;
        }

        if (value instanceof Blob) {
          formData.append(key, value);
          return;
        }

        formData.append(key, String(value));
      });
    }

    return this.client.post<T>(url, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  }
}

export const apiClient = new ApiClient();
