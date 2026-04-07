#!/bin/sh

set -eu

wait_for_database() {
  python - <<'PY'
import os
import socket
import sys
import time
from urllib.parse import urlsplit

database_url = os.environ.get("DATABASE_URL", "")

if not database_url or database_url.startswith("sqlite"):
    sys.exit(0)

parts = urlsplit(database_url)
host = parts.hostname or "db"
port = parts.port or 5432
deadline = time.time() + 60

while time.time() < deadline:
    try:
        with socket.create_connection((host, port), timeout=2):
            sys.exit(0)
    except OSError:
        time.sleep(1)

print(f"Database did not become ready in time: {host}:{port}", file=sys.stderr)
sys.exit(1)
PY
}

run_migrations() {
  echo "Waiting for database..."
  wait_for_database
  echo "Applying Alembic migrations..."
  alembic upgrade head
  echo "Ensuring metadata-defined tables exist for local bootstrap..."
  python - <<'PY'
import asyncio

from app.core.database import init_db

asyncio.run(init_db())
PY
  echo "Database schema is ready."
}

case "${1:-}" in
  migrate)
    run_migrations
    ;;
  *)
    exec "$@"
    ;;
esac
