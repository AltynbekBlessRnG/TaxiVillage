# TaxiVillage — production stack (выбранный)

Мы **не используем Supabase**. Один основной провайдер для бэка и данных:

| Компонент | Сервис |
|-----------|--------|
| API (NestJS) | **Render** Web Service |
| PostgreSQL | **Render Postgres** |
| Redis (Socket.IO, presence, push queue) | **Render Key Value** |
| Admin panel | **Render** Static Site |
| Privacy / Delete account | **Render** Static Site (`docs/`) |
| Файлы (документы, аватары, меню) | **Cloudflare R2** (следующий обязательный шаг перед «боевым» запуском) |
| Ошибки (опционально) | **Sentry** |
| Мобильные сборки | **EAS** (Expo) |

Почему так: минимум аккаунтов, `render.yaml` уже в репозитории, Prisma и CI без изменений — только `DATABASE_URL` и `REDIS_URL`.

## Чего не хватает в коде перед доверием к продакшену

1. **Внешнее хранилище uploads** — сейчас диск `backend/uploads`; на Render файлы пропадают после рестарта. Нужен R2 (или S3) + переключатель в `UploadService`.
2. **Telegram** — в `production` обязателен `TELEGRAM_WEBHOOK_SECRET` (см. `validate-app-env.ts`).
3. **Мобильный release** — `EXPO_PUBLIC_API_URL=https://<backend-host>/api`, HTTPS, без cleartext в release-сборке.

## Публичные URL (для сторов)

- Privacy: `https://<docs-host>/privacy-policy.html`
- Delete account: `https://<docs-host>/delete-account.html`
- API: `https://<backend-host>/api`
- Admin: `https://<admin-host>`

## Backend env (минимум)

Обязательные:

- `DATABASE_URL` — из Render Postgres (blueprint подставит автоматически)
- `JWT_SECRET` — длинная случайная строка (задать в Dashboard)
- `REDIS_URL` — из Render Key Value (blueprint подставит автоматически)
- `NODE_ENV=production`
- `PORT=10000`
- `TELEGRAM_WEBHOOK_SECRET`
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_BOT_USERNAME`

Рекомендуемые:

- `PUBLIC_BASE_URL=https://<backend-host>` — для ссылок на uploads и webhook
- `APP_ORIGIN=https://<admin-host>` — CORS для админки
- `SENTRY_DSN` — мониторинг
- `OTP_TTL_MINUTES`, `OTP_RESEND_SECONDS`
- `DRIVER_TOPUP_*` — текст для пополнения баланса водителя

## Порядок первого деплоя

1. **GitHub** — репозиторий подключён к Render.
2. **Render Dashboard → New → Blueprint** — указать этот репозиторий, применить корневой `render.yaml`.
3. При создании ввести секреты с `sync: false`: `JWT_SECRET`, `TELEGRAM_*`, при необходимости `SENTRY_DSN`.
4. После первого деплоя backend скопировать URL вида `https://taxivillage-backend.onrender.com`:
   - Admin → `VITE_API_URL` = `https://<backend-host>/api`, пересобрать static site.
   - Backend → `PUBLIC_BASE_URL`, `APP_ORIGIN`.
5. **Telegram** — webhook на `POST https://<backend-host>/api/auth/telegram/webhook` + secret.
6. **Docs** — проверить, что `taxivillage-docs` открывается; URL внести в Google Play / App Store.
7. **EAS** — production build с prod `EXPO_PUBLIC_API_URL`.
8. **R2** — внедрить хранилище и задеплоить backend снова (до массового онбординга водителей с документами).

## Планы и деньги (ориентир)

В `render.yaml` сейчас **free** — карта Render **не нужна** (подходит, если Kaspi/локальная карта не проходит Stripe).

| Ресурс | Free (сейчас) | Paid (позже) |
|--------|----------------|--------------|
| Render Web | Засыпает ~15 мин без трафика | `starter` — always-on |
| Postgres | Free (лимиты Render, не для вечного прода) | `basic-256mb` |
| Key Value | `free` | `starter` |

Если карта пишет «не поддерживает покупки такого типа» — включи **международные онлайн-платежи** в приложении банка, попробуй другую карту (Visa/Mastercard debit), или VPS (Hetzner/Timeweb) с оплатой в тенге.

| Ресурс | Старт | Когда платить больше |
|--------|--------|----------------------|
| Static sites | Бесплатно | Трафик |
| Cloudflare R2 | Почти бесплатно на старте | Много фото меню |
| Google Play | $25 разово | — |
| Apple Developer | $99/год | Если нужен iOS |

## Локально vs прод

- Локально: `docker compose up` (Postgres + Redis + backend на `:3001`).
- CI: Postgres + Redis service containers (см. `.github/workflows/ci.yml`).
- Прод: только Render + позже R2.

## Альтернатива (если Render не устроит)

Один **VPS** (Hetzner / Timeweb) + корневой `docker-compose.yml` — тот же Postgres/Redis, полный контроль, больше ручной работы (бэкапы, TLS, firewall). Supabase по-прежнему не нужен.
