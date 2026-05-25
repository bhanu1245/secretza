#!/usr/bin/env bash
#
# Secretza Database Restore Script
# Usage: ./scripts/restore.sh <backup_file>
#
# WARNING: This will OVERWRITE the current database!
#

set -euo pipefail

if [ $# -ne 1 ]; then
  echo "Usage: $0 <backup_file>"
  echo "Example: $0 ./backups/secretza_20240101_020000.sql.gz"
  exit 1
fi

BACKUP_FILE="$1"

if [ ! -f "$BACKUP_FILE" ]; then
  echo "ERROR: Backup file not found: $BACKUP_FILE"
  exit 1
fi

DATABASE_URL="${DATABASE_URL:-file:./db/dev.db}"

# Confirm restore
read -p "⚠️  This will OVERWRITE the current database. Are you sure? (type 'yes'): " CONFIRM
if [ "$CONFIRM" != "yes" ]; then
  echo "Restore cancelled."
  exit 0
fi

if [[ "$DATABASE_URL" == postgres* ]]; then
  echo "Restoring PostgreSQL from $BACKUP_FILE..."

  if [[ "$BACKUP_FILE" == *.gz ]]; then
    gunzip -c "$BACKUP_FILE" | psql "$DATABASE_URL"
  else
    psql "$DATABASE_URL" < "$BACKUP_FILE"
  fi
else
  echo "Restoring SQLite from $BACKUP_FILE..."

  DB_PATH="${DATABASE_URL#file:}"

  if [[ "$BACKUP_FILE" == *.gz ]]; then
    gunzip -c "$BACKUP_FILE" > "$DB_PATH"
  else
    cp "$BACKUP_FILE" "$DB_PATH"
  fi
fi

echo "Restore completed from $BACKUP_FILE"
