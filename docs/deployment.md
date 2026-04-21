# TaxiVillage Deployment Notes

## Cheapest stack for now
- `Backend`: Render Web Service
- `Database`: Postgres
- `Redis`: Upstash Redis
- `Static pages`: Render Static Site or Netlify/Vercel
- `Admin`: Render Static Site

## Why this stack
- `Render` can host Node backend and static sites easily.
- `Supabase` gives managed Postgres on a free plan.
- `Upstash` gives a small free Redis, which is enough for low traffic testing.

## Important warning
- Current backend stores uploads on the local filesystem in `backend/uploads`.
- Free Render web services use an ephemeral filesystem, so uploaded files can disappear after restart or spin-down.
- For a real production launch, move uploads to external storage before trusting this stack.

## Public URLs you will need
- `Privacy Policy`
- `Delete Account`
- `Backend API`
- `Admin panel`

 Minimum backend env
- `DATABASE_URL`
- `JWT_SECRET`
- `PORT`
- `REDIS_URL`
- `APP_ORIGIN`
- `PUBLIC_BASE_URL`
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_BOT_USERNAME`
- `OTP_TTL_MINUTES`
- `OTP_RESEND_SECONDS`
- `DRIVER_TOPUP_RECIPIENT`
- `DRIVER_TOPUP_REQUISITES`
- `DRIVER_TOPUP_NOTE`

## Suggested order
1. Deploy static docs.
2. Create Supabase Postgres.
3. Create Upstash Redis.
4. Create Telegram bot and configure webhook to `POST /api/auth/telegram/webhook`.
5. Deploy backend on Render.
6. Deploy admin static site.
7. Point mobile release builds to production API URL.
