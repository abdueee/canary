# Canary

Data quality monitoring for recurring CSV datasets. ECE1724 course project.

## Development

Requires Node 20+ and Docker Desktop.

```bash
cp .env.example .env     # local defaults work for the database
docker compose up -d     # Postgres 16 on localhost:5433
npm install              # also generates the Prisma client
npm run db:migrate       # create/update tables
npm run dev              # http://localhost:3000
```

### Authentication and the first admin

Auth uses [Better Auth](https://www.better-auth.com) with email and password. Users,
sessions and password hashes are stored in Postgres (`user`, `session`, `account`,
`verification` tables).

1. In `.env`, set `BETTER_AUTH_SECRET` to 32+ random characters:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
   ```
   and set `SEED_ADMIN_EMAIL` to the email you'll register with.
2. Start the app and register that email at http://localhost:3000/register.
   Everyone who registers starts as a **viewer**.
3. Promote it to admin:
   ```bash
   npm run db:seed
   ```
4. Sign out and back in (or refresh). The **Users** link appears; other admins can be
   promoted from `/admin/users`.

**Roles:** admins create datasets, manage checks and resolve alerts. Viewers can view
everything and upload files. The app always keeps at least one admin: demoting the
last one is refused.

**Where permissions are enforced:** in server code, not the UI. Server Components and
Server Actions call `requireUser()` / `requireRole("admin")` from `src/lib/authz.ts`.
Route Handlers call `getCurrentUser()` and return 401/403. `src/proxy.ts` only redirects
visitors without a session cookie to `/login`; it does not validate the cookie.

Other scripts:

```bash
npm run db:studio   # browse the database in the browser
npm run db:seed     # promote SEED_ADMIN_EMAIL to admin
npm run lint
npm run typecheck
```

Postgres runs on port **5433** so it doesn't clash with a locally installed Postgres on 5432.
