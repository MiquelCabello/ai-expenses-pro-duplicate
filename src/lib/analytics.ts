// Ruta: src/lib/analytics.ts
// Descripción: Helpers de analítica (sumas en céntimos + fechas locales)
// Anotaciones: este archivo incluye comentarios breves (NOTE / RATIONALE / TODO) para entender decisiones.
import type { Database } from '@/integrations/supabase/types'

/** Expense row with optional joined category name. */
export type ExpenseRow = Database['public']['Tables']['expenses']['Row'] & {
  categories?: { name: string } | null
}

/**
 * Formatea Date a YYYY-MM-DD en hora local (sin desplazamiento UTC).
 */
export function toLocalISODate(d: Date): string {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/** Convierte importe a céntimos para evitar errores de coma flotante. */
export function toCents(n: number): number {
  return Math.round(Number(n) * 100)
}

export interface AnalyticsData {
  totalExpenses: number
  expenseCount: number
  averageExpense: number
  categoryBreakdown: { name: string; amount: number; count: number }[]
  monthlyTrend: { month: string; amount: number }[]
  statusBreakdown: { status: string; count: number; amount: number }[]
}

/**
 * Agrega métricas puras sobre una lista de gastos.
 * Retorna importes en unidades mayores (EUR) tras sumar en céntimos.
 *
 * TODO(divisas): punto único para conversión a divisa base (p. ej., EUR).
 *  - Extiende ExpenseRow para incluir tasa de conversión o usa una tabla auxiliar.
 *  - Aplica conversión aquí antes de toCents.
 */
export function aggregateAnalytics(expenses: ExpenseRow[]): AnalyticsData {
  // Totales
  let totalCents = 0
  for (const e of expenses) totalCents += toCents(e.amount_gross)

  const expenseCount = expenses.length
  const averageExpense = expenseCount ? totalCents / expenseCount / 100 : 0

  // Por categoría
  const categoryMap: Record<string, { amountCents: number; count: number }> = {}
  for (const e of expenses) {
    const category = e.categories?.name || 'Sin categoría'
    const cents = toCents(e.amount_gross)
    if (!categoryMap[category]) categoryMap[category] = { amountCents: 0, count: 0 }
    categoryMap[category].amountCents += cents
    categoryMap[category].count += 1
  }
  const categoryBreakdown = Object.entries(categoryMap)
    .map(([name, v]) => ({ name, amount: v.amountCents / 100, count: v.count }))
    .sort((a, b) => b.amount - a.amount)

  // Tendencia mensual
  const monthlyMap: Record<string, number> = {}
  for (const e of expenses) {
    const dt = new Date(e.expense_date)
    const monthKey = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`
    monthlyMap[monthKey] = (monthlyMap[monthKey] || 0) + toCents(e.amount_gross)
  }
  const monthlyTrend = Object.entries(monthlyMap)
    .map(([month, cents]) => ({ month, amount: cents / 100 }))
    .sort((a, b) => a.month.localeCompare(b.month))

  // Por estado
  const statusMap: Record<string, { count: number; cents: number }> = {}
  for (const e of expenses) {
    const st = e.status as string
    const cents = toCents(e.amount_gross)
    if (!statusMap[st]) statusMap[st] = { count: 0, cents: 0 }
    statusMap[st].count += 1
    statusMap[st].cents += cents
  }
  const statusBreakdown = Object.entries(statusMap)
    .map(([status, v]) => ({ status, count: v.count, amount: v.cents / 100 }))
    .sort((a, b) => b.amount - a.amount)

  return {
    totalExpenses: totalCents / 100,
    expenseCount,
    averageExpense,
    categoryBreakdown,
    monthlyTrend,
    statusBreakdown,
  }
}
