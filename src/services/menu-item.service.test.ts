import { beforeEach, describe, expect, it, vi } from 'vitest';
import { menuItemService } from './menu-item.service';
import { apiClient } from './api-client';

vi.mock('./api-client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    uploadFile: vi.fn(),
  },
}));

describe('MenuItemService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('obtiene items paginados', async () => {
    const payload = { data: [{ id: '1', name: 'Pizza' }], total: 1 };
    vi.mocked(apiClient.get).mockResolvedValue({ data: payload } as never);

    const result = await menuItemService.getMenuItems(2, 10);

    expect(apiClient.get).toHaveBeenCalledWith('/menu-items', { page: 2, limit: 10 });
    expect(result).toEqual(payload);
  });

  it('crea un item de menu', async () => {
    const formData = { name: 'Pasta', price: 12, category: 'Main' };
    const created = { id: '22', ...formData };
    vi.mocked(apiClient.post).mockResolvedValue({ data: created } as never);

    const result = await menuItemService.createMenuItem(formData);

    expect(apiClient.post).toHaveBeenCalledWith('/menu-items', formData);
    expect(result).toEqual(created);
  });

  it('actualiza disponibilidad con motivo', async () => {
    const updated = { id: '1', available: false };
    vi.mocked(apiClient.patch).mockResolvedValue({ data: updated } as never);

    const result = await menuItemService.updateAvailability('1', false, 'agotado');

    expect(apiClient.patch).toHaveBeenCalledWith('/menu-items/1/availability', {
      available: false,
      reason: 'agotado',
    });
    expect(result).toEqual(updated);
  });

  it('sube imagen con datos del item', async () => {
    const formData = { name: 'Ensalada', price: 8, category: 'Starter' };
    const image = new File(['data'], 'dish.png', { type: 'image/png' });
    const created = { id: '3', ...formData, image: '/dish.png' };
    vi.mocked(apiClient.uploadFile).mockResolvedValue({ data: created } as never);

    const result = await menuItemService.createMenuItemWithImage(formData, image);

    expect(apiClient.uploadFile).toHaveBeenCalledWith('/menu-items/upload', image, formData);
    expect(result).toEqual(created);
  });

  it('obtiene categorias', async () => {
    const categories = ['Starter', 'Main', 'Drink'];
    vi.mocked(apiClient.get).mockResolvedValue({ data: categories } as never);

    const result = await menuItemService.getCategories();

    expect(apiClient.get).toHaveBeenCalledWith('/menu-items/categories');
    expect(result).toEqual(categories);
  });
});

