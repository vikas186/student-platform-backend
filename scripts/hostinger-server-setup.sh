#!/usr/bin/env bash
# One-time Hostinger VPS setup for Uniwizer backend API.
# Run on the server as root or a sudo user: bash hostinger-server-setup.sh
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/enroll-api}"
DEPLOY_USER="${DEPLOY_USER:-deploy}"
NODE_MAJOR="${NODE_MAJOR:-22}"

echo "==> Installing system packages..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y curl git nginx build-essential python3

echo "==> Creating deploy user (if missing)..."
if ! id "$DEPLOY_USER" &>/dev/null; then
  useradd -m -s /bin/bash "$DEPLOY_USER"
fi

echo "==> Installing Node.js ${NODE_MAJOR} via NodeSource..."
curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash -
apt-get install -y nodejs

echo "==> Installing PM2..."
npm install -g pm2

echo "==> Creating app directory ${APP_DIR}..."
mkdir -p "$APP_DIR"/{config,logs,uploads}
chown -R "${DEPLOY_USER}:${DEPLOY_USER}" "$APP_DIR"

echo "==> PM2 startup on boot..."
env PATH="$PATH:/usr/bin" pm2 startup systemd -u "$DEPLOY_USER" --hp "/home/${DEPLOY_USER}"

echo ""
echo "Done. Next steps:"
echo "  1. Add SSH public key to /home/${DEPLOY_USER}/.ssh/authorized_keys"
echo "  2. Create ${APP_DIR}/config/.env.production (copy from config/.env.example)"
echo "  3. Set GitHub secrets: DEPLOY_HOST, DEPLOY_USER=${DEPLOY_USER}, DEPLOY_SSH_KEY, DEPLOY_PATH=${APP_DIR}"
echo "  4. Configure nginx: deploy/nginx/enroll-api.conf → /etc/nginx/sites-available/enroll-api"
echo "  5. Run GitHub Actions → Deploy API → production"
