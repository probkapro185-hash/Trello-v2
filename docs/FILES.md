# Файлы проекта после этапа 10

Все перечисленные файлы созданы в ранее пустом каталоге проекта.
Существовавшие пользовательские файлы не изменялись.

```text
.env.example
.gitignore
.nvmrc
AGENTS.md
PROJECT_PROGRESS.md
README.md
components.json
docs/ARCHITECTURE.md
docs/DATABASE.md
docs/FILES.md
docs/SUPABASE_SETUP.md
docs/VERIFICATION.md
eslint.config.mjs
next.config.ts
package-lock.json
package.json
public/.gitkeep
public/icon.svg
public/apple-touch-icon.png
public/apple-touch-icon-precomposed.png
scripts/generate-types.mjs
scripts/test-db.mjs
scripts/test-realtime.mjs
scripts/test-collaboration.mjs
scripts/storage-cleanup.mjs
src/app/globals.css
src/app/layout.tsx
src/app/page.tsx
src/components/ui/.gitkeep
src/features/.gitkeep
src/features/boards/live-scope.tsx
src/features/tasks/activity-feed.tsx
src/features/tasks/collaboration-contracts.ts
src/features/tasks/task-collaboration.tsx
src/app/(account)/workspaces/[workspaceId]/activity/page.tsx
src/hooks/.gitkeep
src/lib/constants.ts
src/lib/env.ts
src/lib/supabase/client.ts
src/lib/supabase/server.ts
src/lib/utils.ts
src/services/.gitkeep
src/types/database.ts
src/types/domain.ts
supabase/config.toml
supabase/migrations/20261007000100_core_schema.sql
supabase/migrations/20261007000200_access_policies.sql
supabase/migrations/20261007000300_storage_realtime.sql
supabase/seed.sql
supabase/tests/database/001_access.test.sql
tsconfig.json
```

Не включены: node_modules, .next, временные файлы Supabase и .env.local.
`next-env.d.ts` автоматически создаётся Next.js.
Локальный .env.local содержит только public client configuration и не распространяется.

После этапа 2 добавлены auth/profile/workspace routes and actions, server refresh
proxy, private invite RPC migration/tests, email templates, avatar processing and
the local Supabase startup helper. `node_modules`, `.next`, `.env.local` and
temporary test files are excluded from release archives.

## Добавлено на этапе 2

```text
scripts/start-local.mjs
scripts/test-invite-race.mjs
src/app/(account)/layout.tsx
src/app/(account)/profile/page.tsx
src/app/(account)/workspaces/page.tsx
src/app/(account)/workspaces/[workspaceId]/page.tsx
src/app/(auth)/forgot-password/page.tsx
src/app/(auth)/onboarding/page.tsx
src/app/(auth)/reset-password/page.tsx
src/app/(auth)/sign-in/page.tsx
src/app/(auth)/sign-up/page.tsx
src/app/auth/callback/route.ts
src/app/auth/confirm/route.ts
src/app/invite/[token]/page.tsx
src/components/action-form.tsx
src/components/account-header.tsx
src/components/auth-shell.tsx
src/components/ui/button.tsx
src/components/ui/input.tsx
src/components/user-avatar.tsx
src/features/auth/actions.ts
src/features/auth/auth-form.tsx
src/features/profiles/actions.ts
src/features/profiles/profile-form.tsx
src/features/workspaces/actions.ts
src/features/workspaces/invite-results.ts
src/lib/navigation.ts
src/lib/validation.ts
src/lib/supabase/proxy.ts
src/proxy.ts
src/services/session.ts
src/services/workspaces.ts
src/types/actions.ts
supabase/migrations/20261007000400_invitation_flows.sql
supabase/templates/confirmation.html
supabase/templates/recovery.html
supabase/tests/database/002_invites.test.sql
```

## Добавлено на этапе 3

```text
src/components/app-shell.tsx
src/components/ui/badge.tsx
src/components/ui/card.tsx
src/app/(account)/workspaces/[workspaceId]/boards/page.tsx
src/app/(account)/workspaces/[workspaceId]/boards/[boardId]/page.tsx
```

Изменены account layout, dashboard workspace page, workspace settings page,
profile page, workspace actions, global progress/docs and README. Новых SQL
миграций на этапе 3 нет.

## Добавлено на этапе 4

```text
src/features/boards/actions.ts
src/features/boards/create-task-form.tsx
src/features/boards/kanban-board.tsx
supabase/migrations/20261007000500_board_mutations.sql
supabase/tests/database/003_board_mutations.test.sql
```

Изменены board page, action-form, validation, generated database types, README,
architecture/database/verification docs и progress.

## Добавлено на этапе 5

```text
src/features/tasks/actions.ts
src/features/tasks/contracts.ts
src/features/tasks/task-drawer.tsx
src/features/boards/board-client.tsx
supabase/migrations/20261007000600_task_details.sql
supabase/tests/database/004_task_details.test.sql
```

Этап 5 не добавляет comments, attachments, activity или realtime subscription.


## Добавлено на этапах 7–9

- `supabase/migrations/20261007000900_collaboration.sql`
- `supabase/migrations/20261008001000_search.sql`
- `supabase/tests/database/006_collaboration.test.sql`
- `supabase/tests/database/007_search.test.sql`
- `scripts/storage-cleanup.mjs`, `scripts/test-collaboration.mjs`, `scripts/test-task-groups.mjs`
- `src/features/tasks/{task-collaboration,activity-feed,my-tasks,command-menu,delete-task}.tsx`
- `src/features/tasks/{collaboration-contracts,task-groups}.ts`
- `src/app/(account)/workspaces/[workspaceId]/activity/page.tsx`
- `src/app/(account)/my-tasks/page.tsx`
- `src/app/(account)/{loading,error}.tsx`
- `src/components/{modal,toasts}.tsx`, `src/components/ui/skeleton.tsx`

Изменены shell, ActionForm, root layout/error, globals.css, board page/client/forms,
Kanban empty state, task actions/drawer, workspace actions, ActionState, redirect
allowlist, generated DB types, package scripts и документация. Полный исходный
проект включён в архив; `.env.local`, зависимости и результаты сборки исключены.


## Этап 10

Созданы: `.github/workflows/verify.yml`, `vercel.json`,
`docs/{SECURITY_REVIEW,RELEASE_RUNBOOK}.md`,
`supabase/migrations/20261008001100_production_readiness.sql`,
`supabase/tests/database/008_production_audit.test.sql`,
`scripts/{test-production,preflight,benchmark-db}.mjs`,
`src/lib/{security,cron-auth,storage-cleanup}.ts`, `src/services/board-tasks.ts`,
`src/app/api/health/route.ts`, `src/app/api/cron/storage-cleanup/route.ts`.

Изменены: config/proxy/root layout, env validation/example, cleanup CLI,
dashboard/board server pages, BoardClient/Kanban DTO, domain/generated types,
package scripts и документация. Секреты и облачные ресурсы не создавались в репозитории.
