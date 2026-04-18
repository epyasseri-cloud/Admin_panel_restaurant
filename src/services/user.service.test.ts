import { beforeEach, describe, expect, it, vi } from 'vitest';
import { userService } from './user.service';
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

describe('UserService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('obtiene usuarios paginados', async () => {
    const response = { data: [{ id: 'u1', email: 'a@test.com', name: 'A', role: 'admin' }], total: 1 };
    vi.mocked(apiClient.get).mockResolvedValue({ data: response } as never);

    const result = await userService.getUsers(1, 20, 'admin');

    expect(apiClient.get).toHaveBeenCalledWith('/users', { page: 1, limit: 20, role: 'admin' });
    expect(result).toEqual(response);
  });

  it('crea usuario', async () => {
    const payload = { email: 'nuevo@test.com', name: 'Nuevo', role: 'waiter' as const };
    const created = { id: 'u2', ...payload, temporary_password: 'temp12345' };
    vi.mocked(apiClient.post).mockResolvedValue({ data: created } as never);

    const result = await userService.createUser(payload);

    expect(apiClient.post).toHaveBeenCalledWith('/users', payload);
    expect(result).toEqual(created);
  });

  it('resetea password y retorna temporal', async () => {
    const resetResponse = { temporary_password: 'abc12345' };
    vi.mocked(apiClient.post).mockResolvedValue({ data: resetResponse } as never);

    const result = await userService.resetPassword('u2');

    expect(apiClient.post).toHaveBeenCalledWith('/users/u2/reset-password');
    expect(result).toEqual(resetResponse);
  });

  it('filtra meseros con getWaiters', async () => {
    const waiters = [{ id: 'w1', name: 'Mesero', email: 'w@test.com', role: 'waiter' }];
    vi.mocked(apiClient.get).mockResolvedValue({ data: waiters } as never);

    const result = await userService.getWaiters();

    expect(apiClient.get).toHaveBeenCalledWith('/users', { role: 'waiter' });
    expect(result).toEqual(waiters);
  });
});
