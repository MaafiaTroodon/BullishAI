# BullishAI - AI-Powered Stock Dashboard

A production-grade, free-tier friendly, AI-powered real-time stocks web app built with Next.js 15, Neon Postgres, Finnhub, Groq AI, and Inngest.

## Features

- 📈 **Real-Time Quotes**: Live stock prices updated every 15 seconds
- 🤖 **AI Insights**: Powered by Groq's Llama-3 for market analysis
- 🔔 **Smart Alerts**: Price alerts and email notifications via Inngest
- 📊 **Interactive Charts**: Multiple timeframes (1D, 5D, 1M, 6M, 1Y)
- 📰 **Company News**: Latest news from Finnhub
- ⭐ **Watchlists**: Create and manage multiple watchlists
- 📧 **Daily Summaries**: Automated email digests

## Tech Stack

### Frontend
- Next.js 15 (App Router)
- TypeScript
- Tailwind CSS
- shadcn/ui components
- Tremor for charts
- SWR for client-side data fetching

### Backend
- Prisma ORM
- Neon Postgres (serverless)
- Inngest (background jobs)
- Better Auth (authentication)

### APIs & Services
- Finnhub (stock data)
- Twelve Data (fallback data)
- Groq AI (Llama-3.1-70b)
- Resend (emails)

## Quick Start

### Prerequisites

- Node.js 18+ and npm/pnpm
- Neon Postgres database (or use the provided connection string)
- API keys for services listed in `.env.example`

### Installation

1. **Clone and install dependencies**
   ```bash
   npm install
   # or
   pnpm install
   ```

2. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your API keys
   ```

3. **Set up the database**
   ```bash
   npm run db:generate
   npm run db:migrate
   npm run db:seed  # Optional: creates demo data
   ```

4. **Run the development server**
   ```bash
   npm run dev
   ```

5. **Run Inngest functions (in another terminal)**
   ```bash
   npm run inngest
   ```

Visit [http://localhost:3000](http://localhost:3000)

## Environment Variables

See `.env.example` for all required environment variables:

- `DATABASE_URL` - Neon Postgres connection string
- `BETTER_AUTH_SECRET` - Auth signing key
- `INNGEST_EVENT_KEY` - Inngest event key
- `FINNHUB_API_KEY` - Finnhub API key
- `TWELVEDATA_API_KEY` - Twelve Data API key
- `GROQ_API_KEY` - Groq AI API key
- `RESEND_API_KEY` - Resend API key

## Project Structure

```
├── app/
│   ├── api/              # API routes
│   ├── dashboard/        # Dashboard pages
│   ├── auth/             # Auth pages
│   └── page.tsx          # Landing page
├── components/            # React components
├── lib/                   # Utilities
│   ├── db.ts            # Prisma client
│   ├── finnhub.ts       # Finnhub API
│   ├── twelvedata.ts    # Twelve Data API
│   └── ai.ts            # Groq AI
├── inngest/              # Background jobs
│   └── functions/        # Inngest functions
├── prisma/
│   └── schema.prisma    # Database schema
└── public/               # Static assets
```

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run db:generate` - Generate Prisma client
- `npm run db:migrate` - Run database migrations
- `npm run db:seed` - Seed demo data
- `npm run inngest` - Start Inngest dev server

## API Endpoints

- `GET /api/quote?symbol=AAPL` - Get stock quote
- `GET /api/chart?symbol=AAPL&range=1d` - Get chart data
- `GET /api/news?symbol=AAPL` - Get company news
- `GET /api/search?query=apple` - Search for symbols

## Deployment

### Vercel (Recommended)

1. Push to GitHub
2. Import project in Vercel
3. Add environment variables
4. Deploy

### Database Migration

Neon Postgres handles migrations automatically. For manual migration:

```bash
npm run db:migrate
```

### Inngest Functions

1. Connect your GitHub repo in Inngest dashboard
2. Add environment variables
3. Deploy functions

## License

MIT
