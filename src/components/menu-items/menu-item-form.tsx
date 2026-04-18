import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { MenuItem } from '@/types';
import { menuItemSchema } from '@/utils/validation.schemas';
import type { MenuItemFormData } from '@/utils/validation.schemas';
import { Button, Input, Label, Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui';

interface MenuItemFormProps {
  initialData?: MenuItem;
  onSubmit: (data: MenuItemFormData) => Promise<void>;
  isLoading?: boolean;
  categories: string[];
}

export function MenuItemForm({
  initialData,
  onSubmit,
  isLoading = false,
  categories,
}: MenuItemFormProps) {
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
    watch,
  } = useForm({
    resolver: zodResolver(menuItemSchema),
    defaultValues: initialData
      ? {
          name: initialData.name,
          description: initialData.description || '',
          price: initialData.price,
          category: initialData.category,
          image: initialData.image || '',
          estimated_prep_time: initialData.estimated_prep_time || 0,
          ingredients: initialData.ingredients || [],
          available: initialData.available ?? true,
        }
      : {
          available: true,
          ingredients: [],
        },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'ingredients',
  });

  const imageValue = watch('image');

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <Tabs defaultValue="basic" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="basic">Información</TabsTrigger>
          <TabsTrigger value="details">Detalles</TabsTrigger>
          <TabsTrigger value="ingredients">Ingredientes</TabsTrigger>
        </TabsList>

        <TabsContent value="basic" className="space-y-4">
          <div>
            <Label htmlFor="name">Nombre *</Label>
            <Input
              id="name"
              {...register('name')}
              placeholder="Nombre del ítem"
              className={errors.name ? 'border-red-500' : ''}
            />
            {errors.name && (
              <p className="text-red-500 text-sm mt-1">{errors.name.message}</p>
            )}
          </div>

          <div>
            <Label htmlFor="description">Descripción</Label>
            <textarea
              id="description"
              {...register('description')}
              placeholder="Descripción del ítem"
              className="w-full border rounded px-3 py-2"
              rows={4}
            />
            {errors.description && (
              <p className="text-red-500 text-sm mt-1">{errors.description.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="price">Precio *</Label>
              <Input
                id="price"
                type="number"
                step="0.01"
                {...register('price', { valueAsNumber: true })}
                placeholder="0.00"
                className={errors.price ? 'border-red-500' : ''}
              />
              {errors.price && (
                <p className="text-red-500 text-sm mt-1">{errors.price.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="category">Categoría *</Label>
              <Input
                id="category"
                list="menu-item-categories"
                {...register('category')}
                placeholder="Escribe o selecciona una categoría"
                className={errors.category ? 'border-red-500' : ''}
              />
              <datalist id="menu-item-categories">
                {categories.map((cat) => (
                  <option key={cat} value={cat} />
                ))}
              </datalist>
              {errors.category && (
                <p className="text-red-500 text-sm mt-1">{errors.category.message}</p>
              )}
            </div>
          </div>

          <div>
            <Label htmlFor="image">Imagen (URL)</Label>
            <Input
              id="image"
              type="url"
              {...register('image')}
              placeholder="https://ejemplo.com/imagen.jpg"
            />
            {imageValue && (
              <div className="mt-2">
                <img
                  src={imageValue}
                  alt="Preview"
                  className="h-32 w-32 object-cover rounded"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="details" className="space-y-4">
          <div>
            <Label htmlFor="estimated_prep_time">Tiempo estimado de preparación (minutos)</Label>
            <Input
              id="estimated_prep_time"
              type="number"
              {...register('estimated_prep_time', { valueAsNumber: true })}
              placeholder="30"
              min="0"
            />
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="available"
              {...register('available')}
              className="rounded"
            />
            <Label htmlFor="available" className="cursor-pointer">
              Disponible
            </Label>
          </div>
        </TabsContent>

        <TabsContent value="ingredients" className="space-y-4">
          <div>
            <div className="flex justify-between items-center mb-4">
              <Label>Ingredientes</Label>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => append({ name: '', allergen: false })}
              >
                Agregar ingrediente
              </Button>
            </div>

            <div className="space-y-3">
              {fields.map((field, index) => (
                <div key={field.id} className="flex gap-2 items-end">
                  <div className="flex-1">
                    <Input
                      {...register(`ingredients.${index}.name`)}
                      placeholder="Nombre del ingrediente"
                    />
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      {...register(`ingredients.${index}.allergen`)}
                      className="rounded"
                    />
                    <Label htmlFor={`allergen-${index}`} className="cursor-pointer">
                      Alérgeno
                    </Label>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    onClick={() => remove(index)}
                  >
                    Eliminar
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <Button type="submit" disabled={isLoading} className="w-full">
        {isLoading ? 'Guardando...' : 'Guardar ítem'}
      </Button>
    </form>
  );
}
