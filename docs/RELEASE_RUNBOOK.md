# Production release: подготовка и запуск

Этап 10 подготовлен и проверен локально. Облачного релиза пока нет: проект не
привязан к Vercel или удалённому Supabase, production-домен не указан.
Предлагаемые этапы 11 (публикация) и 12 (production smoke/мониторинг) требуют
подтверждения содержания и выбора проектов пользователем.

## Перед публикацией

1. Выбрать Vercel team/project, Supabase organization/project и HTTPS-домен.
   Для preview использовать отдельный Supabase project с тестовыми данными.
2. Node 24 LTS. В Supabase оставить exposed schema `public`; не экспонировать
   `private`. Подключить CLI к выбранному project ref и сверить его перед миграциями.
3. Снять backup существующей БД. Для непустого проекта сначала проверить конфликты
   схемы. `npx supabase db push --dry-run`, затем `npx supabase db push`.
   Production `db reset` не запускать. В проекте 11 последовательных миграций.
4. Проверить RLS, private buckets, ограничения MIME/размера, private Realtime.
   Отключить Allow public access в Realtime. Настроить Auth Site URL и точные
   `/auth/callback`, `/auth/confirm` redirect URLs, SMTP и email templates из
   `supabase/templates`. Проверить подтверждение email и recovery.
5. Настроить секреты хостинга; не записывать их в репозиторий или сообщения:

| Переменная | Где используется |
|---|---|
| NEXT_PUBLIC_APP_URL | Точный HTTPS origin приложения |
| NEXT_PUBLIC_SUPABASE_URL | HTTPS origin выбранного Supabase |
| NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY | Publishable/legacy anon key, доступен браузеру |
| SUPABASE_SERVICE_ROLE_KEY | Только серверный worker очистки |
| CRON_SECRET | Случайный секрет 32–256 символов, только сервер |

`npm run deploy:preflight` проверяет форму конфигурации и запрещает privileged keys
в публичных переменных. Значения не выводятся. Проверка не подтверждает доступность
аккаунта, правильность project ref, SMTP или применённых миграций.
Vercel build запускает preflight автоматически перед сборкой. NEXT_PUBLIC значения
встраиваются в bundle: после их изменения нужно пересобрать приложение.

## Cleanup worker

`vercel.json` содержит cron `17 3 * * *` (03:17 UTC ежедневно), совместимый с Hobby.
Vercel передаёт `Authorization: Bearer <CRON_SECRET>` в GET
`/api/cron/storage-cleanup`. Без корректного секрета endpoint отвечает 401;
ошибка конфигурации или неполная очистка — 503. Успех — 200 со счётчиками,
без путей файлов, идентификаторов пользователей и ключей.

За запуск выдаётся до 100 jobs, обрабатываемых с concurrency 4 и ограничением
времени. Сбой не подтверждает lease; через 5 минут job доступна повторно. Второй
проход через 24 часа удаляет возможный поздний upload. Worker не перекрывает
предыдущий запуск в режиме CLI watch.

Ежедневный cron подходит для небольшого потока и допускает отложенное удаление
bytes. Для регулярных загрузок/быстрой очистки настройте `* * * * *` на подходящем
плане или запустите доверенный внешний worker с `--watch`. Не меняйте план на
платный без согласования. При daily cron или более 100 due jobs очередь может
накапливаться; проверяйте счётчики и возраст очереди. Доступ пользователя к файлу
закрывается сразу после удаления metadata независимо от расписания.

## Проверка после публикации

`TEST_APP_URL=https://your-domain npm run test:production` проверяет HTTP headers,
fresh nonce на скриптах, анонимный auth guard, отказ неавторизованному cron и
`/api/health`. Это read-only smoke; он не создаёт production-данные.

Через отдельные тестовые аккаунты проверить: signup/confirmation/sign-in,
workspace/board/task, приглашение второй сессии, realtime move и конфликт,
изменение задачи, комментарий, upload/download/delete, поиск и My Tasks.
Проверить недоступность чужого workspace/файла и отзыв участника. Удалить только
записанные smoke fixtures. Проверить успешный cron и физическое удаление тестового
файла. Просмотреть CSP errors и запросы в браузере на production origin.

## Наблюдение и откат

- `/api/health` — только liveness процесса, не проверка БД. Проверять HTTP 200 и
  задержку внешним uptime monitor; получателя уведомлений выбирает пользователь.
- В Vercel смотреть 5xx и duration, в Supabase — Auth/DB/Storage ошибки, подключения
  Realtime, slow queries, Security/Performance Advisors. Не логировать bodies,
  пароли, tokens, cookie headers, signed URLs или содержимое файлов.
- Cron: следить за 503, failed/deferred и непрерывными claimed=100. В закрытой БД
  проверять oldest available_at, attempts и объём private.storage_cleanup.
- Перед релизом сохранить предыдущий deployment и backup. Код откатывать на
  предыдущий совместимый deployment; схему исправлять новой forward migration.
  Не откатывать данные reset-командой. Проверить восстановление backup отдельно.
- Enable backups/PITR, retention и бюджет по выбранному плану; подтвердить их
  фактическую доступность в аккаунте перед запуском.

## Источники

[Supabase production checklist](https://supabase.com/docs/guides/deployment/going-into-prod),
[Vercel cron authentication](https://vercel.com/docs/cron-jobs/manage-cron-jobs),
[Vercel cron limits](https://vercel.com/docs/cron-jobs/usage-and-pricing).
