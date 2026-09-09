#!/bin/bash
# Prints the admin login for this container:
#   docker exec openbb credentials
set -euo pipefail

SECRETS_FILE="${DATA_DIR:-/data}/secrets.env"

if [[ ! -f "$SECRETS_FILE" ]]; then
  echo "Admin credentials not generated yet — the container is still starting." >&2
  echo "Try again in a few seconds." >&2
  exit 1
fi

email="$(grep -m1 '^OPENBB_ADMIN_EMAIL=' "$SECRETS_FILE" | cut -d= -f2-)"
password="$(grep -m1 '^OPENBB_ADMIN_PASSWORD=' "$SECRETS_FILE" | cut -d= -f2-)"

cat <<EOF
 URL:      http://localhost:${PORT:-3000}
 Admin:    ${email}
 Password: ${password}
EOF
