#!/usr/bin/env bash
set -euo pipefail

readonly ADMIN_USERNAME="${1:-}"
readonly ADMIN_PASSWORD="${2:-}"

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run this installer as root." >&2
  exit 1
fi

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source_root="${repo_root}/apps/admin"
deploy_root="/srv/pocket-friend-admin"
environment_dir="/etc/pocket-friend"
environment_file="${environment_dir}/admin.env"
service_file="/etc/systemd/system/pocket-friend-admin.service"
sudoers_file="/etc/sudoers.d/pocket-friend-admin-deploy"

[[ -f "${source_root}/src/server.ts" ]] || { echo "Admin source is missing." >&2; exit 1; }
id pf-web >/dev/null 2>&1 || { echo "pf-web user is missing." >&2; exit 1; }
id pf-deploy >/dev/null 2>&1 || { echo "pf-deploy user is missing." >&2; exit 1; }

install -d -m 0750 -o pf-deploy -g pf-deploy "${deploy_root}" "${deploy_root}/releases"
install -d -m 0750 -o root -g pf-web "${environment_dir}"

if [[ ! -e "${environment_file}" ]]; then
  if [[ -n "${ADMIN_USERNAME}" ]] && [[ -n "${ADMIN_PASSWORD}" ]]; then
    admin_password="${ADMIN_PASSWORD}"
    username="${ADMIN_USERNAME}"
  else
    admin_password="$(openssl rand -base64 24 | tr -d '\n')"
    username="operator"
    echo "No credentials provided; a random password was generated." >&2
  fi
  device_token="$(openssl rand -hex 32)"
  umask 0077
  {
    echo "PF_ADMIN_USERNAME=${username}"
    echo "PF_ADMIN_PASSWORD=${admin_password}"
    echo "PF_DEVICE_HEARTBEAT_TOKEN=${device_token}"
  } > "${environment_file}"
  chown root:pf-web "${environment_file}"
  chmod 0640 "${environment_file}"
  echo "Admin username: ${username}"
  echo "Admin password: ${admin_password}"
  echo "Device heartbeat token saved in ${environment_file}."
fi

bootstrap_release="${deploy_root}/releases/bootstrap-$(date +%s)"
cp -a "${source_root}" "${bootstrap_release}"
chown -R pf-deploy:pf-deploy "${bootstrap_release}"
ln -sfn "${bootstrap_release}" "${deploy_root}/current"

install -m 0644 "${repo_root}/ops/pocket-friend-admin.service" "${service_file}"
printf '%s\n' 'pf-deploy ALL=(root) NOPASSWD: /usr/bin/systemctl restart pocket-friend-admin.service' > "${sudoers_file}"
chmod 0440 "${sudoers_file}"
visudo -cf "${sudoers_file}"

systemctl daemon-reload
systemctl enable --now pocket-friend-admin.service

if command -v ufw >/dev/null 2>&1 && ufw status | grep -q '^Status: active'; then
  ufw allow 4311/tcp
fi

curl --fail --silent --show-error http://127.0.0.1:4311/health >/dev/null
echo "Pocket Friend admin is running on port 4311."