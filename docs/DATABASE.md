# Схема PostgreSQL

15 таблиц приложения в `public`, служебные предикаты/триггеры в `private`.
`auth`, `storage`, `realtime` — схемы, управляемые Supabase.

| Таблица | Основные поля | Связи и назначение |
|---|---|---|
| profiles | id, name, username, avatar_path | 1:1 с auth.users; публичные внутри команды поля |
| workspaces | id, name, owner_id | Один владелец; много boards, members, labels, invites |
| workspace_members | workspace_id, user_id, role | M:N users ↔ workspaces; составной PK |
| boards | id, workspace_id, name, position | N:1 workspace; три стартовые columns |
| columns | id, board_id, workspace_id, name, position, is_done, version | N:1 board; порядок колонок |
| tasks | id, column_id, board_id, workspace_id, title, description, priority, due_date, position, version | N:1 column; статус через column.is_done |
| task_assignees | task_id, user_id, board_id, workspace_id, assigned_by | M:N tasks ↔ members; UI MVP выбирает одного |
| labels | id, workspace_id, name, color | Метки общие в workspace; цвет #RRGGBB |
| task_labels | task_id, label_id, board_id, workspace_id | M:N tasks ↔ labels |
| checklists | id, task_id, board_id, workspace_id, title, position | N:1 task |
| checklist_items | id, checklist_id, task_id, board_id, workspace_id, text, is_completed, position | N:1 checklist |
| comments | id, task_id, board_id, workspace_id, body, created_by | N:1 task |
| attachments | id, task_id, board_id, workspace_id, name, bucket_id, storage_path, mime_type, size_bytes, upload_state, expires_at | N:1 task; metadata приватного object |
| activities | id, workspace_id, board_id?, task_id?, actor_id?, action, metadata | Неизменяемый для клиента журнал |
| invites | id, workspace_id, token_hash, expires_at, max_uses, use_count, revoked_at | Приглашения; доступ owner, locked redemption RPC |

UUID генерируются PostgreSQL; клиент вправе передать UUID для optimistic inserts.
Создатели/время/версии недоступны для записи из клиента, default auth.uid() и
DB triggers задают их автоматически. Временные отметки — timestamptz, deadline —
SQL date (календарная дата без сдвига при смене часового пояса).

`workspace_role`: owner, member. `task_priority`: low, medium, high, urgent.
Порядок: float8 position с запретом NaN/Infinity. Поля имени и текста ограничены
по длине; пустые после trim значения не допускаются.

## Связи и удаление

- auth.users → profiles: CASCADE. Владелец workspace не может удалить профиль,
  пока владеет workspace (owner_id RESTRICT).
- workspace → boards/members/labels/invites/activities: CASCADE.
- board → columns → tasks: CASCADE. Удаление заполненной колонки требует
  подтверждения UI на этапе 5; база намеренно удаляет вложенные tasks.
- task → assignees/task_labels/checklists/comments/attachments: CASCADE.
- checklist → checklist_items: CASCADE.
- member → task_assignees: CASCADE; после выхода не остаётся недоступного assignee.
- label → task_labels: CASCADE; сами задачи сохраняются.
- удаление профиля обнуляет created_by/assigned_by/actor_id исторических записей.
- удаление task/board обнуляет ссылки в activities; workspace history сохраняется.
- Storage metadata и физические файлы имеют отдельный lifecycle; cleanup этапа 7
  должен удалять объекты через Storage API, а не прямым DELETE storage.objects.

Составные FK гарантируют соответствие `(column_id, board_id, workspace_id)`
и `(task_id, board_id, workspace_id)`. Assignee ссылается на существующее членство,
label — на тот же workspace. Уникальности имён досок/колонок нет намеренно;
метки уникальны внутри workspace без учёта регистра и крайних пробелов.

## Индексы

- membership `(user_id, workspace_id)` для доступных workspace и RLS;
- workspace ownership;
- boards, columns, tasks, checklists и items: scope + position + id;
- tasks `(workspace_id, due_date)` и GIN full-text по title + description;
- assignees по пользователю, workspace и доске для My Tasks;
- comments / activities: task или workspace + время + id для cursor pagination;
- индексы workspace/board на дочерних таблицах для scoped queries;
- token_hash UNIQUE для поиска invite; workspace для управления ссылками.

## Матрица прав

| Объект | Member | Owner | Не участник / anonymous |
|---|---|---|---|
| Workspace | читать, выйти | читать, переименовать, удалить | нет |
| Membership | читать участников, удалить себя | добавить member, удалить member | нет |
| Boards / columns / tasks | CRUD в workspace | то же | нет |
| Labels / checklists / attachments | CRUD; attachments immutable metadata | то же | нет |
| Comments | читать/добавить; менять/удалять свои | дополнительно удалить чужие | нет |
| Profiles | свои + коллег; менять только свои | то же | только собственный профиль после Auth |
| Invites | нет | читать/отозвать/удалить; создание через будущий RPC | нет |
| Activities | читать | читать | нет |
| Storage | файлы доступных задач; аватары коллег | то же | нет |
| Presence | private channels доступного workspace/board | то же | нет |

Profile insert разрешён только с id текущего auth user. Владение workspace
не передаётся через UPDATE. У membership нет клиентского UPDATE role.
Подделка audit events и invite counters блокируется SQL grants, а не только UI.
Все клиентские запросы используют RLS; service_role обходит RLS и не попадает в браузер.

## Миграции

1. `20261007000100_core_schema.sql`: 15 таблиц, enums, FK, ограничения, индексы,
   updated_at/version и автоматические owner/default-column triggers.
2. `20261007000200_access_policies.sql`: private predicates, RLS всех таблиц,
   явные table/column grants, запрет произвольного audit/invite mutation.
3. `20261007000300_storage_realtime.sql`: приватные buckets, MIME/size restrictions,
   Storage object path rules, доступ к private Presence/Broadcast channels.
4. `20261007000400_invitation_flows.sql`: invite RPCs, redemption locking and rate limits.
5. `20261007000500_board_mutations.sql`: locked `move_task` RPC with membership,
   board scope and expected task-version checks.
6. `20261007000600_task_details.sql`: invoker `save_task_details` RPC for atomic
   task properties, assignee, label and checklist updates.

Применять последовательно через Supabase CLI; для нового окружения replay с нуля.
После публикации миграцию не редактировать — добавлять новую.


7. `20261007000700_live_sync.sql`: private invalidation broadcasts, topic epoch,
   locked neighbour-aware reorder and rebalance.
8. `20261007000800_task_graph_version.sql`: version increments for graph edits.
9. `20261007000900_collaboration.sql`: pending/ready upload lifecycle, semantic
   activities and private durable Storage cleanup queue with worker-only RPCs.
10. `20261008001000_search.sql`: invoker `search_tasks` and `my_tasks` with RLS,
    bounded pagination and no anonymous execution. Uses the existing GIN index.

Cleanup реализован скриптом `scripts/storage-cleanup.mjs`; регулярный запуск
обязателен для физического удаления файлов. Клиентский доступ закрывается сразу
после удаления metadata. Очередь в private не имеет FK к удаляемому workspace.

11. `20261008001100_production_readiness.sql`: RLS private cleanup queue, due-job/
    pending-upload and board/timeline indexes, invoker workspace summary RPC.
