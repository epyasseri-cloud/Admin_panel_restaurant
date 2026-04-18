import { useState, useEffect, useCallback } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { settingsSchema } from '@/utils/validation.schemas';
import type { SettingsFormData } from '@/utils/validation.schemas';
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Label, Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui';
import { settingsService } from '@/services';
import { getErrorMessage } from '@/utils/helpers';

export function SettingsPage() {
    const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
    reset,
  } = useForm({
    resolver: zodResolver(settingsSchema),
  });

  const { fields: hoursFields, remove: removeHour } = useFieldArray({
    control,
    name: 'operating_hours',
  });

  const { fields: tableFields, append: appendTable, remove: removeTable } = useFieldArray({
    control,
    name: 'tables',
  });

  // Load settings
  const loadSettings = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await settingsService.getSettings();
            reset({
        restaurant_name: response.restaurant_name,
        currency: response.currency,
        timezone: response.timezone,
        operating_hours: response.operating_hours,
        tables: response.tables,
      });
    } catch (error) {
      setError(getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }, [reset]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const onSubmit = async (data: SettingsFormData) => {
    try {
      setIsSubmitting(true);
      setError(null);
      await settingsService.updateRestaurantName(data.restaurant_name);
      if (data.operating_hours) {
        await settingsService.updateOperatingHours(data.operating_hours);
      }
      if (data.tables) {
        await settingsService.updateTables(data.tables);
      }
      await loadSettings();
    } catch (error) {
      setError(getErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return <p>Cargando...</p>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Configuración</h1>

      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <p className="text-red-700">{error}</p>
          </CardContent>
        </Card>
      )}

      <form onSubmit={handleSubmit((data) => onSubmit(data as SettingsFormData))} className="space-y-6">
        <Tabs defaultValue="general" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="hours">Horarios</TabsTrigger>
            <TabsTrigger value="tables">Mesas</TabsTrigger>
          </TabsList>

          <TabsContent value="general">
            <Card>
              <CardHeader>
                <CardTitle>Información General</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="restaurant_name">Nombre del restaurante *</Label>
                  <Input
                    id="restaurant_name"
                    {...register('restaurant_name')}
                    className={errors.restaurant_name ? 'border-red-500' : ''}
                  />
                  {errors.restaurant_name && (
                    <p className="text-red-500 text-sm mt-1">
                      {errors.restaurant_name.message}
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="currency">Moneda *</Label>
                    <Input
                      id="currency"
                      {...register('currency')}
                      maxLength={3}
                      className={errors.currency ? 'border-red-500' : ''}
                    />
                  </div>

                  <div>
                    <Label htmlFor="timezone">Zona horaria *</Label>
                    <Input
                      id="timezone"
                      {...register('timezone')}
                      placeholder="America/New_York"
                      className={errors.timezone ? 'border-red-500' : ''}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="hours">
            <Card>
              <CardHeader>
                <CardTitle>Horarios de Operación</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {hoursFields.map((field, index) => (
                  <div key={field.id} className="p-4 border rounded space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="font-medium capitalize">{field.day}</span>
                      <Button
                        type="button"
                        size="sm"
                        variant="destructive"
                        onClick={() => removeHour(index)}
                      >
                        Eliminar
                      </Button>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <Label>Abre</Label>
                        <Input
                          type="time"
                          {...register(`operating_hours.${index}.open_time`)}
                        />
                      </div>
                      <div>
                        <Label>Cierra</Label>
                        <Input
                          type="time"
                          {...register(`operating_hours.${index}.close_time`)}
                        />
                      </div>
                      <div className="flex items-end">
                        <label className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            {...register(`operating_hours.${index}.is_closed`)}
                          />
                          <span>Cerrado</span>
                        </label>
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="tables">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle>Mesas</CardTitle>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      appendTable({
                        number: (tableFields.length || 0) + 1,
                        name: `Mesa ${(tableFields.length || 0) + 1}`,
                        capacity: 4,
                        is_active: true,
                      })
                    }
                  >
                    Agregar mesa
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {tableFields.map((field, index) => (
                  <div key={field.id} className="p-4 border rounded space-y-3">
                    <div className="grid grid-cols-4 gap-4">
                      <div>
                        <Label>Número</Label>
                        <Input
                          type="number"
                          {...register(`tables.${index}.number`, { valueAsNumber: true })}
                          min="1"
                        />
                      </div>
                      <div>
                        <Label>Nombre</Label>
                        <Input {...register(`tables.${index}.name`)} />
                      </div>
                      <div>
                        <Label>Capacidad</Label>
                        <Input
                          type="number"
                          {...register(`tables.${index}.capacity`, { valueAsNumber: true })}
                          min="1"
                        />
                      </div>
                      <div className="flex items-end">
                        <Button
                          type="button"
                          size="sm"
                          variant="destructive"
                          onClick={() => removeTable(index)}
                        >
                          Eliminar
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Guardando...' : 'Guardar cambios'}
        </Button>
      </form>
    </div>
  );
}

