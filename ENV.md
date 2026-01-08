# DealFinder Environment Variables

## Required
```
GEMINI_API_KEY=your-gemini-api-key        # Get from https://aistudio.google.com/apikey
DATABASE_URL=file:./dev.db                 # SQLite for dev, Postgres URL for prod
```

## Email (required for alerts)
```
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password              # Gmail: Settings > Security > App passwords
```

## Security (required for production)
```
CRON_SECRET=your-random-secret-here       # Used to authenticate cron jobs
```

## Production Database
Choose one:
```
# Supabase/Neon (Postgres)
DATABASE_URL=postgresql://user:pass@host:5432/dealfinder

# PlanetScale (MySQL)
DATABASE_URL=mysql://user:pass@host:3306/dealfinder
```

---

## Quick Start

1. Copy `.env` and fill in values
2. Run `npx prisma db push`
3. Run `npm run dev`
4. Visit `http://localhost:3000`
