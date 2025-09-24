import { useMemo, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  BarChart3,
  FileText,
  Upload,
  PieChart,
  Users,
  Settings,
  Search,
  Plus,
  Bell,
  Building2
} from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';

export default function Sidebar() {
  const { profile, account, isMaster, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');

  const planLabel = useMemo(() => {
    if (isMaster) return 'Master';
    if (!account?.plan) return 'Sin plan';
    const map: Record<'FREE' | 'PROFESSIONAL' | 'ENTERPRISE', string> = {
      FREE: 'Starter',
      PROFESSIONAL: 'Professional',
      ENTERPRISE: 'Enterprise',
    };
    return map[account.plan];
  }, [account?.plan, isMaster]);

  const isAdmin = profile?.role === 'ADMIN' || isMaster;
  const companyName = account?.name || 'Mi Empresa';

  const navigation = [
    {
      name: 'Dashboard',
      href: '/dashboard',
      icon: BarChart3,
      current: location.pathname === '/dashboard'
    },
    {
      name: 'Gastos',
      href: '/gastos',
      icon: FileText,
      current: location.pathname === '/gastos'
    },
    {
      name: 'Subir Ticket',
      href: '/upload',
      icon: Upload,
      current: location.pathname === '/upload'
    },
    {
      name: 'Análisis',
      href: '/analisis',
      icon: PieChart,
      current: location.pathname === '/analisis'
    },
    ...(isAdmin
      ? [{
        name: 'Empleados',
        href: '/empleados',
        icon: Users,
        current: location.pathname === '/empleados'
      }]
      : [{
        name: companyName,
        href: '/empresa',
        icon: Building2,
        current: location.pathname === '/empresa'
      }]),
    ...(isAdmin
      ? [{
        name: 'Configuración',
        href: '/configuracion',
        icon: Settings,
        current: location.pathname === '/configuracion'
      }]
      : [])
  ];

  return (
    <>
      {/* Header */}
      <div className="p-6 border-b border-border">
        <div className="flex items-center space-x-3">
          <div className="bg-gradient-primary rounded-lg p-2">
            <BarChart3 className="h-6 w-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-lg font-bold">ExpenseFlow</h1>
            <p className="text-xs text-muted-foreground">Gestión de Gastos</p>
            <Badge variant="secondary" className="mt-1">
              Plan {planLabel}
            </Badge>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="p-4 border-b border-border">
        <div className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar gastos, comercios..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button className="w-full mt-3 bg-gradient-primary hover:opacity-90" onClick={() => navigate('/upload')}>
          <Plus className="h-4 w-4 mr-2" />
          Nuevo Gasto
        </Button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-2">
        {navigation.map((item) => {
          const Icon = item.icon;
          return (
            <Button
              key={item.name}
              variant={item.current ? "default" : "ghost"}
              className={`w-full justify-start ${
                item.current 
                  ? "bg-primary text-primary-foreground" 
                  : "hover:bg-accent hover:text-accent-foreground"
              }`}
              onClick={() => navigate(item.href)}
            >
              <Icon className="h-4 w-4 mr-3" />
              {item.name}
              {item.name === 'Gastos' && (
                <Badge variant="secondary" className="ml-auto">
                  3
                </Badge>
              )}
            </Button>
          );
        })}
      </nav>

      {/* User Profile */}
      <div className="p-4 border-t border-border">
        <div className="flex items-center space-x-3 mb-3">
          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
            <span className="text-sm font-medium text-primary-foreground">
              {profile?.name?.charAt(0)?.toUpperCase() || 'U'}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{profile?.name || 'Usuario'}</p>
            <p className="text-xs text-muted-foreground">
              {profile?.role === 'ADMIN' ? 'Director Financiero' : 'Empleado'}
            </p>
          </div>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          className="w-full"
          onClick={signOut}
        >
          Cerrar Sesión
        </Button>
      </div>
    </>
  );
}
