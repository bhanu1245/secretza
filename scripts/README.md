# Secretza Operations Scripts

## Backup & Restore

### Database Backup
```bash
# Manual backup
./scripts/backup.sh

# With custom retention (default: 30 days)
RETENTION_DAYS=7 ./scripts/backup.sh

# With custom backup directory (default: ./backups)
BACKUP_DIR=/mnt/backups ./scripts/backup.sh
```

### Database Restore
```bash
# Restore from backup
./scripts/restore.sh ./backups/secretza_20240101_020000.sql.gz
```

### Cron Setup (Production)
```bash
# Daily backup at 2 AM
0 2 * * * cd /app && ./scripts/backup.sh >> /var/log/secretza-backup.log 2>&1
```

## Cron Endpoints

### File Cleanup (daily)
```
GET /api/cron/cleanup-files
Header: x-cron-secret: <your-secret>
```
- Removes orphaned uploaded files older than 24 hours
- Cleans expired verification tokens

### Ranking Refresh (every 30 min)
```
GET /api/cron/refresh-ranking
Header: x-cron-secret: <your-secret>
```
- Recomputes listing priority scores
- Expires boost/featured flags
- Rotates free listings
