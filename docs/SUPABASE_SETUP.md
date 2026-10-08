# Запуск и Supabase setup

## Локально

Требования: Node.js 24 LTS (рекомендуется, см. `.nvmrc`) или проверенная Node.js 25,
npm, Docker с запущенным daemon.
Supabase CLI закреплён в devDependencies; глобальная установка не нужна.

```sh
npm ci
npm run db:start
cp .env.example .env.local
```

В `.env.local` указать Project URL и локальный publishable key из `supabase status`.
Команду запускать через `npx supabase status`. Не копировать service_role / secret key
в frontend environment. Legacy local anon key также поддерживается Supabase client.
Файл `.env.local` игнорируется Git.

Локальные адреса:

- Next.js: http://localhost:3000
- Supabase API: http://127.0.0.1:54321
- локальная почта Mailpit: http://127.0.0.1:54324
- PostgreSQL: порт 54322 (только локальное окружение)

```sh
npm run db:reset
npm run db:test
npm run db:lint
npm run db:types
npm run check
npm run dev
```

`db:reset` удаляет данные только локального Supabase этого проекта, затем применяет
миграции и пустой seed. Не запускать reset для базы с нужными данными.
`db:types` атомарно заменяет `src/types/database.ts` только после успешной генерации;
при ошибке рабочие типы сохраняются.

SQL-тесты создают фиктивных Auth users в транзакции; отдельный Auth smoke создаёт
адреса `example.test`, читает письмо только из локального Mailpit и удаляет записи
после проверки. Эти данные не являются demo account.

Email confirmation и recovery включены. Шаблоны `supabase/templates/*.html`
передают `token_hash` в `/auth/confirm`; callback проверяет OTP на сервере и
возвращает только allowlisted относительный `next` path. Локальный Auth допускает
только `/auth/callback` и `/auth/confirm` на localhost/127.0.0.1. Пароли и ссылки
из Mailpit не должны попадать в логи или архивы.

Остановка: `npm run db:stop` (локальные данные сохраняются Docker volumes).

Studio по умолчанию выключен: для него CLI монтирует папку `supabase/snippets`
с хоста. На этом компьютере Docker bind-mount из Documents зависает. Для работы
приложения Studio не нужен. При доступном file sharing можно включить
`[studio].enabled = true`, перезапустить локальный stack и открыть порт 54323.

`npm run db:test` передаёт SQL в уже работающий PostgreSQL контейнер через stdin,
без bind-mount и без установленного на хосте psql. Это те же pgTAP assertions;
runner проверяет exit code, TAP plan, номера проверок и отсутствие `not ok`.
Стандартный Supabase runner оставлен как `npm run db:test:cli` для окружений,
в которых разрешены bind-mount. Оба варианта используют одни SQL-файлы.

## Облачный Supabase — когда будет выбран проект

Облачный проект не нужен для проверок этапа 1 и пока не создан/не изменён.
Действия выполнять для собственного проекта Supabase PostgreSQL 17:

1. Создать проект и сохранить credentials вне репозитория.
2. В API settings оставить exposed schema `public`; `private` не экспонировать.
   Отключить автоматическую выдачу Data API grants новым таблицам, если доступна
   соответствующая настройка. Миграции явно задают права существующих таблиц.
3. `npx supabase login`, затем `npx supabase link --project-ref YOUR_PROJECT_REF`.
4. Проверить миграции: `npx supabase db push --dry-run`.
5. Применить: `npx supabase db push`.
6. Проверить приватные buckets `task-attachments` и `avatars` и их лимиты.
7. Realtime Settings: выключить Allow public access; приложение использует private channels.
8. Auth: Site URL — точный production origin, redirect allowlist — точные callback
   URLs. Для preview использовать контролируемые URLs, не произвольные redirects.
9. Email confirmation оставить включённым, настроить SMTP перед публичной регистрацией.

Для облачного проекта вручную настройте Auth email templates по аналогии с
локальными файлами: confirmation и recovery должны вести на production
`/auth/confirm` с `token_hash` и соответствующим `type`. В redirect allowlist
добавьте только точный production callback origin. SMTP и Site URL — настройки
облачного проекта, миграции их не меняют.

Schema, RLS и buckets воспроизводятся миграциями; не создавать их вручную в Studio.
Dashboard-параметры Auth/Realtime требуют отдельной проверки, CLI local config
не является автоматической конфигурацией Supabase Cloud.

## Vercel — подготовка, не deployment

Импортировать каталог приложения как Next.js project. Node.js 24.x,
install `npm ci`, build `npm run build`, без отдельного backend process.
Environment для нужного окружения:

```text
NEXT_PUBLIC_SUPABASE_URL=<URL выбранного Supabase project>
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<publishable key>
NEXT_PUBLIC_APP_URL=<https://точный-домен-приложения>
```

`.env.example` не содержит реальных секретов. Изменение NEXT_PUBLIC variables
требует новой сборки. Использовать разные Supabase projects для production и
разработки. Подготовка этапа 10 выполнена. Перед публикацией пройти docs/RELEASE_RUNBOOK.md.

## Источники

[Supabase local development](https://supabase.com/docs/guides/local-development),
[CLI testing and linting](https://supabase.com/docs/guides/local-development/cli/testing-and-linting),
[Realtime authorization](https://supabase.com/docs/guides/realtime/authorization).
# Очистка приватных вложений (этап 7)

После применения миграций запустите в отдельном терминале:

```sh
npm run storage:cleanup -- --local --watch
```

Однократный проход: `npm run storage:cleanup -- --local`. Локальный worker получает
ключ через Supabase CLI только в памяти. Он выдаёт lease на пачку очереди,
удаляет файлы через Storage API и подтверждает успешные операции. Просроченные
pending reservations удаляются автоматически. После первого удаления путь
проверяется повторно через 24 часа на случай позднего завершения upload.

Для удалённого окружения запускайте `node scripts/storage-cleanup.mjs` без
`--local` в доверенном server worker с `SUPABASE_URL` и
`SUPABASE_SERVICE_ROLE_KEY`, полученными из секретов хостинга. Вариант `--watch`
требует постоянно работающего процесса; для serverless нужен регулярный scheduler
(например, раз в минуту). Никогда не добавляйте service role в `NEXT_PUBLIC_*`.
Защищённый endpoint и Vercel cron подготовлены в этапе 10. Фактическая облачная
публикация и активация scheduler ещё не выполнены; см. docs/RELEASE_RUNBOOK.md.

Для обновления существующей локальной базы используйте
`npx supabase migration up --local`, а не `db:reset`, который удаляет данные.

На Vercel дополнительно нужны server-only SUPABASE_SERVICE_ROLE_KEY и CRON_SECRET.
Build command задаётся vercel.json и включает deploy:preflight.
