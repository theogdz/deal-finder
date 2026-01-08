# DealFinder

AI-powered Craigslist deal alerts. Tell it what you want, get notified when great deals appear.

## Features

- 💬 **Conversational setup** — Just chat to create alerts
- 🤖 **AI evaluation** — Gemini 3 searches prices, scores deals 1-100
- 📷 **Image analysis** — AI sees listing photos
- 📧 **Email alerts** — Get notified instantly
- 🔒 **Rate limiting** — Protected against abuse

## Quick Start (Local)

```bash
# Install dependencies
npm install
npx playwright install chromium

# Set up database
cp .env.example .env
# Edit .env with your GEMINI_API_KEY
npx prisma db push

# Run
npm run dev
```

Visit `http://localhost:3000`

## Deploy to Render (Free)

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy)

1. Click the button above (or go to render.com/deploy)
2. Connect your GitHub repo
3. Render will auto-detect `render.yaml`
4. Set `GEMINI_API_KEY` in environment variables
5. Deploy!

The free tier includes:
- Web service (750 hours/month)
- PostgreSQL database (256MB)
- Automatic HTTPS

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GEMINI_API_KEY` | Yes | Get from [AI Studio](https://aistudio.google.com/apikey) |
| `DATABASE_URL` | Yes | Postgres connection string (auto-set by Render) |
| `CRON_SECRET` | Prod | Protects `/api/cron` endpoint |
| `RESEND_API_KEY` | Optional | For email alerts ([resend.com](https://resend.com)) |

## Hourly Scans

Use [cron-job.org](https://cron-job.org) (free) to call:
```
GET https://your-app.onrender.com/api/cron
Authorization: Bearer YOUR_CRON_SECRET
```

Schedule: `0 * * * *` (every hour)

## Tech Stack

- Next.js 14
- Prisma + PostgreSQL
- Playwright (Craigslist scraping)
- Gemini 3 Flash (AI evaluation)
- Resend (email)
