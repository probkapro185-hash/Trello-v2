# Contour

Минималистичный командный task manager. Реализованы этапы 1–10: Auth, профили,
workspace, участники, dashboard, Kanban-доска, свойства задачи, realtime,
обсуждение, приватные вложения, история активности, «Мои задачи», поиск,
командное меню, горячие клавиши и адаптивный интерфейс.

Next.js 16 / React 19 / strict TypeScript / Tailwind CSS 4 / shadcn-ready /
Supabase / dnd-kit. Deployment target: Vercel + Supabase.

## Быстрый запуск

```sh
npm ci
npm run dev
```

Рекомендуется Node.js 24 LTS; локально также проверен Node.js 25. Для рабочих
экранов нужен локальный Supabase и `.env.local` из `.env.example`. `npm run db:start`
копирует локальные шаблоны писем во временную папку, потому что Docker Desktop на
этом компьютере не монтирует файлы из Downloads напрямую. Откройте
http://localhost:3000.

## Документация

- [PROJECT_PROGRESS.md](PROJECT_PROGRESS.md) — прочитать перед продолжением.
- [Архитектура и структура](docs/ARCHITECTURE.md)
- [Схема и отношения](docs/DATABASE.md)
- [Supabase setup и подготовка Vercel](docs/SUPABASE_SETUP.md)
- [Результаты проверок](docs/VERIFICATION.md)
- [Полный список файлов](docs/FILES.md)

## Команды

| Команда | Назначение |
|---|---|
| `npm run dev` | Next.js dev server |
| `npm run check` | ESLint, TypeScript, production build |
| `npm run db:start` | Запустить локальный Supabase через Docker |
| `npm run db:stop` | Остановить локальный Supabase |
| `npm run db:reset` | Пересоздать локальную БД и применить миграции |
| `npm run db:test` | Транзакционные pgTAP-тесты |
| `npm run db:lint` | Проверить SQL-функции |
| `npm run db:types` | Сгенерировать TypeScript из локальной БД |
| `npm run db:test:invite-race` | Проверить конкурентное принятие приглашения |
| `npm run db:test:collaboration` | Проверить комментарии, Storage и activity |
| `npm run test:production` | CSP, cron auth, конфигурация и worker retry checks |
| `npm run deploy:preflight` | Проверка production environment без вывода значений |
| `npm run db:benchmark` | Транзакционный локальный benchmark на 1000 задач |
| `npm run test:tasks` | Группировка календарных сроков, ссылки и безопасный redirect |
| `npm run storage:cleanup -- --local` | Удалить отложенные Storage-объекты |

## Работа с задачами

В разделе «Мои задачи» — ваши назначения из всех доступных workspace, с группами
«Просрочены», «Сегодня», «Предстоящие» и «Без срока». Завершённые задачи вынесены
в отдельный фильтр; срок считается по календарной дате устройства. Список
обновляется при возвращении во вкладку, раз в минуту и кнопкой «Обновить».

Поиск по целым словам в названии и описании: кнопка поиска или **Cmd/Ctrl+K**.
Командное меню также создаёт задачу/доску и открывает «Мои задачи». **N** переводит
фокус в создание задачи на доске или предлагает выбрать доску. **Esc** закрывает
панель; несохранённые изменения требуют подтверждения. Сочетания не перехватывают
обычный ввод текста и не обходят открытые диалоги.

## Обновление существующей локальной базы и файлы

```sh
npx supabase migration up --local
npm run storage:cleanup -- --local --watch
```

Вторая команда работает в отдельном терминале: удаляет просроченные загрузки и
байты удалённых вложений через Storage API. Очередь сохраняется при удалении
задачи, доски или workspace; неудачные операции повторяются. Для защиты от поздно
завершившейся загрузки повторная очистка выполняется через 24 часа. Без worker
доступ к удалённому файлу уже закрыт, но физическая очистка откладывается.
Подробности production worker — в `docs/SUPABASE_SETUP.md`.

Этап 10 завершён: аудит, исправления и подготовка deployment. Облачная публикация
и production monitoring пока не выполнены. См. [Release runbook](docs/RELEASE_RUNBOOK.md).

## Предупреждения при установке

Поддерживаемый диапазон проекта: Node.js `>=24 <26`. Для production рекомендуется
24 LTS (`.nvmrc`). На 25.8.1 проверены lint, TypeScript и production build.

ESLint 9 помечен upstream как EOL, но текущий `eslint-plugin-react` из Next.js
конфигурации ещё не объявляет поддержку ESLint 10. До согласованного обновления
сохраняется совместимая версия; предупреждение не мешает запуску приложения.

`npm audit` показывает пять findings в dev-цепочке `braces`; это не пять отдельных
уязвимостей runtime. `npm audit --omit=dev` чистый. Не запускать
`npm audit fix --force`: предложенное автоматическое исправление откатывает
`eslint-config-next` на 14.x. Подробности в `docs/VERIFICATION.md`.


## Готовность к публикации

Vercel configuration, защищённый cleanup cron, `/api/health`, CI workflow и
проверки production HTTP подготовлены. `vercel.json` использует ежедневный cron;
для более быстрой очистки нужен подходящий scheduler. Build на Vercel сначала
проверяет production environment. Секреты не включены в архив.

- [Проверка безопасности и ограничения](docs/SECURITY_REVIEW.md)
- [Публикация, smoke, наблюдение и откат](docs/RELEASE_RUNBOOK.md)
# Trello-v2
