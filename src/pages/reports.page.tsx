import { useState, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { reportFilterSchema } from '@/utils/validation.schemas';
import type { ReportFilterFormData } from '@/utils/validation.schemas';
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Label } from '@/components/ui';
import type { ReportData } from '@/types';
import { reportService } from '@/services';
import { getErrorMessage, formatCurrency, downloadFile, formatDate } from '@/utils/helpers';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export function ReportsPage() {
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
  } = useForm<ReportFilterFormData>({
    resolver: zodResolver(reportFilterSchema),
    defaultValues: {
      from_date: formatDate(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)),
      to_date: formatDate(new Date()),
      group_by: 'date',
    },
  });

  const onSubmit = useCallback(
    async (data: ReportFilterFormData) => {
      try {
        setIsLoading(true);
        setError(null);
        const response = await reportService.generateReport(data);
        setReportData(response);
      } catch (error) {
        setError(getErrorMessage(error));
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const handleExportCSV = async () => {
    const formData = watch();
    try {
      const blob = await reportService.exportReportCSV({
        from_date: formData.from_date,
        to_date: formData.to_date,
        group_by: formData.group_by,
      });
      downloadFile(blob, `reporte-${Date.now()}.csv`);
    } catch (error) {
      setError(getErrorMessage(error));
    }
  };

  const handleExportPDF = async () => {
    const formData = watch();
    try {
      const blob = await reportService.exportReportPDF({
        from_date: formData.from_date,
        to_date: formData.to_date,
        group_by: formData.group_by,
      });
      downloadFile(blob, `reporte-${Date.now()}.pdf`);
    } catch (error) {
      setError(getErrorMessage(error));
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Reportes de Ventas</h1>

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
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="from_date">Desde *</Label>
                <Input
                  id="from_date"
                  type="date"
                  {...register('from_date')}
                  className={errors.from_date ? 'border-red-500' : ''}
                />
                {errors.from_date && (
                  <p className="text-red-500 text-sm mt-1">{errors.from_date.message}</p>
                )}
              </div>

              <div>
                <Label htmlFor="to_date">Hasta *</Label>
                <Input
                  id="to_date"
                  type="date"
                  {...register('to_date')}
                  className={errors.to_date ? 'border-red-500' : ''}
                />
                {errors.to_date && (
                  <p className="text-red-500 text-sm mt-1">{errors.to_date.message}</p>
                )}
              </div>

              <div>
                <Label htmlFor="group_by">Agrupar por *</Label>
                <select
                  id="group_by"
                  {...register('group_by')}
                  className="w-full border rounded px-3 py-2"
                >
                  <option value="date">Fecha</option>
                  <option value="table">Mesa</option>
                  <option value="waiter">Mesero</option>
                  <option value="dish">Platillo</option>
                </select>
              </div>
            </div>

            <div className="flex gap-2 justify-end">
              <Button type="submit" disabled={isLoading}>
                {isLoading ? 'Generando...' : 'Generar reporte'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {reportData && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Resumen</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-4 gap-4">
              <div className="p-4 bg-muted rounded">
                <p className="text-sm text-muted-foreground">Total de pedidos</p>
                <p className="text-2xl font-bold">{reportData.total_orders}</p>
              </div>
              <div className="p-4 bg-muted rounded">
                <p className="text-sm text-muted-foreground">Total de ingresos</p>
                <p className="text-2xl font-bold">{formatCurrency(reportData.total_revenue)}</p>
              </div>
              <div className="p-4 bg-muted rounded">
                <p className="text-sm text-muted-foreground">Ítems vendidos</p>
                <p className="text-2xl font-bold">{reportData.items_sold}</p>
              </div>
              <div className="p-4 bg-muted rounded">
                <p className="text-sm text-muted-foreground">Promedio por pedido</p>
                <p className="text-2xl font-bold">
                  {formatCurrency(
                    reportData.total_orders > 0
                      ? reportData.total_revenue / reportData.total_orders
                      : 0
                  )}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Gráfico de ventas</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={reportData.details}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="total_revenue" fill="#8884d8" name="Ingresos" />
                  <Bar dataKey="quantity" fill="#82ca9d" name="Cantidad" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Detalle</CardTitle>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={handleExportCSV}>
                    Descargar CSV
                  </Button>
                  <Button size="sm" variant="outline" onClick={handleExportPDF}>
                    Descargar PDF
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-4 font-medium">Nombre</th>
                      <th className="text-left py-2 px-4 font-medium">Cantidad</th>
                      <th className="text-left py-2 px-4 font-medium">Total</th>
                      <th className="text-left py-2 px-4 font-medium">% del total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.details.map((detail) => (
                      <tr key={detail.id} className="border-b hover:bg-muted/50">
                        <td className="py-2 px-4">{detail.name}</td>
                        <td className="py-2 px-4">{detail.quantity}</td>
                        <td className="py-2 px-4">{formatCurrency(detail.total_revenue)}</td>
                        <td className="py-2 px-4">{detail.percentage_of_total.toFixed(2)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

