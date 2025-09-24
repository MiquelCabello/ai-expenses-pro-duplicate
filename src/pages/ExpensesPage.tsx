import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import AppLayout from '@/components/AppLayout';
import { 
  FileText, 
  Search, 
  Filter, 
  Download,
  Clock,
  CheckCircle,
  AlertTriangle,
  Euro,
  Calendar
} from 'lucide-react';
import { toast } from 'sonner';

interface Expense {
  id: string;
  vendor: string;
  amount_gross: number;
  amount_net: number;
  tax_vat: number;
  expense_date: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  payment_method: string;
  currency: string;
  notes?: string;
  categories: { name: string } | null;
  profiles?: { name: string } | null;
  created_at: string;
}

export default function ExpensesPage() {
  const { profile, account, isMaster } = useAuth();
  const planMonthlyLimitMap: Record<'FREE' | 'PROFESSIONAL' | 'ENTERPRISE', number | null> = {
    FREE: 50,
    PROFESSIONAL: null,
    ENTERPRISE: null,
  };
  const planKey = (account?.plan ?? 'FREE') as 'FREE' | 'PROFESSIONAL' | 'ENTERPRISE';
  const resolvedAccountId = !isMaster ? (profile?.account_id ?? account?.id ?? undefined) : undefined;
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const fetchExpenses = useCallback(async () => {
    if (!profile && !isMaster) {
      setLoading(false);
      return;
    }

    if (!isMaster) {
      if (!profile) {
        setLoading(false);
        return;
      }
      if (!resolvedAccountId) {
        console.warn('[Expenses] Missing account_id for non-master user', profile?.id);
        setExpenses([]);
        setLoading(false);
        return;
      }
    }

    try {
      setLoading(true);
      
      let query = supabase
        .from('expenses')
        .select(`
          *,
          categories(name)
        `)
        .order('created_at', { ascending: false });

      if (!isMaster && resolvedAccountId) {
        query = query.eq('account_id', resolvedAccountId);
      }

      // If employee, only show their expenses
      if (!isMaster && profile?.role === 'EMPLOYEE') {
        query = query.eq('employee_id', profile.user_id);
      }

      const { data: expensesData, error } = await query;
      if (error) {
        throw error;
      }

      const resolvedExpenses = expensesData ?? [];

      // Fetch profiles for employee names (if admin)
      let expensesWithProfiles = resolvedExpenses.map(exp => ({ ...exp, profiles: null }));
      if ((isMaster || profile?.role === 'ADMIN') && resolvedExpenses.length > 0) {
        const employeeIds = Array.from(new Set(resolvedExpenses.map(e => e.employee_id).filter(Boolean)));
        if (employeeIds.length > 0) {
          try {
            let profileQuery = supabase
              .from('profiles')
              .select('user_id, name')
              .in('user_id', employeeIds);

            if (!isMaster && resolvedAccountId) {
              profileQuery = profileQuery.eq('account_id', resolvedAccountId);
            }

            const { data: profiles, error: profilesError } = await profileQuery;

            if (!profilesError && profiles) {
              const profilesMap = Object.fromEntries(profiles.map(p => [p.user_id, p]));
              expensesWithProfiles = resolvedExpenses.map(exp => ({
                ...exp,
                profiles: profilesMap[exp.employee_id] || null
              }));
            }
          } catch (profilesError) {
            console.warn('[Expenses] Unable to fetch employee names', profilesError);
          }
        }
      }

      setExpenses(expensesWithProfiles);
    } catch (error) {
      toast.error('Error cargando gastos');
    } finally {
      setLoading(false);
    }
  }, [profile, resolvedAccountId, isMaster]);

  useEffect(() => {
    if (!profile && !isMaster) return;
    fetchExpenses();
  }, [profile, fetchExpenses, isMaster]);

  const getStatusBadge = (status: string) => {
    const statusMap = {
      PENDING: { label: 'Pendiente', variant: 'secondary' as const, icon: Clock },
      APPROVED: { label: 'Aprobado', variant: 'default' as const, icon: CheckCircle },
      REJECTED: { label: 'Rechazado', variant: 'destructive' as const, icon: AlertTriangle }
    };
    
    const statusInfo = statusMap[status as keyof typeof statusMap] || statusMap.PENDING;
    const Icon = statusInfo.icon;
    
    return (
      <Badge variant={statusInfo.variant} className="gap-1">
        <Icon className="h-3 w-3" />
        {statusInfo.label}
      </Badge>
    );
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount);
  };

  const filteredExpenses = expenses.filter(expense => {
    const matchesSearch = expense.vendor.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         expense.categories?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         expense.profiles?.name.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || expense.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const monthlyLimit = isMaster ? null : account?.monthly_expense_limit ?? planMonthlyLimitMap[planKey];
  const currentMonthUsage = expenses.filter(expense => {
    const date = new Date(expense.expense_date);
    const now = new Date();
    return date.getUTCFullYear() === now.getUTCFullYear() && date.getUTCMonth() === now.getUTCMonth();
  }).length;
  const remainingExpenses = typeof monthlyLimit === 'number' ? Math.max(monthlyLimit - currentMonthUsage, 0) : null;

  if (loading) {
    return (
      <AppLayout>
        <div className="p-6 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Cargando gastos...</p>
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
            <h2 className="text-3xl font-bold mb-2">Gestión de Gastos</h2>
            <p className="text-muted-foreground">
              Administra y revisa todos los gastos registrados
            </p>
            {typeof monthlyLimit === 'number' && (
              <p className={`text-sm mt-1 ${remainingExpenses === 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
                Límite mensual: {currentMonthUsage}/{monthlyLimit} gastos registrados este mes
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="gap-2">
              <Download className="h-4 w-4" />
              Exportar
            </Button>
            <Button className="bg-gradient-primary hover:opacity-90 gap-2" onClick={() => window.location.href = '/upload'}>
              <FileText className="h-4 w-4" />
              Nuevo Gasto
            </Button>
          </div>
        </div>

        {/* Filters */}
        <Card className="bg-gradient-card border-0 shadow-md">
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por proveedor, categoría o empleado..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-40">
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los estados</SelectItem>
                    <SelectItem value="PENDING">Pendientes</SelectItem>
                    <SelectItem value="APPROVED">Aprobados</SelectItem>
                    <SelectItem value="REJECTED">Rechazados</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Expenses List */}
        <Card className="bg-gradient-card border-0 shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Gastos ({filteredExpenses.length})
            </CardTitle>
            <CardDescription>
              Lista completa de gastos registrados en el sistema
            </CardDescription>
          </CardHeader>
          <CardContent>
            {filteredExpenses.length > 0 ? (
              <div className="space-y-4">
                {filteredExpenses.map((expense) => (
                  <div
                    key={expense.id}
                    className="flex items-center justify-between p-4 bg-background/50 rounded-lg border hover:bg-background/70 transition-colors"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h4 className="font-semibold">{expense.vendor}</h4>
                        {getStatusBadge(expense.status)}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <FileText className="h-3 w-3" />
                          <span>{expense.categories?.name || 'Sin categoría'}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          <span>{new Date(expense.expense_date).toLocaleDateString('es-ES')}</span>
                        </div>
                        {profile?.role === 'ADMIN' && expense.profiles && (
                          <div className="flex items-center gap-1">
                            <span>👤</span>
                            <span>{expense.profiles.name}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-1">
                          <span>💳</span>
                          <span>{expense.payment_method}</span>
                        </div>
                      </div>
                      {expense.notes && (
                        <p className="text-sm text-muted-foreground mt-2 italic">"{expense.notes}"</p>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-lg flex items-center gap-1">
                        <Euro className="h-4 w-4" />
                        {formatCurrency(expense.amount_gross)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Neto: {formatCurrency(expense.amount_net)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        IVA: {formatCurrency(expense.tax_vat || 0)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <FileText className="h-16 w-16 mx-auto mb-4 opacity-50" />
                <h3 className="text-lg font-medium mb-2">No hay gastos</h3>
                <p className="mb-4">
                  {searchTerm || statusFilter !== 'all' 
                    ? 'No se encontraron gastos con los filtros aplicados'
                    : 'No hay gastos registrados aún'
                  }
                </p>
                <Button className="bg-gradient-primary hover:opacity-90" onClick={() => window.location.href = '/upload'}>
                  <FileText className="mr-2 h-4 w-4" />
                  Registrar Primer Gasto
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
