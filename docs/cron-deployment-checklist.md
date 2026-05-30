# SecretZa — Cron Deployment Checklist

SecretZa has two cron endpoints that must be called on a schedule in production.
They are both protected by the `x-cron-secret` header — **requests without a
matching `CRON_SECRET` env var return 401**.

---

## Cron Endpoints

### 1. Ranking Refresh + Premium Expiry
```
GET /api/cron/refresh-ranking
```
- **Purpose:** Expires premium users whose `premiumExpiry` has passed (sets `isPremium=false`),
  expires listings with stale boost/feature, recomputes `priorityScore` for all active listings.
- **Recommended schedule:** Every 30 minutes
- **Header required:** `x-cron-secret: <CRON_SECRET>`

### 2. Orphan File Cleanup
```
GET /api/cron/cleanup-files
```
- **Purpose:** Deletes uploaded files (screenshots, listing images) that are no longer
  referenced by any database record — reclaims storage.
- **Recommended schedule:** Daily (e.g. 02:00 UTC)
- **Header required:** `x-cron-secret: <CRON_SECRET>`

---

## Option A — Systemd Timer (self-hosted VPS / Coolify)

Create `/etc/systemd/system/secretza-cron-ranking.service`:
```ini
[Unit]
Description=SecretZa ranking refresh cron

[Service]
Type=oneshot
ExecStart=/usr/bin/curl -sf \
  -H "x-cron-secret: YOUR_CRON_SECRET" \
  https://secretza.com/api/cron/refresh-ranking
```

Create `/etc/systemd/system/secretza-cron-ranking.timer`:
```ini
[Unit]
Description=Run SecretZa ranking refresh every 30 minutes

[Timer]
OnBootSec=5min
OnUnitActiveSec=30min
Unit=secretza-cron-ranking.service

[Install]
WantedBy=timers.target
```

Create `/etc/systemd/system/secretza-cron-cleanup.service`:
```ini
[Unit]
Description=SecretZa orphan file cleanup cron

[Service]
Type=oneshot
ExecStart=/usr/bin/curl -sf \
  -H "x-cron-secret: YOUR_CRON_SECRET" \
  https://secretza.com/api/cron/cleanup-files
```

Create `/etc/systemd/system/secretza-cron-cleanup.timer`:
```ini
[Unit]
Description=Run SecretZa file cleanup daily

[Timer]
OnCalendar=*-*-* 02:00:00
Persistent=true
Unit=secretza-cron-cleanup.service

[Install]
WantedBy=timers.target
```

Enable timers:
```bash
sudo systemctl daemon-reload
sudo systemctl enable --now secretza-cron-ranking.timer
sudo systemctl enable --now secretza-cron-cleanup.timer
sudo systemctl list-timers secretza-*
```

---

## Option B — Crontab (classic Linux)

```crontab
# SecretZa cron jobs
# Run ranking refresh every 30 minutes
*/30 * * * * curl -sf -H "x-cron-secret: YOUR_CRON_SECRET" https://secretza.com/api/cron/refresh-ranking >> /var/log/secretza-cron.log 2>&1

# Run file cleanup daily at 02:00 UTC
0 2 * * * curl -sf -H "x-cron-secret: YOUR_CRON_SECRET" https://secretza.com/api/cron/cleanup-files >> /var/log/secretza-cron.log 2>&1
```

---

## Option C — GitHub Actions scheduled workflow

Create `.github/workflows/cron.yml`:
```yaml
name: SecretZa Cron Jobs

on:
  schedule:
    - cron: "*/30 * * * *"   # ranking refresh every 30 min
    - cron: "0 2 * * *"      # file cleanup daily at 02:00 UTC
  workflow_dispatch:          # allow manual trigger

jobs:
  ranking-refresh:
    if: github.event.schedule == '*/30 * * * *' || github.event_name == 'workflow_dispatch'
    runs-on: ubuntu-latest
    steps:
      - name: Trigger ranking refresh
        run: |
          curl -sf \
            -H "x-cron-secret: ${{ secrets.CRON_SECRET }}" \
            ${{ secrets.SITE_URL }}/api/cron/refresh-ranking

  file-cleanup:
    if: github.event.schedule == '0 2 * * *' || github.event_name == 'workflow_dispatch'
    runs-on: ubuntu-latest
    steps:
      - name: Trigger file cleanup
        run: |
          curl -sf \
            -H "x-cron-secret: ${{ secrets.CRON_SECRET }}" \
            ${{ secrets.SITE_URL }}/api/cron/cleanup-files
```

Add `CRON_SECRET` and `SITE_URL` to GitHub repository secrets.

---

## Option D — External cron service (Cron-job.org / EasyCron)

1. Create a free account at https://cron-job.org
2. Add two jobs:

| Title | URL | Schedule | Header |
|---|---|---|---|
| SecretZa Ranking Refresh | `https://secretza.com/api/cron/refresh-ranking` | Every 30 minutes | `x-cron-secret: YOUR_CRON_SECRET` |
| SecretZa File Cleanup | `https://secretza.com/api/cron/cleanup-files` | Daily 02:00 | `x-cron-secret: YOUR_CRON_SECRET` |

---

## Verification

After setting up, trigger both endpoints manually and confirm 200 responses:

```bash
# Should return 200 with JSON result
curl -v \
  -H "x-cron-secret: $CRON_SECRET" \
  https://secretza.com/api/cron/refresh-ranking

curl -v \
  -H "x-cron-secret: $CRON_SECRET" \
  https://secretza.com/api/cron/cleanup-files
```

Expected response shape for ranking refresh:
```json
{ "success": true, "expiredPremium": 0, "updatedListings": 42 }
```

---

## Security notes

- `CRON_SECRET` must be at least 32 bytes of random entropy: `openssl rand -hex 32`
- Both endpoints use timing-safe comparison (`crypto.timingSafeEqual`) to prevent
  timing attacks on the secret
- Endpoints are rate-limited to prevent abuse if the secret is accidentally leaked
- Never commit `CRON_SECRET` to source control

---

## Checklist

- [ ] `CRON_SECRET` env var set in production
- [ ] Cron scheduler deployed (systemd / crontab / GitHub Actions / external service)
- [ ] Ranking refresh running on 30-minute schedule
- [ ] File cleanup running on daily schedule
- [ ] Both endpoints manually verified returning 200
- [ ] Cron logs monitored (or alerting configured for failures)
