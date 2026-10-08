# Stage 10 review — 2026-10-08

Проверена локальная версия исходного кода и схема после 11 миграций. Это review
приложения и автоматические регрессионные проверки, не внешний pentest.

## Проверенные границы

- 15 public таблиц и private служебные таблицы: RLS включена, у anon нет табличных
  прав. Tenant поля и identity/owner поля недоступны для изменения из браузера.
- Definer functions фиксируют search_path; trigger functions и worker RPC закрыты
  от клиента. Invoker search/summary RPC сохраняют RLS на каждом join.
- Auth проверяется на страницах и в actions; redirect allowlist отклоняет внешние
  URL. Server Actions используют встроенную проверку Origin Next.js. Cache-Control
  защищённых ответов — private/no-store. При streaming redirect возможен HTTP 200
  с meta redirect до появления закрытых данных.
- Invite token хранится как hash, ограничены попытки и число активных приглашений;
  конкурентное принятие даёт одного победителя. Роли не берутся из user metadata.
- Storage: private buckets, size/MIME constraints, reservation/finalize, запрет
  overwrite, actual object metadata checks, authenticated attachment downloads.
- Realtime передаёт пустые invalidations. Отзыв membership ротирует topic;
  повторное чтение всегда проходит RLS. Presence не используется для авторизации.
- React экранирует пользовательский текст; dangerous HTML rendering в UI не
  используется. SQL/RPC параметры передаются структурированно.

## Исправления этапа

- Nonce CSP: scripts без unsafe-inline/unsafe-eval в production, object/frame
  запреты, ограничение connect/img origin. Styles допускают inline для dnd-kit.
  HTML динамический; nonce генерируется заново и входной заголовок перезаписывается.
- Nosniff, frame DENY, no-referrer, Permissions-Policy; HSTS при HTTPS APP_URL.
- Валидация origin и вида ключей предотвращает случайную публикацию service role;
  отдельный deployment preflight проверяет серверный worker и cron secret.
- Cleanup endpoint требует timing-safe сравнение секрета, возвращает только
  счётчики. Частичные сбои учитываются, lease подтверждается только после успеха.
- Private cleanup queue получила RLS и индекс срока; добавлены индексы чтения.
- Dashboard N+1 HTTP-запросы заменены одним RPC; board не передаёт полные описания
  и дублирующие вложенные связи в Client Components. Задачи читаются страницами,
  чтобы не терять строки после стандартного лимита Data API.

## Остаточные ограничения

- Runtime audit: 0 vulnerabilities. Full npm audit: 5 high findings в одной
  dev-only цепочке braces → micromatch → fast-glob → Next ESLint. В registry
  braces latest 3.0.3, исправленного релиза для текущего advisory нет. Force fix
  предлагает откат ESLint config на 14.x, поэтому не применён. ESLint 9 EOL;
  eslint-plugin-react пока объявляет peer support только до ^9.7. Проверять upstream.
- Неизвестны настройки будущих Cloud/Vercel проектов: SMTP, leaked-password
  protection, Auth rate limits, backups, Realtime public toggle, домен и секреты.
- Браузерным Supabase sessions нужен JS-доступ к токенам; CSP снижает XSS риск,
  но не заменяет контроль расширений браузера и зависимостей. Avatar signed URLs
  действуют до 60 секунд; вложения скачиваются с текущей авторизацией.
- Политика лимитов общего числа задач/комментариев/storage per workspace пока не
  введена. Участник может расходовать ресурсы своего workspace. Нужны billing
  alerts и продуктовые квоты при публичном масштабировании.
- Канбан пока не виртуализирован; рекомендованный smoke размер — до 1000 карточек.
  Для существенно больших досок нужны UX pagination/virtualization и отдельный
  нагрузочный тест. Offset pages при конкурентном изменении порядка согласуются
  последующим realtime refresh, а не единым snapshot всей доски.
- CI workflow подготовлен, но GitHub runner ещё не запускался. Облачный deployment
  и внешний мониторинг не настроены.
