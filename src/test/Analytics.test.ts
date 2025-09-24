// Ruta: src/test/analytics.test.ts
// Descripción: Tests mínimos de agregación y fechas locales (Vitest)
// Anotaciones: smoke tests para asegurar céntimos y agrupaciones.
import { describe, it, expect } from 'vitest'
import { aggregateAnalytics, toLocalISODate, type ExpenseRow } from '@/lib/analytics'

const exp = (overrides: Partial<ExpenseRow>): ExpenseRow => ({
  id: 'id',
  employee_id: 'u1',
  category_id: 'c1',
  project_code_id: null,
  receipt_file_id: null,
  amount_gross: 0,
  amount_net: 0,
  tax_vat: null,
  currency: 'EUR',
  vendor: 'Vendor',
  notes: null,
  source: 'MANUAL' as any,
  status: 'APPROVED' as any,
  payment_method: 'CREDIT_CARD' as any,
  expense_date: '2025-01-01',
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-01-01T00:00:00Z',
  approved_at: null,
  approver_id: null,
  hash_dedupe: 'h',
  categories: { name: 'General' },
  ...overrides,
} as any)

describe('toLocalISODate', () => {
  it('formats local dates as YYYY-MM-DD', () => {
    const d = new Date(2025, 1, 3, 12, 34, 56) // Feb 3rd
    expect(toLocalISODate(d)).toBe('2025-02-03')
  })
})

describe('aggregateAnalytics', () => {
  it('sums using cents to avoid rounding issues', () => {
    const expenses = [exp({ amount_gross: 10.01 }), exp({ amount_gross: 0.02 })]
    const res = aggregateAnalytics(expenses)
    expect(res.totalExpenses).toBe(10.03)
    expect(res.averageExpense).toBeCloseTo(5.015, 6)
  })

  it('groups by category and month and status', () => {
    const expenses = [
      exp({ amount_gross: 5, expense_date: '2025-01-15', status: 'APPROVED' as any, categories: { name: 'Comida' } }),
      exp({ amount_gross: 3, expense_date: '2025-01-20', status: 'PENDING' as any, categories: { name: 'Comida' } }),
      exp({ amount_gross: 2, expense_date: '2025-02-01', status: 'REJECTED' as any, categories: { name: 'Viajes' } }),
    ]
    const res = aggregateAnalytics(expenses)

    expect(res.expenseCount).toBe(3)

    const comida = res.categoryBreakdown.find((c) => c.name === 'Comida')!
    const viajes = res.categoryBreakdown.find((c) => c.name === 'Viajes')!
    expect(comida.amount).toBe(8)
    expect(viajes.amount).toBe(2)

    expect(res.monthlyTrend.map((m) => m.month)).toEqual(['2025-01', '2025-02'])

    expect(res.statusBreakdown.find((s) => s.status === 'APPROVED')?.amount).toBe(5)
    expect(res.statusBreakdown.find((s) => s.status === 'PENDING')?.amount).toBe(3)
    expect(res.statusBreakdown.find((s) => s.status === 'REJECTED')?.amount).toBe(2)
  })
})
