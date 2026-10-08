# Project Progress

## Current stage

Stage 10 — Security, RLS audit, performance, bug fixes, production cleanup and
**deployment preparation** (именно такая граница задана исходным ТЗ).
ЗАВЕРШЁН локально, 2026-10-08. Облачной публикации ещё нет.
Пользователь дополнительно запросил этапы 11 и 12; в исходном ТЗ они отсутствуют.
Отправлены вопросы о содержании этапов и целевых Vercel/Supabase проектах; ответа
пока нет. Предложение: 11 — публикация, 12 — production smoke и мониторинг.

## Completed

- [x] Next.js App Router, TypeScript strict, Tailwind, shadcn/ui config
- [x] Структура модулей и базовые dark theme tokens
- [x] PostgreSQL schema: 15 application tables, enums, indexes, composite FK
- [x] RLS, column-level grants, private authorization helpers
- [x] Storage buckets and private Realtime authorization policies
- [x] Typed Supabase client factories and domain contracts
- [x] Architecture, relationships and setup documentation
- [x] Migration replay, 129 pgTAP assertions, SQL lint and generated schema types verified
- [x] ESLint, TypeScript, production build, browser and HTTP/REST smoke verified
- [x] Stage 2 — Auth / profiles / workspaces / members / invites
- [x] Stage 3 — App layout / sidebar / dashboard / design system
- [x] Stage 4 — Kanban / columns / tasks / drag & drop
- [x] Stage 5 — Task drawer / properties / labels / checklists
- [x] Stage 6 — Realtime / Presence / optimistic synchronization
- [x] Stage 7 — Comments / attachments / activity
- [x] Stage 8 — My Tasks / search / command menu / hotkeys
- [x] Stage 9 — Responsive / animations / states / polish
- [x] Stage 10 — Security audit / performance / production / deployment preparation
- [ ] Stage 11 — scope and target projects awaiting user input
- [ ] Stage 12 — scope/production target awaiting user input

## Important architecture decisions

- Next.js + Supabase; no independent backend, no public service-role credentials.
- Tenant boundary is workspace; composite FK prevent cross-workspace relations.
- Owner is immutable in this MVP. Members can edit boards/tasks, not memberships.
- `task_assignees` supports many users in DB; MVP UI restricts selection to one.
- All persisted order uses finite float8 position + UUID tie-breaker.
- Task and column versions come from triggers; locked reorder RPC belongs to stage 4.
- `due_date` is a calendar date; `columns.is_done` carries completion semantics.
- Private file paths; no public buckets. Durable object cleanup worker is implemented; regular execution is required.
- Invite tokens are hashed, one-use by default. Redemption uses locked RPCs, a
  private rate counter and idempotent membership.
- Realtime sends empty invalidations and fetches scoped data through RLS.
  Connection revocation rotates the board topic and Presence is treated as a hint.
- Activity is client-read-only; semantic audit triggers are implemented.
- Never hand-edit generated database types; run `npm run db:types`.
- See docs/ARCHITECTURE.md for implementation contracts and boundaries.

## Known limitations

- No remote Supabase project or Vercel deployment has been created.
- Kanban board, task details drawer and realtime conflict resolution/Presence are implemented.
- Comments, private attachments and semantic activity history are implemented.
- Realtime uses private generation-scoped board channels and empty database invalidations;
  clients refetch through RLS after reconnect, focus, visibility changes and debounced events.
- npm audit reports a dev-only braces advisory via Next ESLint tooling;
  production dependency audit is clean. Check for upstream fixes before stage 10.

## Next task

Resolve the requested stages 11–12 and destination projects. No Vercel project,
remote Supabase link or production domain exists in the local configuration.
See docs/RELEASE_RUNBOOK.md; do not claim cloud deployment or monitoring as done.

## Stage 1 validation

The first three migrations replayed successfully from an empty local Supabase database.
`npm run db:test`: 129/129 assertions. `db:lint`, `db:types`, `lint`, `typecheck`
and `build`: PASS. Production homepage/CSS: 200; unknown route: 404.
Anonymous REST task access denied. Production dependency audit: 0 vulnerabilities.
See docs/VERIFICATION.md for evidence and limits.

## Local environment

- Active local project directory: /Users/alexander/Downloads/contour (moved by user).
- Node.js >=24 <26 is supported; 24 LTS is recommended for production.
  Checks passed on 24.21.0 (initial stage) and 25.8.1 (startup follow-up).
- Local Supabase project id: contour; API 54321, DB 54322, Mailpit 54324.
- Studio is disabled to avoid this host's Documents bind-mount issue.
- Database tests stream SQL into Docker; standard CLI runner is `db:test:cli`.
- .env.local has local public client credentials and is ignored by Git/archive.
- No application test accounts or demo tasks persist after tests.
- To stop local services: `npm run db:stop`.

## Files created / changed

The source directory was empty at task start: all delivered source files are new.
The complete list is in docs/FILES.md. Framework scaffold files were configured
within this stage; no pre-existing user code was changed.

## Database changes

Eleven migrations applied locally: 15 tables, 2 enums, relationships/indexes/triggers,
RLS/column grants, 2 private Storage buckets, private Realtime policies, invite
RPC/rate-limit flows, the locked stage 4 `move_task` RPC and stage 5
`save_task_details` RPC, generation-scoped realtime, collaboration/cleanup and
RLS-protected `search_tasks` / `my_tasks` RPCs.
No remote migrations, cloud projects or Vercel deployments were performed.

## Startup follow-up — 2026-10-07

User started the project from Downloads/contour using Node.js 25.8.1.
Expanded engines to >=24 <26 after successful lint/typecheck/build on Node 25;
.nvmrc keeps the recommended Node 24. Added SVG and Apple PNG icons plus metadata.
Both Safari icon URLs now return 200. package-lock.json updated without force fixes.
ESLint EOL and the existing dev-only braces advisory remain documented; runtime
npm audit is clean. Stage 2 source and local database checks are complete.

## Stage 2 validation — 2026-10-07

`npm run check` passed (ESLint, strict TypeScript and production build).
`npm run db:test` passed 167/167 pgTAP assertions; `npm run db:lint` passed.
`npm run db:test:invite-race` passed with two concurrent DB clients: one winner,
one rejected redemption, `use_count=1`. Mailpit/Auth smoke passed signup, email
confirmation, profile creation, workspace creation, invite preview/accept and
member removal. CUA browser smoke passed sign-in, protected workspace/profile pages,
invite preview/accept, member leave and sign-out. Callback tests reject external
redirects. Tagged smoke users and workspace were deleted after validation.

## Stage 3 validation — 2026-10-07

`npm run check` passed after the layout changes. Browser smoke verified the
authenticated application shell, workspace switcher, dashboard metrics, workspace
settings, Boards navigation, board creation fixture and board overview with the
three default columns. A screenshot check confirmed the dark desktop layout and
active navigation state. Smoke Auth users and workspace were deleted afterward.

## Stage 4 validation — 2026-10-07

`npm run check` passed after the Kanban changes. `npm run db:reset` replayed five
migrations; `npm run db:test` passed 176/176 assertions and `npm run db:lint` passed.
CUA smoke verified task creation, column creation, rendered task cards and a
persisted drag from TODO to IN PROGRESS. The tagged Auth users/workspace/task
fixture was deleted after the browser check.

## Stage 5 validation — 2026-10-07

`npm run db:reset` replayed six migrations. `npm run db:test` passed 201/201
assertions, `npm run db:lint` passed, and `npm run check` passed. CUA smoke verified
the task drawer, saved description, assignee, urgent priority, calendar deadline,
workspace label, checklist progress, reload and unsaved-change confirmation.
Tagged Auth users, workspace and task fixture were deleted after the smoke test.

## Stage 6 validation — 2026-10-07

`npm run db:test` passed 222/222 assertions across five SQL suites and
`npm run db:lint` passed. `npm run check` passed (ESLint, strict TypeScript and
production build). `npm run db:test:realtime -- --keep` used three real local Auth
sessions and WebSockets: private channel authorization, two-user Presence join/leave,
empty task/column/checklist invalidations, optimistic reorder conflict, reconnect
refetch, denied client Broadcast, DELETE invalidation, and generation rotation after
membership removal all passed. The tagged fixture was deleted afterward.

## Stage 7 validation — 2026-10-07

`npm run db:test` passed 243/243 assertions across six SQL suites and
`npm run db:lint` passed. `npm run check` passed. The collaboration integration
test used three local Auth sessions and real Storage/Realtime APIs: comment create,
edit/delete authorization, outsider isolation, file reservation and MIME/size
limits, upload finalization, authenticated download, abandoned upload cleanup,
task cascade cleanup, semantic activity events and no-op history suppression.
Browser smoke verified the task discussion, comment editing, attachment upload,
activity feed and preservation of a comment draft while a second session posted.
All tagged users, workspace, task and Storage objects were deleted afterward.


## Stages 8–9 validation — 2026-10-08

`npm run check`, `npm run db:lint`: PASS. `npm run db:test`: 265 assertions;
`npm run test:tasks`: 11 assertions. Collaboration API integration rerun passed.
Browser smoke verified all command menu actions, search by description, task deep
links, My Tasks, completed empty state, Cmd/Ctrl+K, N, Escape, keyboard result
selection, creation/save toasts and workspace activity. Mobile 390×844 and tablet
768×1024 have no document overflow; board retains its own horizontal scroll.
Tagged fixtures removed. Stage 10 remains unstarted. See docs/VERIFICATION.md.


## Stage 10 validation — 2026-10-08

`npm run check`, db lint and production unit tests passed. 281 pgTAP assertions,
11 task utility assertions, real Realtime/collaboration/invite race integrations
passed. Runtime audit: 0 findings; unresolved dev-only braces chain documented.
Production HTTP smoke: fresh CSP script nonces, security headers, no-store, auth
redirect, cron 401, authenticated local cron 200, health 200. Browser production
sign-in/dashboard/task drawer: no CSP errors. Local SQL benchmark: 1000 tasks,
10,050,811 full-row JSON bytes vs 311,811 card-field bytes; 4.136 ms board query,
4.770 ms summary RPC. Production sign-in median 14 ms (5 local HTTP requests,
not browser LCP or internet latency). Recorded fixtures removed.
CI prepared but not executed on GitHub. Cloud checks await destination selection.
