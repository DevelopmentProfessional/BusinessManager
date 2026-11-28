#!/bin/bash
set -euo pipefail

PARAMETER_PREFIX="${BUSINESSMANAGER_PARAMETER_PREFIX:-/businessmanager/production}"
AWS_REGION="${AWS_REGION:-us-east-1}"
BACKEND_ENV_FILE="/opt/businessmanager/backend/.security.env"
CLIENT_ENV_FILE="/opt/businessmanager/client-api/.security.env"

get_parameter() {
	local name="$1"
	aws ssm get-parameter \
		--region "$AWS_REGION" \
		--name "$PARAMETER_PREFIX/$name" \
		--with-decryption \
		--query 'Parameter.Value' \
		--output text
}

write_environment_file() {
	local file="$1"
	local admin_bootstrap_token="$2"
	local admin_bootstrap_password="$3"
	local onlyoffice_callback_secret="$4"
	local onlyoffice_allowed_hosts="$5"
	local public_portal_company_ids="$6"
	local payment_data_encryption_key="$7"

	umask 077
	cat > "$file" <<EOF
ADMIN_BOOTSTRAP_TOKEN=$admin_bootstrap_token
ADMIN_BOOTSTRAP_PASSWORD=$admin_bootstrap_password
ONLYOFFICE_CALLBACK_SECRET=$onlyoffice_callback_secret
ONLYOFFICE_ALLOWED_HOSTS=$onlyoffice_allowed_hosts
PUBLIC_PORTAL_COMPANY_IDS=$public_portal_company_ids
PAYMENT_DATA_ENCRYPTION_KEY=$payment_data_encryption_key
EOF
	chown root:root "$file"
	chmod 600 "$file"
}

ADMIN_BOOTSTRAP_TOKEN="$(get_parameter ADMIN_BOOTSTRAP_TOKEN)"
ADMIN_BOOTSTRAP_PASSWORD="$(get_parameter ADMIN_BOOTSTRAP_PASSWORD)"
ONLYOFFICE_CALLBACK_SECRET="$(get_parameter ONLYOFFICE_CALLBACK_SECRET)"
ONLYOFFICE_ALLOWED_HOSTS="$(get_parameter ONLYOFFICE_ALLOWED_HOSTS)"
PUBLIC_PORTAL_COMPANY_IDS="$(get_parameter PUBLIC_PORTAL_COMPANY_IDS)"
PAYMENT_DATA_ENCRYPTION_KEY="$(get_parameter PAYMENT_DATA_ENCRYPTION_KEY)"

write_environment_file "$BACKEND_ENV_FILE" \
	"$ADMIN_BOOTSTRAP_TOKEN" "$ADMIN_BOOTSTRAP_PASSWORD" \
	"$ONLYOFFICE_CALLBACK_SECRET" "$ONLYOFFICE_ALLOWED_HOSTS" \
	"$PUBLIC_PORTAL_COMPANY_IDS" "$PAYMENT_DATA_ENCRYPTION_KEY"
write_environment_file "$CLIENT_ENV_FILE" \
	"$ADMIN_BOOTSTRAP_TOKEN" "$ADMIN_BOOTSTRAP_PASSWORD" \
	"$ONLYOFFICE_CALLBACK_SECRET" "$ONLYOFFICE_ALLOWED_HOSTS" \
	"$PUBLIC_PORTAL_COMPANY_IDS" "$PAYMENT_DATA_ENCRYPTION_KEY"

echo "Security environment files configured from AWS Systems Manager."
