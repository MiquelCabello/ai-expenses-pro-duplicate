// ...existing code...
import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import AppLayout from '@/components/AppLayout';
import { 
  Euro, 
  Clock, 
  TrendingUp, 
  Upload, 
  Users, 
  BarChart3,
  PieChart,
  FileText,
  CheckCircle,
  AlertTriangle
} from 'lucide-react';
import { toast } from 'sonner';

interface DashboardStats {
  totalExpenses: number;
  pendingExpenses: number;
  pendingCount: number;
  topCategory: string;
  dailyAverage: number;
  recentExpenses: any[];
}

const DEFAULT_DASHBOARD_STATS: DashboardStats = {
  totalExpenses: 0,
  pendingExpenses: 0,
  pendingCount: 0,
  topCategory: '-',
  dailyAverage: 0,
  recentExpenses: [],
};

export default function Dashboard() {
  const { profile, account, isMaster } = useAuth();
  const planNameMap: Record<'FREE' | 'PROFESSIONAL' | 'ENTERPRISE', string> = {
    FREE: 'Starter',
    PROFESSIONAL: 'Professional',
    ENTERPRISE: 'Enterprise',
  };
  const planConfig: Record<'FREE' | 'PROFESSIONAL' | 'ENTERPRISE', { monthlyLimit: number | null }> = {
    FREE: { monthlyLimit: 50 },
    PROFESSIONAL: { monthlyLimit: null },
    ENTERPRISE: { monthlyLimit: null },
  };
  const planKey = (account?.plan ?? 'FREE') as 'FREE' | 'PROFESSIONAL' | 'ENTERPRISE';
  const resolvedAccountId = !isMaster ? (profile?.account_id ?? account?.id ?? undefined) : undefined;
  const [stats, setStats] = useState<DashboardStats>(DEFAULT_DASHBOARD_STATS);
  const [loading, setLoading] = useState(true);

  const planName = isMaster ? 'Master' : planNameMap[planKey];
  const monthlyLimit = isMaster ? null : account?.monthly_expense_limit ?? planConfig[planKey].monthlyLimit;

  const fetchDashboardStats = useCallback(async () => {
    if (!profile && !isMaster) {
      setStats(DEFAULT_DASHBOARD_STATS);
      setLoading(false);
      return;
    }

    if (!isMaster) {
      if (!profile) {
        setStats(DEFAULT_DASHBOARD_STATS);
        setLoading(false);
        return;
      }
      if (!resolvedAccountId) {
        console.warn('[Dashboard] Missing account_id for non-master user', profile?.id);
        setStats(DEFAULT_DASHBOARD_STATS);
        setLoading(false);
        return;
      }
    }

    try {
      setLoading(true);

      let expenseQuery = supabase
        .from('expenses')
        .select(`
          *,
          categories(name)
        `);

      if (!isMaster && resolvedAccountId) {
        expenseQuery = expenseQuery.eq('account_id', resolvedAccountId);
      }

      if (!isMaster && profile?.role === 'EMPLOYEE') {
        expenseQuery = expenseQuery.eq('employee_id', profile.user_id);
      }

      const { data: expenses, error } = await expenseQuery;
      if (error) {
        throw error;
      }

      const resolvedExpenses = expenses ?? [];

      const employeeIds = Array.from(new Set(resolvedExpenses.map((e: any) => e.employee_id).filter(Boolean)));
      let profilesMap: Record<string, any> = {};

      if (employeeIds.length > 0) {
        try {
          let profileQuery = supabase
            .from('profiles')
            .select('user_id, name')
            .in('user_id', employeeIds);

          if (!isMaster && resolvedAccountId) {
            profileQuery = profileQuery.eq('account_id', resolvedAccountId);
          }

          const { data: employeeProfiles, error: profilesError } = await profileQuery;

          if (!profilesError && employeeProfiles?.length) {
            profilesMap = Object.fromEntries(employeeProfiles.map((p: any) => [p.user_id, p]));
          }
        } catch (profilesErr) {
          console.warn('[Dashboard] Unable to load employee names', profilesErr);
        }
      }

      const expensesWithProfiles = resolvedExpenses.map((exp: any) => ({
        ...exp,
        profiles: profilesMap[exp.employee_id] || null,
      }));

      const total = expensesWithProfiles.reduce((sum: number, exp: any) => {
        const amount = typeof exp.amount_gross === 'string' ? parseFloat(exp.amount_gross) : exp.amount_gross;
        return sum + (Number.isNaN(amount) ? 0 : amount);
      }, 0);

      const pending = expensesWithProfiles
        .filter((exp: any) => exp.status === 'PENDING')
        .reduce((sum: number, exp: any) => {
          const amount = typeof exp.amount_gross === 'string' ? parseFloat(exp.amount_gross) : exp.amount_gross;
          return sum + (Number.isNaN(amount) ? 0 : amount);
        }, 0);

      const pendingCount = expensesWithProfiles.filter((exp: any) => exp.status === 'PENDING').length;

      const categoryTotals = expensesWithProfiles.reduce((acc: Record<string, number>, exp: any) => {
        const category = exp.categories?.name || 'Otros';
        const amount = typeof exp.amount_gross === 'string' ? parseFloat(exp.amount_gross) : exp.amount_gross;
        const validAmount = Number.isNaN(amount) ? 0 : amount;
        acc[category] = (acc[category] || 0) + validAmount;
        return acc;
      }, {} as Record<string, number>);

      const topCategory = Object.keys(categoryTotals).length > 0
        ? Object.entries(categoryTotals).sort(([, a], [, b]) => (b as number) - (a as number))[0][0]
        : '-';

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const recentExpenses = expensesWithProfiles.filter((exp: any) => new Date(exp.expense_date) >= thirtyDaysAgo);
      const dailyAverage = recentExpenses.length > 0
        ? recentExpenses.reduce((sum: number, exp: any) => {
            const amount = typeof exp.amount_gross === 'string' ? parseFloat(exp.amount_gross) : exp.amount_gross;
            return sum + (Number.isNaN(amount) ? 0 : amount);
          }, 0) / 30
        : 0;

      const recent = expensesWithProfiles
        .slice()
        .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 5);

      setStats({
        totalExpenses: total,
        pendingExpenses: pending,
        pendingCount,
        topCategory,
        dailyAverage,
        recentExpenses: recent,
      });
    } catch (error) {
      console.error('[Dashboard] Stats error', error);
      toast.error('Error cargando estadísticas');
      setStats(DEFAULT_DASHBOARD_STATS);
    } finally {
      setLoading(false);
    }
  }, [resolvedAccountId, profile, isMaster]);

  useEffect(() => {
    if (!profile && !isMaster) {
      setStats(DEFAULT_DASHBOARD_STATS);
      setLoading(false);
      return;
    }
    void fetchDashboardStats();
  }, [fetchDashboardStats, profile, isMaster]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount);
  };

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

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Cargando dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        {/* Welcome Section */}
        <div className="mb-8">
          <h2 className="text-3xl font-bold mb-2">Dashboard Financiero</h2>
          <p className="text-muted-foreground">
            Resumen de gastos y actividad reciente
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <span className="font-medium">Plan {planName}</span>
            {typeof monthlyLimit === 'number' ? (
              <span>Límite mensual: {monthlyLimit} gastos</span>
            ) : (
              <span>Gastos ilimitados</span>
            )}
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="bg-gradient-card border-0 shadow-md">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Gastos</CardTitle>
              <Euro className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">
                {formatCurrency(stats.totalExpenses)}
              </div>
              <p className="text-xs text-muted-foreground">
                Año actual
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-card border-0 shadow-md">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pendientes</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-warning">
                {formatCurrency(stats.pendingExpenses)}
              </div>
              <p className="text-xs text-muted-foreground">
                {stats.pendingCount} gastos por aprobar
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-card border-0 shadow-md">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Top Categoría</CardTitle>
              <PieChart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-success">
                {stats.topCategory}
              </div>
              <p className="text-xs text-muted-foreground">
                Mayor gasto del periodo
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-card border-0 shadow-md">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Promedio Diario</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-accent">
                {formatCurrency(stats.dailyAverage)}
              </div>
              <p className="text-xs text-muted-foreground">
                Últimos 30 días
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Recent Expenses */}
        <Card className="mb-8 bg-gradient-card border-0 shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Gastos Recientes
            </CardTitle>
            <CardDescription>
              Los últimos gastos registrados en el sistema
            </CardDescription>
          </CardHeader>
          <CardContent>
            {stats.recentExpenses.length > 0 ? (
              <div className="space-y-4">
                {stats.recentExpenses.map((expense) => (
                  <div
                    key={expense.id}
                    className="flex items-center justify-between p-4 bg-background/50 rounded-lg border"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h4 className="font-medium">{expense.vendor}</h4>
                        {getStatusBadge(expense.status)}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span>{expense.categories?.name}</span>
                        <span>•</span>
                        <span>{new Date(expense.expense_date).toLocaleDateString('es-ES')}</span>
                        {profile?.role === 'ADMIN' && (
                          <>
                            <span>•</span>
                            <span>{expense.profiles?.name}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold">{formatCurrency(
                        typeof expense.amount_gross === 'string' 
                          ? parseFloat(expense.amount_gross) || 0 
                          : expense.amount_gross || 0
                      )}</div>
                      <div className="text-xs text-muted-foreground uppercase">{expense.currency}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No hay gastos registrados aún</p>
                <Button className="mt-4 bg-gradient-primary hover:opacity-90" onClick={() => window.location.href = '/upload'}>
                  <Upload className="mr-2 h-4 w-4" />
                  Subir Primer Recibo
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card className="bg-gradient-card border-0 shadow-md">
          <CardHeader>
            <CardTitle>Acciones Rápidas</CardTitle>
            <CardDescription>
              Funciones principales para gestionar gastos
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Button className="h-auto p-6 flex flex-col items-center gap-3 bg-gradient-primary hover:opacity-90" onClick={() => window.location.href = '/upload'}>
                <Upload className="h-8 w-8" />
                <div className="text-center">
                  <div className="font-medium">Subir Recibo</div>
                  <div className="text-xs opacity-90">Captura con IA</div>
                </div>
              </Button>
              
              <Button variant="outline" className="h-auto p-6 flex flex-col items-center gap-3">
                <FileText className="h-8 w-8" />
                <div className="text-center">
                  <div className="font-medium">Ver Gastos</div>
                  <div className="text-xs text-muted-foreground">Lista completa</div>
                </div>
              </Button>
              
              <Button variant="outline" className="h-auto p-6 flex flex-col items-center gap-3">
                <BarChart3 className="h-8 w-8" />
                <div className="text-center">
                  <div className="font-medium">Analytics</div>
                  <div className="text-xs text-muted-foreground">Reportes detallados</div>
                </div>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
