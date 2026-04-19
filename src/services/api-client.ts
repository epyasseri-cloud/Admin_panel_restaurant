import axios, { AxiosError } from 'axios';
import type { AxiosInstance, InternalAxiosRequestConfig } from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://api.restaurant.local';
type QueryParams = object;
type RequestData = unknown;
type FormFieldValue = string | number | boolean | Blob | File | null | undefined;

export class ApiClient {
  private client: AxiosInstance;
  private tokenKey = 'auth_token';

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
      (error: AxiosError) => {
        if (error.response?.status === 401) {
          this.clearToken();
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }
    );
  }

  setToken(token: string, userId: string) {
    localStorage.setItem(this.tokenKey, token);
    localStorage.setItem('user_id', userId);
  }

  getToken(): string | null {
    return localStorage.getItem(this.tokenKey);
  }

  getUserId(): string | null {
    return localStorage.getItem('user_id');
  }

  clearToken() {
    localStorage.removeItem(this.tokenKey);
    localStorage.removeItem('user_id');
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
