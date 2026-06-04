# SecretZa — Production Environment Variables Checklist

Set every variable below in your deployment environment (server `.env`, Coolify / Vercel /
Railway environment panel, or CI secrets) before the first production deploy.

---

## CRITICAL — site will not function without these

| Variable | Example | Notes |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | `https://secretza.com` | Canonical origin. Used by `metadataBase`, sitemaps, canonical URLs, OG tags, robots.txt. Must be HTTPS in production. **No trailing slash.** |
| `NEXTAUTH_URL` | `https://secretza.com` | Must match the production origin exactly. In development: `http://localhost:3000`. |
| `NEXTAUTH_SECRET` | `openssl rand -base64 32` | 32+ byte secret for JWT signing. Never reuse dev value. |
| `DATABASE_URL` | `file:/data/secretza.db` | Absolute path to the SQLite database file on persistent storage. |

---

## REQUIRED — features break without these

| Variable | Example | Notes |
|---|---|---|
| `CRON_SECRET` | `openssl rand -hex 32` | Secures `/api/cron/*` endpoints. Required for ranking refresh and file cleanup to run. |
| `STORAGE_PROVIDER` | `local` or `r2` or `s3` | Determines where uploaded files (listings, screenshots) are stored. Default `local`. |
| `UPLOADS_DIR` | `/data/uploads` | **Required for VPS local storage.** Absolute path to persistent upload directory. Payment screenshots, listing images, and SEO assets are written here when `STORAGE_PROVIDER=local`. |
| `LOCAL_PUBLIC_URL` | unset | Local files are served through `/api/upload/file?key=...` so auth checks and `UPLOADS_DIR` path validation always run. Do not set this for local VPS uploads unless you intentionally switch to a separate public CDN/static mount. |

---

## REQUIRED for Cloudflare R2 storage

Only set these when `STORAGE_PROVIDER=r2`.

| Variable | Notes |
|---|---|
| `R2_ACCOUNT_ID` | Cloudflare account ID |
| `R2_BUCKET` | R2 bucket name |
| `R2_ACCESS_KEY_ID` | R2 API token key ID |
| `R2_SECRET_ACCESS_KEY` | R2 API token secret |
| `R2_PUBLIC_URL` | Public R2 URL (e.g. `https://files.secretza.com`) |

---

## REQUIRED for AWS S3 storage

Only set these when `STORAGE_PROVIDER=s3`.

| Variable | Notes |
|---|---|
| `S3_BUCKET` | S3 bucket name |
| `S3_REGION` | e.g. `ap-south-1` |
| `S3_ACCESS_KEY_ID` | IAM key ID |
| `S3_SECRET_ACCESS_KEY` | IAM key secret |
| `S3_PUBLIC_URL` | Public bucket URL |

---

## RECOMMENDED — SEO and verification

| Variable | Example | Notes |
|---|---|---|
| `GOOGLE_SITE_VERIFICATION` | `abc123xyz` | Google Search Console verification token. Set in deployment env **or** via Admin → Site Settings in the DB. |
| `BING_SITE_VERIFICATION` | `abc123xyz` | Bing Webmaster Tools verification token. |
| `YANDEX_SITE_VERIFICATION` | `abc123xyz` | Yandex verification token. |

---

## RECOMMENDED — Email (password reset, notifications)

| Variable | Example | Notes |
|---|---|---|
| `RESEND_API_KEY` | `re_xxx` | Transactional email via Resend. Without this, email delivery is disabled. |
| `EMAIL_FROM` | `no-reply@secretza.com` | Sender address for outbound emails. |

---

## OPTIONAL — Analytics

Analytics will be silently skipped if these are unset. The app ships with GA4 and
Plausible clients — configure whichever you use.

| Variable | Notes |
|---|---|
| `NEXT_PUBLIC_GA_ID` | Google Analytics 4 Measurement ID (e.g. `G-XXXXXXXXXX`) |
| `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` | Plausible domain (e.g. `secretza.com`) |
| `GA_MEASUREMENT_ID` | Server-side GA4 Measurement ID (same value as above) |
| `GA_API_SECRET` | GA4 Measurement Protocol API secret |
| `PLAUSIBLE_DOMAIN` | Server-side Plausible domain |
| `PLAUSIBLE_API_TOKEN` | Plausible API token for server-side events |

---

## OPTIONAL — Error monitoring (Sentry)

| Variable | Notes |
|---|---|
| `NEXT_PUBLIC_SENTRY_DSN` | Client-side Sentry DSN. Enables browser error tracking. |
| `SENTRY_DSN` | Server-side Sentry DSN. Same value as above unless using separate projects. |

---

## OPTIONAL — OAuth

| Variable | Notes |
|---|---|
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |

---

## OPTIONAL — SEO engine

| Variable | Default | Notes |
|---|---|---|
| `SEO_ENGINE` | `v5` | SEO content generation engine version. Leave as `v5` unless directed. |
| `SEO_REGEN_PEER_LIMIT` | `3` | Max concurrent SEO page regenerations. |

---

## OPTIONAL — Redis (rate-limiting, caching)

| Variable | Notes |
|---|---|
| `REDIS_URL` | Redis connection string. If unset, rate-limiting falls back to in-memory (not suitable for multi-instance). |

---

## Pre-launch verification commands

```bash
# Verify DATABASE_URL is correct and migrations are applied
npx prisma migrate status

# Verify NEXTAUTH_SECRET is set
echo $NEXTAUTH_SECRET | wc -c   # should be > 40

# Verify NEXT_PUBLIC_SITE_URL resolves correctly
curl -I $NEXT_PUBLIC_SITE_URL/robots.txt

# Test cron secret is set
curl -H "x-cron-secret: $CRON_SECRET" $NEXT_PUBLIC_SITE_URL/api/cron/refresh-ranking
```

---

## Checklist

- [ ] `NEXT_PUBLIC_SITE_URL` set to production HTTPS URL
- [ ] `NEXTAUTH_URL` set to production HTTPS URL  
- [ ] `NEXTAUTH_SECRET` set (production value, not dev value)
- [ ] `DATABASE_URL` pointing to persistent SQLite file
- [ ] `CRON_SECRET` set
- [ ] `STORAGE_PROVIDER` set and matching storage keys present
- [ ] `GOOGLE_SITE_VERIFICATION` set (for GSC)
- [ ] Email keys set (if transactional email required)
- [ ] Analytics keys set (if tracking required)
- [ ] Sentry DSN set (if error monitoring required)
