
# Learnings

## Architecture
- SPA with TanStack Start, single route at /
- SSR disabled (ssr: false)
- AppShell wraps EmployeeDashboard or ManagerDashboard based on role
- I18nProvider handles ar/en with RTL/LTR switching
- AuthProvider handles Supabase auth + profile/role loading

## Data Fetching (Current - Pre React Query)
- All Supabase fetches use raw useState/useEffect
- No caching, no stale-while-revalidate
- No optimistic updates
- Loading states are text-only

## Key Patterns
- Supabase client is lazy-initialized via proxy in src/integrations/supabase/client.ts
- DB types are comprehensive in src/integrations/supabase/types.ts
- 46 shadcn/ui components available in src/components/ui/
- Tailwind 4 with CSS custom properties in src/styles.css
- Bilingual: all text must go through i18n dict in src/lib/i18n.tsx

## Conventions
- Files under 200 lines
- Each component in its own file under src/components/
- Tailwind utility classes only (no inline styles except CSS custom properties)
- All user-visible text must be bilingual (Arabic key + English fallback)

