import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import AppLayout from '@/components/AppLayout';
import { 
  Users, 
  UserPlus, 
  Search, 
  Mail,
  MapPin,
  Briefcase,
  MoreHorizontal,
  Edit,
  Trash2,
  UserCheck,
  UserX
} from 'lucide-react';
import { toast } from 'sonner';

interface Employee {
  id: string;
  user_id: string;
  name: string;
  role: 'ADMIN' | 'EMPLOYEE';
  department?: string | null;
  region?: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  created_at: string;
  account_id: string;
}

export default function EmployeesPage() {
  const { profile, account } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [newEmployee, setNewEmployee] = useState({
    name: '',
    email: '',
    role: 'EMPLOYEE' as 'ADMIN' | 'EMPLOYEE',
    department: '',
    region: '',
    status: 'ACTIVE' as 'ACTIVE' | 'INACTIVE'
  });
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  const accountId = profile?.account_id ?? null;
  const maxEmployees = account?.max_employees ?? null;
  const canAssignRoles = account?.can_assign_roles ?? false;
  const canAssignDepartment = account?.can_assign_department ?? false;
  const canAssignRegion = account?.can_assign_region ?? false;
  const planLabel = account?.plan ?? 'FREE';
  const planNameMap: Record<string, string> = { FREE: 'Starter', PROFESSIONAL: 'Professional', ENTERPRISE: 'Enterprise' };
  const planName = planNameMap[planLabel] ?? planLabel;
  const activeEmployeesCount = employees.filter(employee => employee.status === 'ACTIVE').length;
  const isAtEmployeeLimit = typeof maxEmployees === 'number' && activeEmployeesCount >= maxEmployees;

  useEffect(() => {
    setNewEmployee(prev => ({
      ...prev,
      role: canAssignRoles ? prev.role : 'EMPLOYEE',
      department: canAssignDepartment ? prev.department : '',
      region: canAssignRegion ? prev.region : ''
    }));
  }, [canAssignRoles, canAssignDepartment, canAssignRegion]);

  const fetchEmployees = useCallback(async () => {
    try {
      setLoading(true);

      let query = supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (accountId) {
        query = query.eq('account_id', accountId);
      }

      const { data, error } = await query;
      let resolvedEmployees = data ?? [];

      if (error) {
        if (accountId && typeof error.message === 'string' && error.message.includes('account_id')) {
          const { data: fallbackData, error: fallbackError } = await supabase
            .from('profiles')
            .select('*')
            .order('created_at', { ascending: false });
          if (fallbackError) throw fallbackError;
          resolvedEmployees = fallbackData ?? [];
        } else {
          throw error;
        }
      }

      setEmployees(resolvedEmployees);
    } catch (error) {
      console.error('[Employees] fetch failed', error);
      toast.error('Error cargando empleados');
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  useEffect(() => {
    if (profile?.role === 'ADMIN') {
      fetchEmployees();
    }
  }, [profile, accountId, fetchEmployees]);


  const handleCreateEmployee = async () => {
    if (!accountId || profile?.role !== 'ADMIN') {
      toast.error('No tienes permisos para crear empleados');
      return;
    }

    if (!newEmployee.name.trim()) {
      toast.error('El nombre del empleado es obligatorio');
      return;
    }

    const email = newEmployee.email.trim();
    const emailRegex = /[^\s@]+@[^\s@]+\.[^\s@]+/;
    if (!emailRegex.test(email)) {
      toast.error('Introduce un correo electrónico válido');
      return;
    }

    if (isAtEmployeeLimit) {
      toast.error('Has alcanzado el número máximo de usuarios para tu plan');
      return;
    }

    try {
      const sanitizedRole = canAssignRoles ? newEmployee.role : 'EMPLOYEE';
      const sanitizedDepartment = canAssignDepartment ? newEmployee.department.trim() : '';
      const sanitizedRegion = canAssignRegion ? newEmployee.region.trim() : '';

      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) {
        throw new Error('SESSION_NOT_FOUND');
      }

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-employee`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          name: newEmployee.name.trim(),
          email,
          role: sanitizedRole,
          department: canAssignDepartment ? sanitizedDepartment || null : null,
          region: canAssignRegion ? sanitizedRegion || null : null
        })
      });

      if (!response.ok) {
        let message = 'Error creando empleado';
        try {
          const payload = await response.json();
          message = payload?.message || payload?.error || message;
        } catch {}
        throw new Error(message);
      }

      toast.success('Invitación enviada al nuevo empleado');
      setIsCreateDialogOpen(false);
      setNewEmployee({
        name: '',
        email: '',
        role: 'EMPLOYEE',
        department: '',
        region: '',
        status: 'ACTIVE'
      });
      fetchEmployees();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error creando empleado';
      toast.error(message === 'EMPLOYEE_LIMIT_REACHED' ? 'Has alcanzado el número máximo de usuarios para tu plan' : message);
    }
  };

  const handleUpdateEmployeeStatus = async (employeeId: string, newStatus: 'ACTIVE' | 'INACTIVE') => {
    if (!accountId) return;
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ status: newStatus })
        .eq('id', employeeId)
        .eq('account_id', accountId);
      
      if (error) throw error;
      
      toast.success(`Estado del empleado actualizado a ${newStatus === 'ACTIVE' ? 'Activo' : 'Inactivo'}`);
      fetchEmployees();
    } catch (error) {
      toast.error('Error actualizando estado del empleado');
    }
  };

  const getRoleBadge = (role: string) => {
    return role === 'ADMIN' ? (
      <Badge variant="default" className="gap-1">
        <UserCheck className="h-3 w-3" />
        Administrador
      </Badge>
    ) : (
      <Badge variant="secondary" className="gap-1">
        <Users className="h-3 w-3" />
        Empleado
      </Badge>
    );
  };

  const getStatusBadge = (status: string) => {
    return status === 'ACTIVE' ? (
      <Badge variant="default" className="gap-1 bg-success">
        <UserCheck className="h-3 w-3" />
        Activo
      </Badge>
    ) : (
      <Badge variant="destructive" className="gap-1">
        <UserX className="h-3 w-3" />
        Inactivo
      </Badge>
    );
  };

  const filteredEmployees = employees.filter(employee =>
    employee.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    employee.department?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    employee.region?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Check if current user is admin
  if (profile?.role !== 'ADMIN') {
    return (
      <AppLayout>
        <div className="p-6 flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <Users className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="text-lg font-medium mb-2">Acceso Restringido</h3>
            <p className="text-muted-foreground">
              Solo los administradores pueden acceder a la gestión de empleados.
            </p>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (loading) {
    return (
      <AppLayout>
        <div className="p-6 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Cargando empleados...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold mb-2">Gestión de Empleados</h2>
            <p className="text-muted-foreground">
              Administra usuarios y permisos del sistema
            </p>
            {profile?.role === 'ADMIN' && (
              <p className={`text-sm mt-1 ${isAtEmployeeLimit ? 'text-destructive' : 'text-muted-foreground'}`}>
                Plan {planName} · {maxEmployees ? `${activeEmployeesCount}/${maxEmployees} usuarios activos` : `${activeEmployeesCount} usuarios activos`}
              </p>
            )}
          </div>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button
                className="bg-gradient-primary hover:opacity-90 gap-2"
                disabled={isAtEmployeeLimit}
                title={isAtEmployeeLimit ? 'Has alcanzado el límite de usuarios de tu plan' : undefined}
              >
                <UserPlus className="h-4 w-4" />
                Nuevo Empleado
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Crear Nuevo Empleado</DialogTitle>
                <DialogDescription>
                  Agrega un nuevo empleado al sistema
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                {!canAssignRoles || !canAssignDepartment || !canAssignRegion ? (
                  <p className="text-xs text-muted-foreground">
                    Los empleados creados en el plan {planName} recibirán acceso estándar. Podrás ampliar estas opciones al mejorar de plan.
                  </p>
                ) : null}
                <div className="space-y-2">
                  <Label htmlFor="name">Nombre Completo</Label>
                  <Input
                    id="name"
                    value={newEmployee.name}
                    onChange={(e) => setNewEmployee({ ...newEmployee, name: e.target.value })}
                    placeholder="Nombre del empleado"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Correo Electrónico</Label>
                  <Input
                    id="email"
                    type="email"
                    value={newEmployee.email}
                    onChange={(e) => setNewEmployee({ ...newEmployee, email: e.target.value })}
                    placeholder="correo@empresa.com"
                  />
                </div>
                {canAssignRoles && (
                  <div className="space-y-2">
                    <Label htmlFor="role">Rol</Label>
                    <Select value={newEmployee.role} onValueChange={(value: 'ADMIN' | 'EMPLOYEE') => setNewEmployee({ ...newEmployee, role: value })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="EMPLOYEE">Empleado</SelectItem>
                        <SelectItem value="ADMIN">Administrador</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {(canAssignDepartment || canAssignRegion) && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {canAssignDepartment && (
                      <div className="space-y-2">
                        <Label htmlFor="department">Departamento</Label>
                        <Input
                          id="department"
                          value={newEmployee.department}
                          onChange={(e) => setNewEmployee({ ...newEmployee, department: e.target.value })}
                          placeholder="IT, RRHH, etc."
                        />
                      </div>
                    )}
                    {canAssignRegion && (
                      <div className="space-y-2">
                        <Label htmlFor="region">Región</Label>
                        <Input
                          id="region"
                          value={newEmployee.region}
                          onChange={(e) => setNewEmployee({ ...newEmployee, region: e.target.value })}
                          placeholder="Madrid, Barcelona, etc."
                        />
                      </div>
                    )}
                  </div>
                )}
                <div className="flex justify-end gap-2 pt-4">
                  <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={handleCreateEmployee} className="bg-gradient-primary hover:opacity-90">
                    Crear Empleado
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
        {isAtEmployeeLimit && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
            Has alcanzado el máximo de usuarios incluidos en tu plan {planName}. Actualiza de plan para invitar a más empleados.
          </div>
        )}

        {/* Search */}
        <Card className="bg-gradient-card border-0 shadow-md">
          <CardContent className="p-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar empleados por nombre, departamento o región..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardContent>
        </Card>

        {/* Employees List */}
        <Card className="bg-gradient-card border-0 shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Empleados ({filteredEmployees.length})
            </CardTitle>
            <CardDescription>
              Lista completa de usuarios registrados en el sistema
            </CardDescription>
          </CardHeader>
          <CardContent>
            {filteredEmployees.length > 0 ? (
              <div className="space-y-4">
                {filteredEmployees.map((employee) => (
                  <div
                    key={employee.id}
                    className="flex items-center justify-between p-4 bg-background/50 rounded-lg border hover:bg-background/70 transition-colors"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h4 className="font-semibold">{employee.name}</h4>
                        {getRoleBadge(employee.role)}
                        {getStatusBadge(employee.status)}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        {employee.department && (
                          <div className="flex items-center gap-1">
                            <Briefcase className="h-3 w-3" />
                            <span>{employee.department}</span>
                          </div>
                        )}
                        {employee.region && (
                          <div className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            <span>{employee.region}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-1">
                          <span>📅</span>
                          <span>Registrado: {new Date(employee.created_at).toLocaleDateString('es-ES')}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleUpdateEmployeeStatus(
                          employee.id, 
                          employee.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'
                        )}
                      >
                        {employee.status === 'ACTIVE' ? (
                          <>
                            <UserX className="h-3 w-3 mr-1" />
                            Desactivar
                          </>
                        ) : (
                          <>
                            <UserCheck className="h-3 w-3 mr-1" />
                            Activar
                          </>
                        )}
                      </Button>
                      <Button variant="outline" size="sm">
                        <Edit className="h-3 w-3 mr-1" />
                        Editar
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <Users className="h-16 w-16 mx-auto mb-4 opacity-50" />
                <h3 className="text-lg font-medium mb-2">
                  {searchTerm ? 'No se encontraron empleados' : 'No hay empleados registrados'}
                </h3>
                <p className="mb-4">
                  {searchTerm 
                    ? 'Intenta con otros términos de búsqueda'
                    : 'Agrega el primer empleado al sistema'
                  }
                </p>
                {!searchTerm && (
                  <Button 
                    className="bg-gradient-primary hover:opacity-90"
                    onClick={() => setIsCreateDialogOpen(true)}
                  >
                    <UserPlus className="mr-2 h-4 w-4" />
                    Agregar Primer Empleado
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
