import { apiClient } from './api-client';
import type { AuditLog, AuditLogFilter, PaginatedResponse } from '@/types';

export class AuditLogService {
  private basePath = '/audit-log';

  async getAuditLogs(page = 1, limit = 20, filter?: AuditLogFilter) {
    const response = await apiClient.get<PaginatedResponse<AuditLog>>(this.basePath, {
      page,
      limit,
      ...filter,
    });
    return response.data;
  }

  async getAuditLogById(id: string) {
    const response = await apiClient.get<AuditLog>(`${this.basePath}/${id}`);
    return response.data;
  }

  async exportAuditLogs(filter?: AuditLogFilter) {
    const response = await apiClient.get(`${this.basePath}/export/csv`, filter);
    return response.data as Blob;
  }
}

export const auditLogService = new AuditLogService();

