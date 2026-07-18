# Create local Postgres database for FinanceOS
# Usage: bash scripts/create-db.sh

set -euo pipefail

DB_NAME="${DB_NAME:-financeos}"
DB_USER="${DB_USER:-postgres}"

echo "→ Checking PostgreSQL..."
psql --version

echo "→ Creating role/database if needed..."

# Prefer peer/local auth via sudo -u postgres when available
if command -v sudo >/dev/null 2>&1 && id postgres >/dev/null 2>&1; then
  sudo -u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname='${DB_USER}'" | grep -q 1 \
    || sudo -u postgres createuser -s "${DB_USER}" || true

  sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" | grep -q 1 \
    || sudo -u postgres createdb -O "${DB_USER}" "${DB_NAME}"
else
  # Fallback: current OS user
  psql -tc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" postgres | grep -q 1 \
    || createdb "${DB_NAME}"
fi

echo "✓ Database '${DB_NAME}' is ready."
echo "  Update server/.env DATABASE_URL if your user/password differ."
echo "  Example: postgresql://${DB_USER}:YOUR_PASSWORD@localhost:5432/${DB_NAME}?schema=public"
