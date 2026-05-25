#!/usr/bin/env bash
#
# Secretza Database Backup Script
# Usage: ./scripts/backup.sh
#
# Requirements:
#   - For PostgreSQL: pg_dump must be available
#   - For SQLite: cp (built-in)
#   - BACKUP_DIR env var or defaults to ./backups
#
# Cron example (daily at 2 AM):
#   0 2 * * * cd /app && ./scripts/backup.sh >> /var/log/secretza-backup.log 2>&1
#

set -euo pipefail

# Configuration
BACKUP_DIR="${BACKUP_DIR:-./backups}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DATABASE_URL="${DATABASE_URL:-file:./db/dev.db}"

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Determine database type and run backup
if [[ "$DATABASE_URL" == postgres* ]]; then
  echo "[$(date -Iseconds)] Starting PostgreSQL backup..."

  # Extract connection details from DATABASE_URL
  # Format: postgresql://user:password@host:port/database
  BACKUP_FILE="$BACKUP_DIR/secretza_$TIMESTAMP.sql.gz"

  pg_dump "$DATABASE_URL" | gzip > "$BACKUP_FILE"

  if [ $? -eq 0 ]; then
    SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
    echo "[$(date -Iseconds)] PostgreSQL backup completed: $BACKUP_FILE ($SIZE)"
  else
    echo "[$(date -Iseconds)] ERROR: PostgreSQL backup failed!"
    exit 1
  fi
else
  echo "[$(date -Iseconds)] Starting SQLite backup..."

  # For SQLite, just copy the database file
  DB_PATH="${DATABASE_URL#file:}"
  if [ ! -f "$DB_PATH" ]; then
    echo "[$(date -Iseconds)] ERROR: Database file not found: $DB_PATH"
    exit 1
  fi

  BACKUP_FILE="$BACKUP_DIR/secretza_$TIMESTAMP.db"
  cp "$DB_PATH" "$BACKUP_FILE"
  gzip "$BACKUP_FILE"

  SIZE=$(du -h "$BACKUP_FILE.gz" | cut -f1)
  echo "[$(date -Iseconds)] SQLite backup completed: $BACKUP_FILE.gz ($SIZE)"
fi

# Cleanup old backups (beyond retention period)
DELETED=$(find "$BACKUP_DIR" -name "secretza_*" -mtime +$RETENTION_DAYS -delete -print | wc -l)
if [ "$DELETED" -gt 0 ]; then
  echo "[$(date -Iseconds)] Cleaned up $DELETED backup(s) older than $RETENTION_DAYS days"
fi

echo "[$(date -Iseconds)] Backup process completed."
