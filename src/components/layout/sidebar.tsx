import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  LogOut, 
  LayoutDashboard, 
  Utensils, 
  Users, 
  Settings, 
  BarChart3, 
  History,
  User as UserIcon
} from 'lucide-react';
import { Button } from '@/components/ui';
import { useAuthStore } from '@/store/auth.store';

interface SidebarProps {
  onLogout: () => void;
  isCollapsed?: boolean;
}

export function Sidebar({ onLogout, isCollapsed = false }: SidebarProps) {
  const location = useLocation();
  const user = useAuthStore((state) => state.user);

  const menuGroups = [
    {
      title: 'Principal',
      items: [
        { label: 'Panel', href: '/dashboard', icon: LayoutDashboard },
      ]
    },
    {
      title: 'Administración',
      items: [
        { label: 'Menú', href: '/menu-items', icon: Utensils },
        { label: 'Usuarios', href: '/users', icon: Users },
        { label: 'Reportes', href: '/reports', icon: BarChart3 },
      ]
    },
    {
      title: 'Sistema',
      items: [
        { label: 'Configuración', href: '/settings', icon: Settings },
        { label: 'Auditoría', href: '/audit-logs', icon: History },
      ]
    }
  ];

  const isActive = (href: string) => location.pathname === href;

  return (
    <motion.aside 
      initial={false}
      animate={{ 
        width: isCollapsed ? 80 : 230,
      }}
      transition={{ 
        type: "spring", 
        stiffness: 300, 
        damping: 35,
        mass: 1
      }}
      style={{ backgroundColor: '#c8dccf' }}
      className="border-r border-border h-full flex flex-col absolute top-0 left-0 z-50 overflow-hidden"
    >
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {menuGroups.map((group, idx) => (
          <div key={group.title} className={`${idx !== 0 ? 'mt-8' : 'mt-4'} px-3`}>
            <AnimatePresence>
              {!isCollapsed && (
                <motion.h3 
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 0.8, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  className="px-4 text-[10px] font-extrabold uppercase tracking-[0.2em] text-[#2d7a4d]/70 mb-3"
                >
                  {group.title}
                </motion.h3>
              )}
            </AnimatePresence>
            
            <nav className="space-y-4">
              {group.items.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.href}
                    to={item.href}
                    className={`relative flex items-center transition-all duration-300 group rounded-lg ${
                      isCollapsed ? 'justify-center p-3' : 'px-4 py-5'
                    }`}
                  >
                    {/* Sliding Background Pill */}
                    {active && (
                      <motion.div
                        layoutId="active-pill"
                        className="absolute inset-0 bg-white/40 rounded-lg shadow-sm"
                        initial={false}
                        transition={{
                          type: "spring",
                          stiffness: 300,
                          damping: 30
                        }}
                      />
                    )}

                    {/* Sliding Left Active Line */}
                    {active && (
                      <motion.div
                        layoutId="active-line"
                        className="absolute left-0 w-1 h-6 bg-[#2d7a4d] rounded-r-full shadow-[0_0_5px_rgba(45,122,77,0.3)]"
                        initial={false}
                        transition={{
                          type: "spring",
                          stiffness: 300,
                          damping: 30
                        }}
                      />
                    )}

                    <div className={isCollapsed ? "" : "w-12 flex justify-center shrink-0 mr-4"}>
                      <Icon className={`relative z-10 shrink-0 transition-transform duration-300 group-hover:scale-110 ${
                        isCollapsed ? 'w-7 h-7' : 'w-6 h-6'
                      } ${active ? 'text-[#2d7a4d]' : 'text-[#2d7a4d]/60 group-hover:text-[#2d7a4d]'}`} />
                    </div>
                    
                    <AnimatePresence mode="wait">
                      {!isCollapsed && (
                        <motion.span 
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -10 }}
                          transition={{ duration: 0.2 }}
                          className={`relative z-10 whitespace-nowrap text-base font-medium ${active ? 'text-[#2d7a4d]' : 'text-[#2d7a4d]/70 group-hover:text-[#2d7a4d]'}`}
                        >
                          {item.label}
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </Link>
                );
              })}
            </nav>
          </div>
        ))}
      </div>

      <div className="p-4 border-t border-border/60 bg-muted/20">
        <AnimatePresence>
          {!isCollapsed && user && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="flex items-center gap-3 mb-4 px-2 py-3 rounded-xl bg-card border border-border/40 shadow-sm overflow-hidden"
            >
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20 shrink-0">
                 <UserIcon className="w-5 h-5 text-primary" />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-bold text-foreground truncate">{user.name}</span>
                <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{user.role}</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <Button
          onClick={onLogout}
          variant="ghost"
          size={isCollapsed ? "icon" : "sm"}
          className={`transition-all duration-300 text-sm font-semibold group ${
            isCollapsed 
              ? "h-11 w-11 hover:bg-red-500/20 hover:text-red-400" 
              : "w-full justify-start hover:bg-red-500/20 hover:text-red-400 px-4 h-11"
          } text-red-400/70`}
        >
          <LogOut className={`shrink-0 transition-colors group-hover:text-red-400 ${isCollapsed ? 'w-6 h-6' : 'w-4 h-4 mr-2'}`} />
          <AnimatePresence>
            {!isCollapsed && (
              <motion.span
                initial={{ opacity: 0, x: -5 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -5 }}
              >
                Cerrar Sesión
              </motion.span>
            )}
          </AnimatePresence>
        </Button>
      </div>
    </motion.aside>
  );
}
