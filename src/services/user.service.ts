import { apiClient } from './api-client';
import type { User, CreateUserDTO, UpdateUserDTO, PaginatedResponse } from '@/types';

export class UserService {
  private basePath = '/users';

  async getUsers(page = 1, limit = 20, role?: string) {
    const response = await apiClient.get<PaginatedResponse<User>>(this.basePath, {
      page,
      limit,
      role,
    });
    return response.data;
  }

  async getUserById(id: string) {
    const response = await apiClient.get<User>(`${this.basePath}/${id}`);
    return response.data;
  }

  async createUser(data: CreateUserDTO) {
    const response = await apiClient.post<User & { temporary_password: string }>(
      this.basePath,
      data
    );
    return response.data;
  }

  async updateUser(id: string, data: UpdateUserDTO) {
    const response = await apiClient.put<User>(`${this.basePath}/${id}`, data);
    return response.data;
  }

  async deleteUser(id: string) {
    const response = await apiClient.delete(`${this.basePath}/${id}`);
    return response.data;
  }

  async resetPassword(userId: string) {
    const response = await apiClient.post<{ temporary_password: string }>(
      `${this.basePath}/${userId}/reset-password`
    );
    return response.data;
  }

  async getWaiters() {
    const response = await apiClient.get<User[]>(this.basePath, {
      role: 'waiter',
    });
    return response.data;
  }
}

export const userService = new UserService();
