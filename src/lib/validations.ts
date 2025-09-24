import { z } from 'zod'

// User profile validation
export const profileSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  name: z.string().min(1, 'Name is required'),
  role: z.enum(['ADMIN', 'EMPLOYEE']),
  department: z.string().optional(),
  region: z.string().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).default('ACTIVE'),
})

// Expense validation
export const expenseSchema = z.object({
  id: z.string().uuid().optional(),
  employee_id: z.string().uuid(),
  vendor: z.string().min(1, 'Vendor is required'),
  amount_net: z.number().positive('Amount must be positive'),
  amount_gross: z.number().positive('Gross amount must be positive'),
  tax_vat: z.number().min(0).default(0),
  expense_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
  category_id: z.string().uuid(),
  project_code_id: z.string().uuid().optional(),
  payment_method: z.enum(['CARD', 'CASH', 'TRANSFER', 'OTHER']),
  currency: z.string().length(3).default('EUR'),
  notes: z.string().optional(),
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED']).default('PENDING'),
})

// Category validation
export const categorySchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1, 'Category name is required'),
  budget_monthly: z.number().positive().optional(),
})

// File upload validation
export const fileUploadSchema = z.object({
  file: z.instanceof(File),
  maxSize: z.number().default(5 * 1024 * 1024), // 5MB
  allowedTypes: z.array(z.string()).default(['image/jpeg', 'image/png', 'application/pdf']),
})

// Authentication validation
export const signInSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
})

export const signUpSchema = signInSchema.extend({
  name: z.string().min(1, 'Name is required'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
})

// API Response validation
export const apiResponseSchema = z.object({
  success: z.boolean(),
  data: z.any().optional(),
  error: z.string().optional(),
})

// Types
export type Profile = z.infer<typeof profileSchema>
export type Expense = z.infer<typeof expenseSchema>
export type Category = z.infer<typeof categorySchema>
export type SignIn = z.infer<typeof signInSchema>
export type SignUp = z.infer<typeof signUpSchema>
export type ApiResponse = z.infer<typeof apiResponseSchema>