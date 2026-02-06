# Development Guidelines

This document outlines the development standards and workflows for `memento-apps` monorepo.

## 1. Monorepo Structure

We use **npm workspaces** to manage multiple applications in a single repository.

```
memento-apps/           <-- Root (git & npm workspace root)
├── package.json        <-- Defines workspaces & shared scripts
├── package-lock.json   <-- Single source of truth for dependencies
├── supabase/           <-- Shared Database & Auth configuration
├── memento-1on1/       <-- App 1 (Next.js)
├── memento-recruit/    <-- Future App
└── ...
```

## 2. Authentication & Database (Shared)

All applications within this monorepo share the **same Supabase instance**.

- **Config Location**: Root `supabase/` directory.
- **Goal**: Unified user base and shared data schemas.
- **Workflow**:
    - **Migrations**: Run `supabase migration new` from the root.
    - **Types**: Use `supabase gen types` from the root to generate TypeScript definitions.
    - **Access**: Each app should import shared types (e.g., via a path alias or copy script until a shared package is created).

## 3. Design Language & UI

To ensure a consistent look and feel across all Memento apps:

- **Framework**: **Tailwind CSS v4** + **Ant Design**.
- **Principles**:
    - **Consistency**: Use the same color palette and typography defined in the global CSS or Tailwind theme.
    - **Components**: For now, reusable components (Buttons, Cards) are local to each app.
    - **Future Goal**: Extract common UI components into a shared package (e.g., `packages/ui`) to be consumed by all apps.

## 4. Adding a New App

When creating a new application (e.g., `memento-recruit`):

1.  **Create Directory**: Initialize the app in the root folder.
    ```bash
    npm create next-app@latest memento-recruit
    ```
2.  **Register Workspace**: Add `"memento-recruit"` to the `workspaces` array in the root `package.json`.
3.  **Dependencies**: Run `npm install` from the **root** to link dependencies.
4.  **Supabase**: Connect to the shared Supabase instance by setting `.env` variables (URL/Anon Key) to point to the same project.

## 5. Deployment (Vercel)

Deployment is managed via **Vercel**, which has native support for Monorepos.

### Configuration
1.  **Import Project**: In Vercel, import the `memento-apps` repository.
2.  **Root Directory**: When asked, select the specific app directory (e.g., `memento-1on1`) as the root for that project **OR** keep the root as `memento-apps` and set the **Root Directory** setting in "Project Settings" > "General" to `memento-1on1`.
    *   *Recommendation*: Importing the repo and setting the specific app folder as the "Root Directory" in Vercel's import flow usually works best.
3.  **Framework Preset**: Select "Next.js". Vercel will automatically detect `package.json`.
4.  **Environment Variables**: Add your Supabase env vars (`NEXT_PUBLIC_SUPABASE_URL`, etc.).

### Adding a New App
To deploy a new app (e.g., `memento-recruit`):
1.  Go to Vercel Dashboard > "Add New..." > "Project".
2.  Import the **same** `memento-apps` repository again.
3.  **Critical**: In the specific settings for this new project, verify the **Root Directory** is set to `memento-recruit`.
4.  Deploy. Vercel will build only that application from the monorepo.
