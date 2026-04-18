import { useState, useEffect, useCallback } from 'react';
import { MenuItemsList } from '@/components/menu-items/menu-items-list';
import type { MenuItem, CreateMenuItemDTO } from '@/types';
import { Button, Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, Card, CardContent } from '@/components/ui';
import { MenuItemForm } from '@/components/menu-items/menu-item-form';
import { authService, menuItemService } from '@/services';
import { useTwoFactorStore } from '@/store/two-factor.store';
import { getErrorMessage } from '@/utils/helpers';

export function MenuItemsPage() {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [isFormSubmitting, setIsFormSubmitting] = useState(false);
  const openChallenge = useTwoFactorStore((state) => state.openChallenge);

  // Load menu items
  const loadMenuItems = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await menuItemService.getMenuItems();
      setItems(response.data);
      const cats = await menuItemService.getCategories();
      setCategories(cats || []);
    } catch (error) {
      setError(getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMenuItems();
  }, [loadMenuItems]);

  // Handle create/edit
  const handleFormSubmit = async (data: CreateMenuItemDTO) => {
    try {
      setIsFormSubmitting(true);
      if (editingItem) {
        // Check if price changed
        if (editingItem.price !== data.price) {
          const challenge = await authService.createTwoFactorChallenge('menu_price_change');

          // Trigger 2FA for price change
          openChallenge(
            challenge.challenge_id,
            `Cambio de precio para "${data.name}"`,
            async (totpCode) => {
              await authService.verifyTwoFactor({
                challenge_id: challenge.challenge_id,
                totp_code: totpCode,
              });
              await menuItemService.updateMenuItem(editingItem.id, data);
              await loadMenuItems();
              setIsFormOpen(false);
              setEditingItem(null);
            }
          );
        } else {
          await menuItemService.updateMenuItem(editingItem.id, data);
          await loadMenuItems();
          setIsFormOpen(false);
          setEditingItem(null);
        }
      } else {
        await menuItemService.createMenuItem(data);
        await loadMenuItems();
        setIsFormOpen(false);
      }
    } catch (error) {
      setError(getErrorMessage(error));
    } finally {
      setIsFormSubmitting(false);
    }
  };

  // Handle delete
  const handleDelete = async (item: MenuItem) => {
    if (!confirm(`¿Estás seguro de que deseas eliminar "${item.name}"?`)) {
      return;
    }
    try {
      await menuItemService.deleteMenuItem(item.id);
      await loadMenuItems();
    } catch (error) {
      setError(getErrorMessage(error));
    }
  };

  // Handle availability toggle
  const handleToggleAvailability = async (item: MenuItem) => {
    try {
      await menuItemService.updateAvailability(
        item.id,
        !item.available,
        !item.available ? '' : `Excluido por admin`
      );
      await loadMenuItems();
    } catch (error) {
      setError(getErrorMessage(error));
    }
  };


  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Gestión del Menú</h1>
          <p className="text-muted-foreground mt-1">
            Total de ítems: {items.length}
          </p>
        </div>
        <Button onClick={() => {
          setEditingItem(null);
          setIsFormOpen(true);
        }}>
          Crear ítem
        </Button>
      </div>

      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <p className="text-red-700">{error}</p>
          </CardContent>
        </Card>
      )}

      <MenuItemsList
        items={items}
        isLoading={isLoading}
        onEdit={(item) => {
          setEditingItem(item);
          setIsFormOpen(true);
        }}
        onDelete={handleDelete}
        onToggleAvailability={handleToggleAvailability}
      />

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingItem ? 'Editar ítem' : 'Crear nuevo ítem'}
            </DialogTitle>
            <DialogDescription>
              {editingItem
                ? 'Modifica los detalles del ítem'
                : 'Crea un nuevo ítem en el menú'}
            </DialogDescription>
          </DialogHeader>
          <MenuItemForm
            initialData={editingItem || undefined}
            onSubmit={handleFormSubmit}
            isLoading={isFormSubmitting}
            categories={categories}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

