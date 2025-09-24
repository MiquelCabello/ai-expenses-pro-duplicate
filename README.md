# AI ExpensePro - Expense Management System

A modern expense management application built with React, TypeScript, Tailwind CSS, and Supabase.

## Features

- 🔐 **Authentication & Authorization** - Secure login/register with role-based access
- 📄 **Receipt Processing** - AI-powered receipt data extraction
- 💰 **Expense Management** - Complete expense tracking and approval workflow
- 👥 **User Management** - Admin panel for managing employees
- 📊 **Analytics & Reports** - Comprehensive expense analytics
- 🎨 **Modern UI** - Beautiful, responsive design with dark/light mode

## Tech Stack

- **Frontend**: React 18, TypeScript, Tailwind CSS, shadcn/ui
- **Backend**: Supabase (PostgreSQL, Auth, Storage, Edge Functions)
- **Build Tool**: Vite
- **Testing**: Vitest, React Testing Library
- **Validation**: Zod
- **Icons**: Lucide React

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Supabase account

### Installation

1. Clone the repository:
```bash
git clone https://github.com/MiquelCabello/ai-expense-pro.git
cd ai-expense-pro
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env
```

Fill in your Supabase credentials in the `.env` file.

4. Start the development server:
```bash
npm run dev
```

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build locally
- `npm run lint` - Run ESLint
- `npm run typecheck` - Run TypeScript type checking
- `npm run test` - Run unit tests
- `npm run test:ui` - Run tests with UI
- `npm run test:coverage` - Run tests with coverage report

## Project Structure

```
src/
├── components/          # Reusable UI components
│   └── ui/             # shadcn/ui components
├── hooks/              # Custom React hooks
├── integrations/       # External service integrations
│   └── supabase/      # Supabase client and types
├── lib/               # Utility functions and configurations
├── pages/             # Page components
├── test/              # Test files and setup
└── types/             # TypeScript type definitions
```

## Database Schema

The application uses Supabase PostgreSQL with the following main tables:

- `profiles` - User profiles and roles
- `categories` - Expense categories
- `expenses` - Expense records
- `project_codes` - Project code assignments
- `files` - File uploads metadata
- `audit_logs` - System audit trail

## Security Features

- Row Level Security (RLS) policies
- Input validation with Zod schemas
- Content Security Policy (CSP)
- File type validation for uploads
- Rate limiting configurations
- Supabase hardening runbook: see docs/security/supabase-hardening.md

## Testing

The project includes comprehensive testing setup:

- Unit tests with Vitest
- Component testing with React Testing Library
- Mocking utilities for external dependencies
- Coverage reporting

Run tests with:
```bash
npm run test
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Run the test suite
6. Create a pull request

## License

This project is licensed under the MIT License.
