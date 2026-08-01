#!/usr/bin/env bash
# Builds a fresh default Joomla 5 site (with the "blog" sample content) inside
# a DDEV project, non-interactively, and exports LAUNCH_URL for the test job.
set -euo pipefail

PROJECT_NAME="joomla-ci"
ADMIN_USER="admin"
ADMIN_PASSWORD="Admin123456789!"
JOOMLA_ZIP_URL="https://downloads.joomla.org/us/cms/joomla5/5-2-2/Joomla_5-2-2-Stable-Full_Package.zip"

SITE_DIR="$(mktemp -d)"
cd "$SITE_DIR"
mkdir -p public

ddev config --project-type=php --project-name="$PROJECT_NAME" --docroot=public \
  --php-version=8.1 --webserver-type=nginx-fpm
ddev start

curl -sL -o joomla.zip "$JOOMLA_ZIP_URL"
unzip -q joomla.zip -d public

ddev exec "php public/installation/joomla.php install \
  --site-name=\"Joomla CI\" --admin-user=\"Super User\" --admin-username=\"$ADMIN_USER\" \
  --admin-password=\"$ADMIN_PASSWORD\" --admin-email=\"admin@example.com\" \
  --db-type=\"mysqli\" --db-host=\"db\" --db-user=\"db\" --db-pass=\"db\" --db-name=\"db\" --db-prefix=\"jos_\" -n"

SITE_URL="$(ddev describe -j | python3 -c "import json,sys; print(json.load(sys.stdin)['raw']['primary_url'])")"
COOKIEJAR="$(mktemp)"

# Sample data is only exposed through the admin UI's AJAX endpoints, so we
# log in and drive it the same way the browser would: extract the login
# form's CSRF field, log in, then fetch a *fresh* CSRF token from an
# authenticated page — the login-page token is stale by the time sample
# data steps fire and gets silently ignored (steps report success but do
# nothing).
LOGIN_TOKEN="$(curl -sL -c "$COOKIEJAR" "$SITE_URL/administrator/index.php" \
  | grep -oP '(?<=name=")[a-f0-9]{32}(?=" value="1")' | head -1)"

curl -sL -o /dev/null -b "$COOKIEJAR" -c "$COOKIEJAR" "$SITE_URL/administrator/index.php" \
  --data-urlencode "username=$ADMIN_USER" --data-urlencode "passwd=$ADMIN_PASSWORD" \
  --data-urlencode "option=com_login" --data-urlencode "task=login" \
  --data-urlencode "return=aW5kZXgucGhw" --data-urlencode "${LOGIN_TOKEN}=1"

TOKEN="$(curl -sL -b "$COOKIEJAR" -c "$COOKIEJAR" "$SITE_URL/administrator/index.php" \
  | grep -oP '(?<=csrf.token":")[a-f0-9]{32}' | head -1)"

# Steps must run in order: 2 (Menus) creates the menu type that 3 (Modules)
# attaches the frontend nav module to.
for STEP in 1 2 3 4; do
  curl -sL -b "$COOKIEJAR" -c "$COOKIEJAR" -o /dev/null \
    "$SITE_URL/administrator/index.php?option=com_ajax&group=sampledata&type=blog&plugin=SampledataApplyStep${STEP}&format=json&${TOKEN}=1"
done

# Sample data seeds the articles but leaves the Smart Search index empty, so
# com_finder returns "No Results Found" for everything until it is built.
ddev exec "php public/cli/joomla.php finder:index --no-interaction"

echo "LAUNCH_URL=$SITE_URL" >> "$GITHUB_ENV"
echo "Built Joomla site at $SITE_URL"
