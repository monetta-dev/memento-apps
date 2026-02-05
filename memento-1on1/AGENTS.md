# Memento 1on1 - Agent Guidelines

## Project Overview
Next.js 16.1.4 application with React 19.2.3, TypeScript, Ant Design, Zustand, Deepgram, LiveKit, and Supabase.
Primary language: Japanese UI with English codebase.

## Build & Development Commands

### Core Commands
```bash
npm run dev          # Start development server
npm run build        # Production build
npm run start        # Start production server
npm run lint         # Run ESLint
```

### Testing Commands
```bash
# Unit & Integration Tests (Vitest)
npm run test          # Run all Vitest tests once
npm run test:watch    # Run Vitest in watch mode
npm run test:ui       # Open Vitest UI
npm run test:coverage # Run tests with coverage
npm run test:unit     # Run unit tests only
npm run test:integration # Run integration tests only

# Single Test Execution
npx vitest run tests/unit/components/ComponentName.test.tsx  # Run specific test file
npx vitest run -t "test description"                         # Run tests matching pattern

# E2E Tests (Playwright)
npm run test:e2e              # Run all E2E tests
npm run test:e2e:ui           # Open Playwright UI
npm run test:e2e:auth         # Run specific test file
npm run test:all              # Run all tests (Vitest + Playwright)

# Auth Diagnostics
npm run auth:diagnose        # Run auth diagnostic script
```

### Type Checking
TypeScript is configured with strict mode. No separate typecheck command - use:
```bash
npx tsc --noEmit           # Run TypeScript compiler without emitting files
```

## Code Style Guidelines

### File Structure
- **App Router**: Use Next.js 13+ App Router conventions (`app/` directory)
- **Components**: `components/` directory, PascalCase with `.tsx` extension
- **API Routes**: `app/api/` directory, RESTful conventions
- **Store**: Zustand store in `store/useStore.ts`
- **Contexts**: React contexts in `contexts/` directory
- **Hooks**: Custom hooks in `hooks/` directory
- **Tests**: Mirror source structure in `tests/` directory
  - Unit tests: `tests/unit/`
  - Integration tests: `tests/integration/`
  - E2E tests: `tests/e2e/` (Playwright)

### Naming Conventions
- **Components**: PascalCase (`SessionHeader`, `TranscriptionHandler`)
- **Functions/Variables**: camelCase (`handleTranscript`, `isMicOn`)
- **Interfaces/Types**: PascalCase (`TranscriptItem`, `MindMapData`)
- **Constants**: UPPER_SNAKE_CASE for environment/config, camelCase for others
- **Files**: kebab-case for non-component files, PascalCase for components
- **Test Files**: Same name as source with `.test.tsx` suffix

### Imports Order
```typescript
// 1. React & Next.js
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';

// 2. External Libraries
import { Typography, Card, Button } from 'antd';
import { createClient } from '@deepgram/sdk';

// 3. Internal Modules (use @/ alias)
import { useStore } from '@/store/useStore';
import SessionHeader from '@/components/session/SessionHeader';

// 4. Styles & Types
import '@livekit/components-styles';
import type { Session } from '@/types/session';
```

### TypeScript Guidelines
- **Strict Mode**: Enabled - always provide proper types
- **Interfaces vs Types**: Prefer `interface` for objects, `type` for unions
- **Optional Properties**: Use `?` operator (`summary?: string`)
- **Export Types**: Export types/interfaces from central files
- **Type Imports**: Use `import type` for type-only imports
- **Generics**: Use when appropriate (e.g., Zustand selectors)

### Error Handling
```typescript
// API Routes: Return structured JSON with status codes
return NextResponse.json(
  { error: 'Descriptive message', mockMode: true },
  { status: 500 }
);

// Components: Use try-catch with detailed logging
try {
  await operation();
} catch (err) {
  console.error('Operation failed:', {
    message: err instanceof Error ? err.message : err,
    stack: err instanceof Error ? err.stack : undefined,
    context: 'Additional context'
  });
  // User-friendly feedback
  message.error('Operation failed. Please try again.');
}

// Async Operations: Include timeouts for external APIs
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 10000);
```

### React Component Patterns
```typescript
// Client Components: Use 'use client' directive
'use client';

// Props Interface: Define near component
interface ComponentProps {
  isActive: boolean;
  onComplete: () => void;
}

// Default Export: PascalCase component name
export default function ComponentName({ isActive, onComplete }: ComponentProps) {
  // Hooks at top, logic, then JSX
  const [state, setState] = useState('');
  
  return <div>{/* JSX */}</div>;
}
```

### State Management (Zustand)
- **Store Definition**: Single store in `store/useStore.ts`
- **Selectors**: Use shallow comparison for performance
- **Actions**: Group related actions together
- **Persistence**: Use localStorage for client-side persistence

### Testing Standards
```typescript
// Test Structure
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';

describe('ComponentName', () => {
  beforeEach(() => {
    // Reset mocks
  });
  
  it('should render correctly', () => {
    // Arrange, Act, Assert
  });
  
  it('should handle user interaction', async () => {
    // Use userEvent for interactions
  });
});

// Mocking Strategy
vi.mock('@/lib/supabase', () => ({
  createClientComponentClient: vi.fn(() => ({})),
}));

// Coverage: Aim for >80% on critical paths
```

### UI & Styling
- **Ant Design**: Primary UI library - use their components when possible
- **Custom Styles**: Inline styles for simple cases, CSS modules for complex
- **Responsive**: Use Ant Design's responsive utilities
- **Theming**: Custom theme in `theme/themeConfig.ts`

### Internationalization
- **Translation Keys**: Use `t('key')` function for dynamic text
- **Fallbacks**: Japanese as default, English as alternative

### Git & Commit Conventions
- **Commits**: Conventional commits (`feat:`, `fix:`, `chore:`, `docs:`)
- **Branching**: Feature branches from `main`
- **PRs**: Link issues, include screenshots for UI changes

## Environment Variables
- **Development**: `.env.local`
- **Testing**: `.env.test` (loaded for Playwright tests)
- **Production**: Set in deployment platform (Coolify)

## Quality Gates
1. **Pre-commit**: No TypeScript errors, ESLint passes
2. **Pre-push**: All tests pass
3. **PR Merge**: Build succeeds, coverage maintained

## Additional Notes
- **Debug Logging**: Use `process.env.NODE_ENV === 'development'` for debug logs
- **Performance**: Use `useCallback` and `useMemo` for expensive operations
- **Accessibility**: Follow Ant Design's accessibility guidelines
- **Security**: Never commit secrets, validate API inputs