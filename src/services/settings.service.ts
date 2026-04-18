import { apiClient } from './api-client';
import type { Settings, OperatingHour, Table } from '@/types';

export class SettingsService {
  private basePath = '/settings';

  async getSettings() {
    const response = await apiClient.get<Settings>(this.basePath);
    return response.data;
  }

  async updateRestaurantName(name: string) {
    const response = await apiClient.patch<Settings>(this.basePath, {
      restaurant_name: name,
    });
    return response.data;
  }

  async updateOperatingHours(hours: OperatingHour[]) {
    const response = await apiClient.patch<Settings>(this.basePath, {
      operating_hours: hours,
    });
    return response.data;
  }

  async updateTables(tables: Table[]) {
    const response = await apiClient.patch<Settings>(this.basePath, {
      tables,
    });
    return response.data;
  }

  async createTable(table: Omit<Table, 'id'>) {
    const response = await apiClient.post<Table>(`${this.basePath}/tables`, table);
    return response.data;
  }

  async updateTable(tableId: string, updates: Partial<Table>) {
    const response = await apiClient.put<Table>(`${this.basePath}/tables/${tableId}`, updates);
    return response.data;
  }

  async deleteTable(tableId: string) {
    const response = await apiClient.delete(`${this.basePath}/tables/${tableId}`);
    return response.data;
  }
}

export const settingsService = new SettingsService();

