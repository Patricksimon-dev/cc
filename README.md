# Church API (Node / Express)

## Setup

```powershell
cd server
copy .env.example .env
npm install
npm run dev
```

API runs at **http://localhost:3001**.

The API uses SQLite for local development (the database file can be selected with `SQLITE_DATABASE_PATH`). Set `DATABASE_URL` (or `PG_CONNECTION_STRING`) to a persistent Postgres/Neon connection string in the hosting provider's environment so announcements, sermons, activities, About content, and uploads survive server restarts and redeployments. The API creates/updates its Postgres tables at startup. `API_PUBLIC_URL` should be the public API origin so uploaded image URLs point to the API server.

Default demo content is disabled unless `SEED_DEFAULT_CONTENT=true` is explicitly configured.

New sermons and announcements are automatically deleted one month after they are posted. Cleanup runs at server startup and hourly; existing posts are not assigned an expiry date.

To inspect uploaded media storage, run `npm run cleanup-uploads`. To remove all uploaded files from GridFS and free Atlas storage, run `npm run cleanup-uploads -- --delete-all`. This does not remove leadership or event records, but their old image links will need to be replaced.

## Default admin

| Field | Value |
|-------|--------|
| Email | `admin@gracechurch.org` |
| Password | `admin123` |

Change these in `.env` before first run (`ADMIN_EMAIL`, `ADMIN_PASSWORD`).

## Social media

1. Copy settings from `.env.example` into `.env`.
2. **Facebook:** [Meta for Developers](https://developers.facebook.com) — create an app, get a **Page access token** with `pages_manage_posts`, set `FACEBOOK_PAGE_ID`, `FACEBOOK_PAGE_ACCESS_TOKEN`, `FACEBOOK_ENABLED=true`.
3. **X (Twitter):** [Developer Portal](https://developer.x.com) — create a project/app with **tweet.write**, use OAuth 2.0 user token as `TWITTER_BEARER_TOKEN`, set `TWITTER_ENABLED=true`.

When saving announcements, sermons, or events in admin, check **Post to social when saving** and pick platforms.

View publish history under **Admin → Social Media**.

## Postgres / Neon (migration & deployment)

This project can use a serverless Postgres (Neon) instance for persistence. Follow these steps to migrate your local SQLite data and run the app with Neon:

1. Create a Neon Postgres database and get the connection string (e.g. `postgres://user:pass@host:5432/dbname`).
2. Set the connection string as `DATABASE_URL` in the hosting provider's environment settings. Hosted instances must use Postgres; the local SQLite file is not durable across many redeployments.

PowerShell example (one-shot):
```powershell
$env:DATABASE_URL="postgres://user:pass@host:5432/dbname"
# Run the migration script to copy existing SQLite data into Postgres
node src/db/migrateToPostgres.mjs

# Start the server using the same DATABASE_URL
node src/index.js
```

You can run the migration and verification scripts in parallel (PowerShell background jobs):
```powershell
$env:DATABASE_URL="postgres://user:pass@host:5432/dbname"
Start-Job -ScriptBlock { $env:DATABASE_URL = $env:DATABASE_URL; node src/db/migrateToPostgres.mjs }
Start-Job -ScriptBlock { $env:DATABASE_URL = $env:DATABASE_URL; node src/scripts/testCrud.mjs }
Get-Job | Wait-Job
Get-Job | Receive-Job
```

Notes
- The API selects Postgres when `DATABASE_URL` or `PG_CONNECTION_STRING` is configured; otherwise it uses SQLite for local development.
- Existing SQLite content can be copied into Postgres with `npm run migrate-postgres` before deploying.
- Uploaded media are stored in the `uploads` table and served from `/api/uploads/:id`.
- If you plan to deploy to Neon, ensure `DATABASE_URL` and environment secrets are configured in the Neon project settings.

## Endpoints

| Method | Path | Auth |
|--------|------|------|
| GET | `/api/content` | Public |
| POST | `/api/auth/login` | Public |
| GET | `/api/auth/me` | JWT |
| PUT | `/api/admin/about` | JWT |
| CRUD | `/api/admin/:collection` | JWT |
| GET | `/api/admin/social/status` | JWT |
| POST | `/api/admin/social/publish` | JWT |

Run the React app with `npm run dev` from the project root (proxies `/api` to the server).
