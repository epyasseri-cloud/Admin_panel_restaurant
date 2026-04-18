import { useState, useEffect, useCallback } from 'react';
import type { AuditLog } from '@/types';
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Label } from '@/components/ui';
import { auditLogService } from '@/services';
import { getErrorMessage, formatDateTime, downloadFile } from '@/utils/helpers';

export function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [eventType, setEventType] = useState('');

  const loadLogs = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await auditLogService.getAuditLogs(1, 100, {
        from_date: fromDate,
        to_date: toDate,
        event_type: eventType as any,
      });
      setLogs(response.data);
    } catch (error) {
      setError(getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }, [fromDate, toDate, eventType]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  const handleExport = async () => {
    try {
      const blob = await auditLogService.exportAuditLogs({
        from_date: fromDate,
        to_date: toDate,
        event_type: eventType as any,
      });
      downloadFile(blob, `audit-log-${Date.now()}.csv`);
    } catch (error) {
      setError(getErrorMessage(error));
    }
  };

  const eventTypeLabels: Record<string, string> = {
    menu_item_created: 'Ítem creado',
    menu_item_updated: 'Ítem actualizado',
    menu_item_deleted: 'Ítem eliminado',
    menu_item_availability_changed: 'Disponibilidad cambiada',
    user_created: 'Usuario creado',
    user_updated: 'Usuario actualizado',
    user_deleted: 'Usuario eliminado',
    price_changed: 'Precio cambiado',
    bulk_exclusion: 'Exclusión masiva',
    settings_updated: 'Configuración actualizada',
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Historial de Auditoría</h1>

      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <p className="text-red-700">{error}</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-4">
            <div>
              <Label>Desde</Label>
              <Input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
              />
            </div>
            <div>
              <Label>Hasta</Label>
              <Input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
              />
            </div>
            <div>
              <Label>Tipo de evento</Label>
              <select
                value={eventType}
                onChange={(e) => setEventType(e.target.value)}
                className="w-full border rounded px-3 py-2"
              >
                <option value="">Todos</option>
                {Object.entries(eventTypeLabels).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <Button onClick={handleExport} variant="outline">
                Exportar CSV
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <p className="text-center text-muted-foreground">Cargando...</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-4 font-medium">Fecha y hora</th>
                    <th className="text-left py-2 px-4 font-medium">Usuario</th>
                    <th className="text-left py-2 px-4 font-medium">Evento</th>
                    <th className="text-left py-2 px-4 font-medium">Recurso</th>
                    <th className="text-left py-2 px-4 font-medium">Cambios</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id} className="border-b hover:bg-muted/50">
                      <td className="py-2 px-4 text-xs">{formatDateTime(log.created_at)}</td>
                      <td className="py-2 px-4">{log.user_id}</td>
                      <td className="py-2 px-4">
                        <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-medium">
                          {eventTypeLabels[log.event_type] || log.event_type}
                        </span>
                      </td>
                      <td className="py-2 px-4">
                        {log.resource_type}: {log.resource_id}
                      </td>
                      <td className="py-2 px-4 text-xs">
                        <details>
                          <summary className="cursor-pointer">Ver</summary>
                          <pre className="text-xs mt-2 p-2 bg-muted rounded overflow-auto max-w-xs">
                            {JSON.stringify(log.changes, null, 2)}
                          </pre>
                        </details>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {logs.length === 0 && (
                <p className="text-center text-muted-foreground py-4">
                  No hay registros
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

