import { Link, useLocation } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { Button } from '@/components/ui';
import { useAuthStore } from '@/store/auth.store';

interface SidebarProps {
  onLogout: () => void;
}

export function Sidebar({ onLogout }: SidebarProps) {
  const location = useLocation();
  const user = useAuthStore((state) => state.user);

  const menuItems = [
    { label: 'Panel', href: '/dashboard' },
    { label: 'Menú', href: '/menu-items' },
    { label: 'Usuarios', href: '/users' },
    { label: 'Configuración', href: '/settings' },
    { label: 'Reportes', href: '/reports' },
    { label: 'Auditoría', href: '/audit-logs' },
  ];

  const isActive = (href: string) => location.pathname === href;

  return (
    <aside className="w-64 bg-card border-r border-border h-screen flex flex-col">
      <div className="p-6 border-b border-border">
        <h1 className="text-xl font-bold">Admin Restaurant</h1>
        <p className="text-sm text-muted-foreground mt-1">{user?.name}</p>
      </div>

      <nav className="flex-1 overflow-y-auto p-4 space-y-2">
        {menuItems.map((item) => (
          <Link
            key={item.href}
            to={item.href}
            className={`block px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              isActive(item.href)
                ? 'bg-primary text-primary-foreground'
                : 'text-foreground hover:bg-accent hover:text-accent-foreground'
            }`}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="p-4 border-t border-border">
        <Button
          onClick={onLogout}
          variant="ghost"
          size="sm"
          className="w-full justify-start"
        >
          <LogOut className="w-4 h-4 mr-2" />
          Salir
        </Button>
      </div>
    </aside>
  );
}
