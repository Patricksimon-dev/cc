# Church API (Node / Express)

## Setup

```powershell
cd server
copy .env.example .env
npm install
npm run dev
```

API runs at **http://localhost:3001**.

Content is synchronized to MongoDB when `MONGODB_URI` is configured. This is required in hosted environments so edits and uploads survive server restarts and redeployments. Set `API_PUBLIC_URL` to the public API origin so uploaded image URLs point to the API server.

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
