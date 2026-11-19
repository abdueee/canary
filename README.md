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

Other scripts:

```bash
npm run db:studio   # browse the database in the browser
npm run db:seed     # seed data (empty for now)
npm run lint
npm run typecheck
```

Postgres runs on port **5433** so it doesn't clash with a locally installed Postgres on 5432.

### Cloud storage (DigitalOcean Spaces)

Uploaded CSVs are stored in a Spaces bucket. Uploading and downloading need these values in `.env`; the rest of the app runs without them.

1. In DigitalOcean, create a Spaces bucket in `tor1` with file listing kept **private**.
2. Create an access key under Spaces Object Storage → Access Keys (read/write on that bucket).
3. Fill in `SPACES_ENDPOINT`, `SPACES_REGION`, `SPACES_BUCKET`, `SPACES_KEY` (the `DO…` access key ID) and `SPACES_SECRET`.
