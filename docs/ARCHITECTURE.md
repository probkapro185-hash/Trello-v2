# Contour — архитектура

## Реализованные этапы

Этапы 1–9: Auth, workspace, Kanban, task drawer, realtime, комментарии,
приватные вложения, история, Мои задачи, поиск и адаптивный интерфейс.
Следующая граница — production audit и deployment (этап 10).

## Стек и поток данных

- Next.js App Router + strict TypeScript. Server Components для первого чтения;
  Client Components для интерактивной доски, dnd-kit и подписок.
- Tailwind CSS 4, конфигурация shadcn/ui и базовые dark-токены. Полноценные
  компоненты и дизайн-система — этап 3.
- Supabase PostgreSQL — единственный источник истины. Supabase Auth — сессии;
  Storage — приватные файлы; Realtime — события и Presence.
- Next.js Server Actions / Route Handlers — операции, которым нужны cookies,
  валидация входных данных или секреты. Отдельного Express-сервера нет.
- Browser/server Supabase clients используют publishable key и JWT пользователя.
  Оба подчиняются RLS. Service role используется только доверенным cleanup worker и локальными
  интеграционными тестами, никогда браузерным клиентом приложения.
- Vercel размещает Next.js; отдельный Supabase project обслуживает данные.
  Облачные ресурсы в этапе 1 не создавались.

## Структура

```text
contour/
├── src/
│   ├── app/                    # routes, layouts, Server Components
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── components/ui/          # место для shadcn/ui primitives (этап 3)
│   ├── features/               # auth, workspaces, boards, tasks по этапам
│   ├── hooks/                  # общие клиентские hooks по мере необходимости
│   ├── services/               # типизированные запросы по этапам
│   ├── lib/
│   │   ├── supabase/{client,server}.ts
│   │   ├── constants.ts
│   │   ├── env.ts
│   │   └── utils.ts
│   └── types/
│       ├── database.ts         # результат supabase gen types, не править вручную
│       └── domain.ts           # aliases, DTO и UI contracts
├── supabase/
│   ├── config.toml
│   ├── migrations/             # версия схемы в Git
│   ├── tests/database/         # pgTAP: RLS и ограничения
│   └── seed.sql                # пустой; fixtures тестов откатываются
├── scripts/                    # generate-types.mjs, test-db.mjs
├── docs/
│   ├── ARCHITECTURE.md
│   ├── DATABASE.md
│   ├── SUPABASE_SETUP.md
│   └── VERIFICATION.md
├── components.json
├── .env.example
└── PROJECT_PROGRESS.md
```

Пустые директории — намеренные границы модулей, а не заглушки бизнес-логики.
Feature folders добавлять по необходимости; не создавать универсальный repository
layer, singleton server client или глобальный store заранее.

Защищённые маршруты: `/workspaces`, `/workspaces/[workspaceId]`,
`/workspaces/[workspaceId]/boards`, `/workspaces/[workspaceId]/boards/[boardId]`,
`/workspaces/[workspaceId]/activity`, `/my-tasks`, `/profile`.
Auth: sign-in, sign-up, onboarding, password recovery, callback и invite redemption.

## Модель доступа

В workspace один owner; остальные — members. Все участники работают с досками,
колонками, задачами, метками и чеклистами. Owner управляет workspace и участниками.
Member может выйти; owner должен сначала удалить workspace (передача владения
не входит в MVP). Автор редактирует свои комментарии; owner может удалить любой.

RLS проверяет принадлежность workspace, а column-level grants не дают менять
системные поля. Повторяющиеся workspace_id/board_id в дочерних таблицах —
контролируемая денормализация: составные FK исключают несогласованные значения.
Функции-предикаты лежат в неэкспонируемой схеме `private`, используют пустой
`search_path`, получают user id из JWT и не возвращают чужие строки.

## Auth и приглашения — контракт этапа 2

1. Supabase email/password; подтверждение email; безопасный callback с allowlist
   относительных redirect paths. Затем onboarding: name, username, avatar.
2. В `profiles` нет email и других приватных атрибутов Auth. Username lowercase,
   3–32 символа. Произвольная metadata пользователя не задаёт роль.
3. Создание workspace атомарно добавляет owner membership через DB trigger.
4. Invite: случайный криптографический token минимум 32 bytes. В БД только SHA-256.
   Ссылка показывается owner один раз; токен не логировать и не сохранять в analytics.
5. Redemption — узкий RPC/Server Action: проверенный JWT, блокировка invite row,
   проверка срока/revoked/max_uses, идемпотентное членство и атомарный счётчик.
   Публичного чтения таблицы invites нет; реализации находятся в private schema,
   public wrappers остаются invoker-функциями. Ошибки возвращаются JSON, чтобы
   rate-limit счётчики не откатывались вместе с неудачным вызовом.
6. SSR cookie refresh proxy, sign-out, reset password и redirect guards реализованы
   на этапе 2. Все `next` paths проходят через allowlist; внешние URL не принимаются.

## Application layout — этап 3

Защищённая account-зона обёрнута в единый `AppShell`: постоянный sidebar с
workspace switcher и активным разделом, верхний header с breadcrumb/search affordance
и адаптивное мобильное меню. Dashboard `/workspaces` показывает реальные счётчики
доступных workspace, досок, задач и участников. Раздел
`/workspaces/[workspaceId]/boards` перечисляет доски и создаёт новую доску через
RLS; страница `/boards/[boardId]` загружает scoped columns/tasks и отображает
Kanban. Этап 4 добавляет создание колонок и простых task cards, dnd-kit drag & drop
с optimistic snapshot/rollback и locked RPC перемещения. Этап 5 добавляет task drawer
с описанием, assignee, priority, deadline, labels и checklist.

## Порядок и конкурентные изменения — контракт этапа 4

`position` — finite float8, начальный шаг 1024, сортировка `(position, id)`.
Вставка между соседями — середина интервала. Если интервал исчерпан, атомарно
перенумеровать затронутый список. Совпавшие позиции допустимы и имеют стабильный
порядок по id. Позиции не вычислять заново при чтении.

RPC `public.move_task` добавлен на этапе 4: private implementation проверяет JWT и
membership, блокирует board/task/destination column, проверяет expected task version
и обновляет `column_id/position` в одной транзакции. UI оптимистично переставляет
элементы, на ошибке восстанавливает snapshot; DB `version` увеличивается триггером.
Позиции вычисляются по соседям (середина интервала, fallback шаг 1024); realtime conflict resolution и атомарный rebalance реализованы на этапе 6
в RPC `reorder_task`, который проверяет соседей и expected version.

`public.save_task_details` добавлен на этапе 5 как invoker RPC. Он повторно читает
задачу через RLS, проверяет expected version и атомарно сохраняет task fields,
assignee, labels и checklist graph. При конфликте версии или нарушении составной
связи транзакция возвращает ошибку и откатывает все изменения.

Задачи могут перемещаться только между колонками одной доски. Перенос между
досками и workspace не входит в MVP. Статус завершения задаёт `columns.is_done`,
а не текст имени. На этапе 4 учитывать это и в My Tasks.

## Realtime — контракт этапа 6

- Один private channel `board:<id>` на открытую доску; `workspace:<id>` для
  навигации, меток и membership. Unsubscribe при смене scope и sign-out.
- RLS-политики Receive + Presence разрешают только scope участника. Канал доски
  включает `workspaces.realtime_epoch`, поэтому исключение участника ротирует topic;
  клиент не может публиковать произвольный Broadcast.
- Реализованы DB broadcasts без данных строк: только invalidation event с
  пустым payload после commit. Клиент с небольшим debounce перечитывает активный
  scope через RLS. Это покрывает INSERT/UPDATE/DELETE и не опирается на ограниченную
  фильтрацию DELETE в Postgres Changes. Широкая publication всех таблиц не включена.
- После reconnect всегда полный refetch; события не считаются надёжным журналом.
  Клиент также перечитывает scope после focus/visibility/online и с 15-секундным
  recovery-интервалом. Черновик drawer не перезаписывается удалённым изменением:
  показывается предупреждение версии и предлагается загрузить свежие данные.
  Optimistic mutation id/version предотвращают повторную отрисовку и откат свежих
  данных поздним ответом.
- Presence содержит user id и online timestamp; имена и аватары читать через
  доступные profiles. Presence — подсказка UI, не механизм авторизации.
- Авторизация private channel кэшируется на соединении. При исключении участника
  нужно очищать board state, untrack/remove channels и перепроверять membership;
  для строгого немедленного прекращения Presence потребуется проверенный механизм
  отзыва активного канала. Проверка этого поведения обязательна на этапе 6.
  Пустые invalidation broadcasts не передают содержимое задач старому соединению;
  все последующие чтения защищены актуальной RLS.
- В Supabase Cloud отключить Allow public access для Realtime перед запуском.

## Комментарии, файлы и аудит — этап 7

Комментарии принадлежат task и редактируются только автором; owner может удалить
любой комментарий. Вложения проходят через pending reservation → Storage upload →
finalize RPC. UI показывает только ready-файлы, а Storage API используется для
скачивания и удаления. Удаление metadata добавляет путь в закрытую очередь
cleanup; server-only worker получает lease, удаляет объект через Storage API и
повторяет неуспешные попытки. Ключи service role не попадают в браузер.

`activities` хранит только bounded metadata: actor, action и безопасные подписи
задачи, файла, поля и колонок. Тексты комментариев и содержимое файлов в историю
не копируются. Семантические триггеры покрывают создание/изменение/удаление,
перемещение, assignment, labels, checklist и attachment finalize. Activity read-only
для клиента, пагинация — по `(created_at, id)`.

## Файлы и их жизненный цикл

Скачивание вложений использует authenticated Storage API. Аватары используют
короткоживущие signed URLs. Upload сначала резервирует уникальный pending path;
finalize проверяет реальные размер и MIME. Pending reservations истекают через час.
Worker `scripts/storage-cleanup.mjs` получает lease, удаляет bytes через Storage API
и подтверждает результат. Ошибки повторяются; второй проход через 24 часа закрывает
окно позднего upload. Регулярный worker обязателен для физической очистки; локальный
запуск описан в README. Удалённый scheduler пока не развёрнут.

После удаления task/board история остаётся у workspace, ссылки становятся NULL.
Удаление workspace удаляет его историю. Срок хранения уточняется перед production.

## Мои задачи и поиск — этап 8

Invoker RPC `my_tasks` возвращает назначения `auth.uid()` в доступных workspace.
Активные и завершённые задачи выбираются отдельно по `columns.is_done`.
Страницы по 100 плюс lookahead; порядок — срок, затем id. Группы сроков считаются
по локальной календарной дате устройства, без преобразования SQL date в UTC.
Обновление по focus, раз в минуту и вручную. Счётчики групп относятся к странице.

Invoker RPC `search_tasks` ищет целые слова в названии и описании через GIN
`to_tsvector('simple', title || ' ' || description)` и `websearch_to_tsquery`.
Поддерживаются фразы в кавычках; морфология и поиск произвольной подстроки не входят
в этот вариант. Запросы 2–200 символов, страницы 30 плюс lookahead, стабильный
порядок `updated_at DESC,id`. Все join проходят RLS; anon execute запрещён.

Командное меню дебаунсит поиск и отменяет старые запросы. Оно открывает результаты
через `?task=<uuid>`, предлагает доску для создания задачи или workspace для
создания доски. На текущей доске N фокусирует форму. Cmd/Ctrl+K открывает меню,
стрелки/Enter выбирают действие, Esc закрывает dialog. Одиночные hotkeys не мешают
вводу текста и не обходят несохранённые изменения в открытой панели.

## Интерфейс — этап 9

Desktop sidebar становится native modal drawer на мобильных экранах. Native dialog
удерживает focus, делает фон inert, поддерживает Escape и восстановление focus.
Task drawer занимает весь мобильный экран; Kanban прокручивается внутри контейнера.
Размер текста input на мобильном — 16px. Анимации появления и skeleton отключаются
через `prefers-reduced-motion`.

Account loading/error boundaries сохраняют shell и дают skeleton/retry. Пустые
состояния объясняют следующий шаг. ToastProvider ограничивает очередь тремя
сообщениями и размещает уведомления в текущем dialog, если он открыт. ActionForm
сообщает об успешных действиях и ошибках; DnD не создаёт toast на каждое движение.
Удаление задачи требует подтверждения и проверяет expected version через RLS.

## Источники

Текущая интеграция сверена с [Next.js installation](https://nextjs.org/docs/app/getting-started/installation),
[Supabase SSR](https://supabase.com/docs/guides/auth/server-side/creating-a-client),
[Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security),
[Realtime authorization](https://supabase.com/docs/guides/realtime/authorization),
[Storage access control](https://supabase.com/docs/guides/storage/security/access-control)
и [shadcn/ui Next.js setup](https://ui.shadcn.com/docs/installation/next).

Поиск сверён с [PostgreSQL text search](https://www.postgresql.org/docs/current/textsearch-controls.html).
Next.js API сверены с документацией установленной версии в `node_modules/next/dist/docs`.


## Production readiness — этап 10

Proxy генерирует nonce CSP и передаёт его Next.js renderer; root layout динамический.
В production scripts не допускают unsafe-inline/unsafe-eval; inline styles нужны
для dnd-kit. Статические headers запрещают framing/sniffing и лишние browser permissions.
`/api/cron/storage-cleanup` обходится без пользовательской сессии, требует CRON_SECRET
и только после проверки создаёт server-only privileged client. Общее ядро worker
в `src/lib/storage-cleanup.ts` используется route и CLI. `/api/health` проверяет liveness.

Invoker `workspace_summaries` заменяет 3W HTTP-запросов одним; отдаёт counts и четыре
доски на workspace. Карточки доски используют TaskCard DTO без description и
дублирующих join data; чтение страницами по 500 не обрезает всё после 1000 строк.
Подробные limits/risks и deploy configuration описаны в SECURITY_REVIEW и RELEASE_RUNBOOK.
