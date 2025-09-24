// Ruta: src/pages/AnalyticsPage.tsx
// Descripción: Vista de analíticas de gastos con filtro de estado y fechas locales.
// Anotaciones: este archivo incluye comentarios breves (NOTE / RATIONALE / TODO) para entender decisiones.
import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/integrations/supabase/client'
import AppLayout from '@/components/AppLayout'
import { toLocalISODate, aggregateAnalytics } from '@/lib/analytics'
import { BarChart3, PieChart, TrendingUp, TrendingDown, Euro, Calendar, Download, Filter } from 'lucide-react'
import { toast } from 'sonner'

interface AnalyticsData {
  totalExpenses: number
  expenseCount: number
  averageExpense: number
  categoryBreakdown: { name: string; amount: number; count: number }[]
  monthlyTrend: { month: string; amount: number }[]
  statusBreakdown: { status: string; count: number; amount: number }[]
}

export default function AnalyticsPage() {
  const { profile } = useAuth()
  const accountId = profile?.account_id ?? null
  const [analytics, setAnalytics] = useState<AnalyticsData>({
    totalExpenses: 0,
    expenseCount: 0,
    averageExpense: 0,
    categoryBreakdown: [],
    monthlyTrend: [],
    statusBreakdown: [],
  })
  const [loading, setLoading] = useState(true)
  const [timeRange, setTimeRange] = useState('last_6_months')
  const [statusFilter, setStatusFilter] = useState<'APPROVED' | 'PENDING' | 'REJECTED' | 'ALL'>('APPROVED')

  useEffect(() => {
    if (!profile || !accountId) return
    fetchAnalytics()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, accountId, timeRange, statusFilter])

  const fetchAnalytics = async () => {
    if (!profile || !accountId) return

    try {
      setLoading(true)

      // RATIONALE: calcular rango en local para evitar off-by-one por zona horaria
      const endDate = new Date()
      const startDate = new Date()

      switch (timeRange) {
        case 'last_month':
          startDate.setMonth(startDate.getMonth() - 1)
          break
        case 'last_3_months':
          startDate.setMonth(startDate.getMonth() - 3)
          break
        case 'last_6_months':
          startDate.setMonth(startDate.getMonth() - 6)
          break
        case 'last_year':
          startDate.setFullYear(startDate.getFullYear() - 1)
          break
      }

      let query = supabase
        .from('expenses')
        .select(`*, categories(name)`) // NOTE: join simple para nombre de categoría
        .eq('account_id', accountId)
        .gte('expense_date', toLocalISODate(startDate))
        .lte('expense_date', toLocalISODate(endDate))

      // NOTE: empleados solo ven sus gastos
      if (profile.role === 'EMPLOYEE') {
        query = query.eq('employee_id', profile.user_id)
      }

      // NOTE: por defecto solo aprobados; se puede ampliar a ALL
      if (statusFilter !== 'ALL') {
        query = query.eq('status', statusFilter)
      }

      const { data: expenses, error } = await query
      if (error) throw error

      if (!expenses || expenses.length === 0) {
        setAnalytics({
          totalExpenses: 0,
          expenseCount: 0,
          averageExpense: 0,
          categoryBreakdown: [],
          monthlyTrend: [],
          statusBreakdown: [],
        })
        return
      }

      const computed = aggregateAnalytics(expenses as any)
      setAnalytics(computed)
    } catch (error) {
      toast.error('Error cargando analíticas')
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(amount)
  }

  const formatMonth = (monthStr: string) => {
    const [year, month] = monthStr.split('-')
    return `${month}/${year.slice(-2)}`
  }

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = { PENDING: 'Pendientes', APPROVED: 'Aprobados', REJECTED: 'Rechazados' }
    return labels[status] || status
  }

  if (loading) {
    return (
      <AppLayout>
        <div className="p-6 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-pulse text-2xl font-semibold">Cargando analíticas…</div>
            <p className="text-muted-foreground mt-2">Esto puede tardar unos segundos</p>
          </div>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        {/* Header + filtros */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <BarChart3 className="h-6 w-6" /> Analíticas
            </h1>
            <p className="text-muted-foreground">Análisis detallado de gastos y tendencias financieras</p>
          </div>
          <div className="flex gap-2">
            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger className="w-48">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="last_month">Último mes</SelectItem>
                <SelectItem value="last_3_months">Últimos 3 meses</SelectItem>
                <SelectItem value="last_6_months">Últimos 6 meses</SelectItem>
                <SelectItem value="last_year">Último año</SelectItem>
              </SelectContent>
            </Select>

            {/* Filtro de estado */}
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
              <SelectTrigger className="w-48">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="APPROVED">Aprobados</SelectItem>
                <SelectItem value="PENDING">Pendientes</SelectItem>
                <SelectItem value="REJECTED">Rechazados</SelectItem>
                <SelectItem value="ALL">Todos</SelectItem>
              </SelectContent>
            </Select>

            <Button variant="outline" className="gap-2">
              <Download className="h-4 w-4" />
              Exportar
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Gasto total</CardTitle>
              <Euro className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(analytics.totalExpenses)}</div>
              <p className="text-xs text-muted-foreground">Periodo seleccionado</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Número de gastos</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{analytics.expenseCount}</div>
              <p className="text-xs text-muted-foreground">Periodo seleccionado</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Gasto medio</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(analytics.averageExpense || 0)}</div>
              <p className="text-xs text-muted-foreground">Por gasto</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Tendencia</CardTitle>
              <TrendingDown className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {analytics.monthlyTrend.length > 1
                  ? formatCurrency(
                      analytics.monthlyTrend[analytics.monthlyTrend.length - 1]?.amount -
                        analytics.monthlyTrend[0]?.amount,
                    )
                  : formatCurrency(0)}
              </div>
              <p className="text-xs text-muted-foreground">Evolución del periodo</p>
            </CardContent>
          </Card>
        </div>

        {/* Category Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChart className="h-5 w-5" /> Gasto por categoría
            </CardTitle>
            <CardDescription>Distribución del gasto agrupado por categoría</CardDescription>
          </CardHeader>
          <CardContent>
            {analytics.categoryBreakdown.length ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {analytics.categoryBreakdown.map((cat) => (
                  <div key={cat.name} className="p-4 rounded-2xl border">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-sm font-medium">{cat.name}</div>
                      <div className="text-xs text-muted-foreground">{cat.count} gastos</div>
                    </div>
                    <div className="text-lg font-semibold text-primary">{formatCurrency(cat.amount)}</div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-8">No hay datos de categoría</p>
            )}
          </CardContent>
        </Card>

        {/* Monthly Trend */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" /> Tendencia mensual
            </CardTitle>
            <CardDescription>Evolución del gasto por mes</CardDescription>
          </CardHeader>
          <CardContent>
            {analytics.monthlyTrend.length ? (
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {analytics.monthlyTrend.map((m) => (
                  <div key={m.month} className="p-4 rounded-2xl border">
                    <div className="text-sm text-muted-foreground">{formatMonth(m.month)}</div>
                    <div className="text-lg font-semibold text-primary">{formatCurrency(m.amount)}</div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-8">No hay datos de tendencia</p>
            )}
          </CardContent>
        </Card>

        {/* Status Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>Estado de los gastos</CardTitle>
            <CardDescription>Conteo y total por estado en el rango</CardDescription>
          </CardHeader>
          <CardContent>
            {analytics.statusBreakdown.length ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {analytics.statusBreakdown.map((status) => (
                  <div key={status.status} className="p-4 rounded-2xl border">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-sm font-medium mb-1">{getStatusLabel(status.status)}</div>
                      <div className="text-xs text-muted-foreground">{status.count} gastos</div>
                    </div>
                    <div className="text-lg font-semibold text-primary">{formatCurrency(status.amount)}</div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-8">No hay datos de estado disponibles</p>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  )
}
