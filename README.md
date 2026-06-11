# Sellerbase V2

Clean rebuild of Sellerbase for reseller inventory, sales, expenses, notifications, tax summaries, and business workflows.

## Setup

1. Install dependencies:

```bash
npm install
```

2. Copy `.env.example` to `.env` and add your Supabase anon key.

3. Run `supabase/schema.sql` in the Supabase SQL editor.

4. Start locally:

```bash
npm run dev
```

## Netlify

Build command:

```text
npm run build
```

Publish directory:

```text
dist
```

Environment variables:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
```
