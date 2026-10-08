# Проверка этапов 1–5

Дата: 7 октября 2026. Только локальное окружение; облачные ресурсы не изменялись.

## Результаты

| Проверка | Результат |
|---|---|
| Node.js | 24.21.0 для финальных npm checks и production server |
| Начальный запуск Supabase | PostgreSQL, Auth, REST, Storage, Realtime работают |
| `npm run db:reset` | PASS: чистый replay шести миграций |
| `npm run db:test` | PASS: 201 pgTAP assertions, 4 SQL-файла |
| `npm run db:lint` | PASS: public + private, нет warnings/errors |
| `npm run db:types` | PASS: типы сгенерированы из реальной локальной БД |
| `npm run lint` | PASS |
| `npm run typecheck` | PASS: next typegen + tsc --noEmit, strict |
| `npm run build` | PASS: production build Next.js 16.4.0 |
| Production HTTP smoke | `/` 200, CSS 200, неизвестный route 404 |
| Response headers | X-Powered-By отсутствует |
| Проверка в браузере | dark theme отображается; console warnings/errors отсутствуют |
| REST anonymous access | `/rest/v1/tasks?select=id`: HTTP 401, SQLSTATE 42501 |
| Данные после тестов | Tagged `stage2-` Auth users/workspace удалены; пользовательские данные не сбрасывались |
| `npm audit --omit=dev` | 0 vulnerabilities |
| `npm run db:test:invite-race` | PASS: две параллельные redemption дают одного member и один use |
| Auth + Mailpit integration smoke | PASS: signup, confirmation/recovery templates, OTP, password reset, profile, workspace, invite preview/accept, remove member |
| Browser smoke через CUA | PASS: sign-in, workspace list, profile, invite preview/accept, member leave, sign-out; внешний `next` отклонён |
| Stage 3 browser smoke через CUA | PASS: app shell, workspace switcher, dashboard metrics, Boards list, board overview and three default columns |
| Stage 4 browser smoke через CUA | PASS: create task, create column, task card rendering and drag & drop between TODO/IN PROGRESS; fixture removed |
| Stage 4 move RPC | PASS: locked board/task move, membership denial, stale version and non-finite position checks |
| Stage 5 browser smoke через CUA | PASS: drawer open/close, description, assignee, urgent priority, deadline, label, checklist progress, save and reload |
| Stage 5 details RPC | PASS: atomic save, rollback on invalid assignee/label/checklist, stale version and outsider denial |

## Что проверяет SQL suite

- RLS включён на всех 15 таблицах; anonymous не имеет SELECT grants.
- Owner membership и три колонки доски создаются автоматически.
- Owner и member видят свою команду, outsider не видит её строки ни в одной таблице.
- Участник создаёт, редактирует, перемещает и удаляет task; position сохраняется;
  version растёт при UPDATE; NaN не допускается.
- Нельзя связать task с колонкой другой доски, назначить постороннего или чужую метку.
- Нельзя менять tenant id, автора или version вручную, повышать свою роль,
  добавлять участников без прав owner, редактировать чужой comment/profile.
- Нельзя подделать audit history или изменить invite counters.
- Owner создаёт workspace/board через RLS с RETURNING, переименовывает workspace,
  удаляет member; owner не может выйти и оставить workspace без владельца.
- Private channel authorization разрешает правильный scope и отвергает чужой.
- Storage policies разрешают task files и собственный avatar, отвергают чужие пути.
- После исключения member исчезают assignments и доступ к task/files/channel.
- Удаление task каскадирует checklist/comments/attachment metadata, сохраняет
  activity; удаление board обнуляет его ссылку в activity.
- Buckets приватные, лимиты 10 МиБ и 2 МиБ заданы в Storage.

## Локальная особенность Docker

Docker credential helper зависал при загрузке публичных образов. Для первоначальной
загрузки использована временная пустая Docker client configuration вне проекта;
пользовательские Docker settings/credentials не изменены.

Bind-mount каталога Documents также зависал при запуске Studio и стандартного
`supabase test db`. Поэтому Studio выключен по умолчанию, а `npm run db:test`
передаёт SQL через stdin в PostgreSQL контейнер. Runner проверяет не только код
процесса, но и TAP plan, количество/нумерацию assertions, `not ok`/`Bail out`.
Проверки выполнены на настоящем PostgreSQL Supabase, без mock-схем.
`npm run db:test:cli` оставлен как стандартная альтернатива, но на этом хосте
его запуск не завершён из-за bind-mount; не считать его отдельной пройденной проверкой.

## Ограничения и следующие проверки

Полный `npm audit` сообщает 5 high findings из одной цепочки dev tooling:
`eslint-config-next` → `@next/eslint-plugin-next` → `fast-glob` → `micromatch` →
`braces` (GHSA-vfj7-8cjw-p6xm). Доступный latest braces — 3.0.3, исправленная версия
на момент проверки не опубликована. Автоматически откатывать Next ESLint до 14.x
не стали. Production dependencies чистые; повторить audit перед этапом 10.

Session refresh proxy, Auth UI, invite redemption, rate limits, stage 3 app shell,
stage 4 Kanban, stage 5 task drawer, stage 6 realtime/presence, stage 7 collaboration,
stage 8 personal tasks/search и stage 9 interface polish проверены локально. Не проверены здесь
полный upload UI для аватара, production SMTP/Cloud и deployment; они относятся
к следующим этапам или production checklist. SQL suite не заменяет полный
security audit этапа 10.

## Stage 6 — realtime and presence

- `npm run db:test`: 222/222 pgTAP assertions; `npm run db:lint`: PASS.
- `npm run check`: PASS. `npm run db:test:realtime -- --keep`: PASS with three
  independent local Auth sessions and real Supabase Realtime WebSockets.
- Verified private scope authorization, empty invalidations for task/column/checklist
  changes, two-user Presence, reconnect refetch, denied arbitrary Broadcast,
  optimistic reorder conflict and task DELETE.
- Removing membership rotates `workspaces.realtime_epoch`; the old topic is no
  longer joinable, the removed session cannot read or receive new board events,
  and the remaining user moves to the fresh topic. The client also checks scope
  on focus/visibility and every 15 seconds as recovery for a missed invalidation.

## Повторная проверка после пользовательского запуска

Рабочая копия: `/Users/alexander/Downloads/contour`. Node.js 25.8.1, npm 11.11.0.

- `npm install --package-lock-only --ignore-scripts`: PASS, без EBADENGINE.
- `npm run check`: PASS (ESLint, TypeScript, production build).
- `/`, `/icon.svg`, `/apple-touch-icon.png`, `/apple-touch-icon-precomposed.png`: HTTP 200.
- PNG icons: валидная сигнатура, 180×180; apple-touch-icon указан в HTML metadata.
- `npm audit --omit=dev`: 0 vulnerabilities.
- Migration `20261007000400_invitation_flows.sql` применена без reset; smoke-данные
  с тегом `stage2-` удалены после проверки.
- Stage 5 добавляет `20261007000600_task_details.sql`; drawer загружает детали через
  RLS, а сохранение вызывает invoker RPC с expected version.
- Stage 6 добавляет `20261007000700_live_sync.sql` и `20261007000800_task_graph_version.sql`;
  private channels используют generation-scoped topics, а invalidation broadcasts не содержат строк.
- Stage 7 добавляет `20261007000900_collaboration.sql`; комментарии и activity читаются
  через RLS, а Storage-файлы проходят pending reservation и server cleanup queue.

## Stage 7 — collaboration

- `npm run db:test`: 243/243 pgTAP assertions; `npm run db:lint`: PASS.
- `npm run check`: PASS. `npm run db:test:collaboration`: PASS with three local
  Auth sessions, real Realtime invalidations and real Storage upload/download.
- Browser smoke verified comment create/edit, attachment upload, task activity
  feed and preservation of a comment draft while a second session posted.
- File limits, reservation ownership, MIME/size checks, authenticated downloads,
  abandoned upload cleanup and task cascade cleanup are covered. Activity metadata
  omits comment bodies and file contents.

ESLint 9 EOL подтверждён в [официальной таблице](https://eslint.org/version-support/).
`eslint-plugin-react@7.37.5`, который использует Next.js config, допускает ESLint
до ^9.7, но не 10. Принудительное обновление major без поддерживаемых peer dependencies
не выполнено. У [braces advisory](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm)
по-прежнему нет опубликованной исправленной версии.

Изменены: package.json, package-lock.json, src/app/layout.tsx, README.md,
docs/SUPABASE_SETUP.md, docs/VERIFICATION.md, docs/FILES.md, PROJECT_PROGRESS.md.
Созданы: public/icon.svg, public/apple-touch-icon.png, public/apple-touch-icon-precomposed.png.


## Stages 8–9 — 2026-10-08

- `npm run check`: PASS (ESLint, strict TypeScript, production build).
- `npm run db:test`: 265/265 assertions across seven suites. New search suite:
  title/description/quoted phrase, Russian case-insensitive matching, input bounds,
  stable pagination, caller-only assignments, is_done semantics, outsider and
  removed-member isolation. `npm run db:lint`: PASS.
- `npm run test:tasks`: 11 assertions passed for local date grouping, deep links
  and safe redirect allowlist including /my-tasks.
- Collaboration integration rerun: PASS with three local Auth sessions and real
  Storage/Realtime. Recorded fixture users/workspace were removed after UI smoke.
- Browser: My Tasks assignment in Upcoming, completed empty state, task deep link,
  search by description, ArrowDown/Enter, Cmd+K, Ctrl+K, Escape and N. Typing N in
  description preserves normal input. All four command menu actions exercised.
- Browser: board creation and task creation success toasts; task save toast inside
  the native drawer; workspace activity feed rendered with real events.
- Responsive smoke at 390×844 and 768×1024: document width equals viewport width;
  Kanban scrolls inside its container. Mobile drawer fills screen and navigation
  uses native modal focus containment. Screenshots reviewed. Viewport reset afterward.
- Error boundaries and reduced-motion rules compiled and reviewed; no forced
  browser network outage or OS reduced-motion emulation was performed. Task delete
  DB/cascade authorization is integration-tested; final destructive UI confirmation
  was not exercised in browser.
- Production deployment, remote scheduler, full security/performance audit remain
  stage 10. Search matches whole words, not arbitrary substrings. My Tasks counts
  are per page (up to 100); search pages contain up to 30 results.


## Stage 10 — 2026-10-08

- `npm run check`: PASS (ESLint, strict TS, production build).
- `npm run db:test`: 281 assertions in eight suites; `npm run db:lint`: PASS.
- `npm run test:tasks`: 11 assertions; `npm run test:production`: PASS for CSP,
  key/origin validation, cron constant-time auth, worker partial failures/time budget.
- `db:test:realtime`, `db:test:collaboration`, `db:test:invite-race`: PASS; real
  local Auth/Realtime/Storage. Cleanup fixtures deleted after tests.
- Production `next start` on local port 3100: response headers, unique per-request
  nonce on every script, auth guard streaming redirect, cron rejects anonymous,
  health 200. Authenticated cron with ephemeral server environment: 200 with zero
  due jobs. Real object cleanup was exercised in collaboration integration.
- Browser production login, workspace summary and drawer: PASS; no CSP console errors.
  Test user/workspace removed; temporary production server stopped afterward.
- Benchmark with 1000 fixture tasks and 9.6 KB descriptions, rolled back: full
  task JSON 10,050,811 bytes, card fields 311,811 bytes (~96.9% smaller). These are
  SQL JSON measurements, not whole-page compressed transfer sizes. Board query
  4.136 ms, summary RPC 4.770 ms under authenticated RLS on this local machine.
- Production sign-in HTTP median 14 ms over 5 local requests after startup;
  not LCP/INP or a WAN measurement. No Lighthouse or broad concurrency load test.
- `npm audit --omit=dev`: 0 vulnerabilities. Full audit still has 5 high dev-only
  findings in the known braces chain; latest/peer constraints rechecked in npm registry.
- Preflight accepts a synthetic secure environment shape and rejects localhost
  production URL and a privileged public key. It does not validate cloud credentials.
- CI is source-validated/prepared, not yet executed by GitHub. Remote SMTP, backups,
  deploy, cron scheduling and external monitoring remain unverified until projects
  are selected. See SECURITY_REVIEW.md and RELEASE_RUNBOOK.md.
