import { useState, useCallback } from 'react'
import { z } from 'zod'

interface ValidationResult<T> {
  data: T | null
  errors: Record<string, string> | null
  isValid: boolean
}

export function useValidation<T>(schema: z.ZodSchema<T>) {
  const [errors, setErrors] = useState<Record<string, string> | null>(null)

  const validate = useCallback((data: unknown): ValidationResult<T> => {
    try {
      const validData = schema.parse(data)
      setErrors(null)
      return {
        data: validData,
        errors: null,
        isValid: true
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        const fieldErrors = error.issues.reduce((acc, err) => {
          const field = err.path.join('.')
          acc[field] = err.message
          return acc
        }, {} as Record<string, string>)
        
        setErrors(fieldErrors)
        return {
          data: null,
          errors: fieldErrors,
          isValid: false
        }
      }
      
      // Handle unexpected errors
      const genericError = { general: 'Validation failed' }
      setErrors(genericError)
      return {
        data: null,
        errors: genericError,
        isValid: false
      }
    }
  }, [schema])

  const clearErrors = useCallback(() => {
    setErrors(null)
  }, [])

  return {
    validate,
    errors,
    clearErrors,
    hasErrors: errors !== null
  }
}