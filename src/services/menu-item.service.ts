import { apiClient } from './api-client';
import type { MenuItem, CreateMenuItemDTO, PaginatedResponse } from '@/types';

export class MenuItemService {
  private basePath = '/menu-items';

  async getMenuItems(page = 1, limit = 20) {
    const response = await apiClient.get<PaginatedResponse<MenuItem>>(this.basePath, {
      page,
      limit,
    });
    return response.data;
  }

  async searchMenuItems(query: string, category?: string) {
    const response = await apiClient.get<MenuItem[]>(this.basePath, {
      search: query,
      category,
    });
    return response.data;
  }

  async getMenuItemById(id: string) {
    const response = await apiClient.get<MenuItem>(`${this.basePath}/${id}`);
    return response.data;
  }

  async createMenuItem(data: CreateMenuItemDTO) {
    const response = await apiClient.post<MenuItem>(this.basePath, data);
    return response.data;
  }

  async createMenuItemWithImage(data: CreateMenuItemDTO, imageFile: File) {
    const response = await apiClient.uploadFile<MenuItem>(
      `${this.basePath}/upload`,
      imageFile,
      data
    );
    return response.data;
  }

  async updateMenuItem(id: string, data: Partial<CreateMenuItemDTO>) {
    const response = await apiClient.put<MenuItem>(`${this.basePath}/${id}`, data);
    return response.data;
  }

  async deleteMenuItem(id: string) {
    const response = await apiClient.delete(`${this.basePath}/${id}`);
    return response.data;
  }

  async updateAvailability(id: string, available: boolean, reason?: string) {
    const response = await apiClient.patch<MenuItem>(`${this.basePath}/${id}/availability`, {
      available,
      reason,
    });
    return response.data;
  }

  async bulkUpdateAvailability(category: string, available: boolean) {
    const response = await apiClient.patch<{ updated: number }>(
      `${this.basePath}/bulk/availability`,
      {
        category,
        available,
      }
    );
    return response.data;
  }

  async getCategories() {
    const response = await apiClient.get<string[]>(`${this.basePath}/categories`);
    return response.data;
  }
}

export const menuItemService = new MenuItemService();

