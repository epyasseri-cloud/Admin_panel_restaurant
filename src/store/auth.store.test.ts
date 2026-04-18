import { beforeEach, describe, expect, it } from 'vitest';
import { useAuthStore } from './auth.store';

describe('AuthStore', () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
    });
  });

  it('inicia sin usuario autenticado', () => {
    const state = useAuthStore.getState();

    expect(state.user).toBeNull();
    expect(state.isAuthenticated).toBe(false);
    expect(state.error).toBeNull();
  });

  it('setUser autentica cuando recibe usuario', () => {
    useAuthStore.getState().setUser({
      id: '1',
      email: 'admin@test.com',
      name: 'Admin',
      role: 'admin',
    });

    const state = useAuthStore.getState();
    expect(state.user?.email).toBe('admin@test.com');
    expect(state.isAuthenticated).toBe(true);
  });

  it('logout limpia sesion', () => {
    useAuthStore.setState({
      user: { id: '1', email: 'admin@test.com', name: 'Admin', role: 'admin' },
      isAuthenticated: true,
      isLoading: false,
      error: 'x',
    });

    useAuthStore.getState().logout();

    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.isAuthenticated).toBe(false);
    expect(state.error).toBeNull();
  });
});
