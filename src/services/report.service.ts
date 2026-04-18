import { apiClient } from './api-client';
import type { ReportData, ReportFilter } from '@/types';

export class ReportService {
  private basePath = '/reports';

  async generateReport(filter: ReportFilter) {
    const response = await apiClient.get<ReportData>(this.basePath, {
      from_date: filter.from_date,
      to_date: filter.to_date,
      group_by: filter.group_by,
      waiter_id: filter.waiter_id,
      table_id: filter.table_id,
      dish_id: filter.dish_id,
    });
    return response.data;
  }

  async exportReportCSV(filter: ReportFilter) {
    const response = await apiClient.get(
      `${this.basePath}/export/csv`,
      {
        from_date: filter.from_date,
        to_date: filter.to_date,
        group_by: filter.group_by,
        waiter_id: filter.waiter_id,
        table_id: filter.table_id,
        dish_id: filter.dish_id,
      }
    );
    return response.data as Blob;
  }

  async exportReportPDF(filter: ReportFilter) {
    const response = await apiClient.get(
      `${this.basePath}/export/pdf`,
      {
        from_date: filter.from_date,
        to_date: filter.to_date,
        group_by: filter.group_by,
        waiter_id: filter.waiter_id,
        table_id: filter.table_id,
        dish_id: filter.dish_id,
      }
    );
    return response.data as Blob;
  }

  async getSalesStats(period: string = 'month') {
    const response = await apiClient.get(`${this.basePath}/stats`, {
      period,
    });
    return response.data;
  }
}

export const reportService = new ReportService();

