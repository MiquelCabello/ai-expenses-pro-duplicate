# ExpensePro AI - Gestión Inteligente de Gastos

## Overview
ExpensePro AI is a React-based frontend application for intelligent expense management. It features automated receipt capture with AI, enterprise expense management, and multi-tenant account support.

## Recent Changes (2024-09-24)
- Configured for Replit environment
- Updated Vite configuration to use port 5000 and bind to 0.0.0.0
- Set up deployment configuration for autoscale deployment
- Configured workflow for development server

## Project Architecture
- **Frontend**: React 18 with TypeScript, Vite build system
- **UI Framework**: Shadcn/UI with Radix UI components, Tailwind CSS
- **Routing**: React Router DOM
- **State Management**: TanStack React Query
- **Backend**: Supabase (PostgreSQL database with authentication)
- **Authentication**: Supabase Auth with localStorage persistence
- **Forms**: React Hook Form with Zod validation
- **Testing**: Vitest with Testing Library

## Key Features
- Multi-page application with protected routes
- Authentication system with Supabase
- Expense management and analytics
- Employee management
- File upload capabilities
- Dark/light theme support
- Multi-language support (Spanish)

## Development Setup
- **Dev Server**: `npm run dev` (runs on port 5000)
- **Build**: `npm run build`
- **Preview**: `npm run preview` (production preview)
- **Test**: `npm test` (available via vitest)

## Environment Configuration
- Uses Supabase for backend services
- Supabase URL and keys are configured in client.ts with fallbacks
- Environment variables should be prefixed with `VITE_` for frontend access

## Database
- Supabase PostgreSQL with migrations in `/supabase/migrations/`
- Edge functions available in `/supabase/functions/`
- Multi-tenant architecture with RLS policies

## Deployment
- Configured for autoscale deployment on Replit
- Build command: `npm run build`
- Start command: `npm run preview`
- Serves on port 5000 with proper host configuration