# FRAML Dashboard

BI frontend for the FRAML audit ecosystem (Phase 1). Built with Next.js, deployed on Vercel, reading synthetic data from Supabase.

## Setup

```bash
npm install
cp .env.example .env.local   # fill in SUPABASE_URL and SUPABASE_ANON_KEY
npm run dev
```

## Scripts

- `npm run dev` — local development server
- `npm test` — unit tests (Vitest)
- `npm run lint` — ESLint
- `npm run build` — production build

## Security controls

See [docs/controles-auditoria.md](docs/controles-auditoria.md): data protection in transit (TLS/HSTS) and key management (server-only environment variables, least-privilege key).
