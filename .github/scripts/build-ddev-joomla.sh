#!/usr/bin/env bash
# Builds a fresh default Joomla site (Cassiopeia front end, Atum administrator,
# the "blog" sample content) inside a DDEV project, non-interactively, creates
# the test accounts with the Joomla CLI, and exports LAUNCH_URL for the test job.
#
# Settings (environment variables, all optional):
#   JOOMLA_VERSION   the release to install            (default 6.2.0)
#   PHP_VERSION      the PHP version of the container  (default 8.3; Joomla 5 runs on 8.1 or later)
#   PROJECT_NAME     the DDEV project name             (default joomla-ci)
#   SITE_DIR         the project folder                (default a new temporary folder)
#   ADMIN_USER, ADMIN_PASSWORD   the Super User        (default admin / Admin123456789!)
#   EDITOR_USER, EDITOR_PASSWORD     an Editor account (default editor / Editor123456789!)
#   MANAGER_USER, MANAGER_PASSWORD   a Manager account (default manager / Manager123456789!)
#   MEMBER_USER, MEMBER_PASSWORD     a Registered account (default member / Member123456789!)
# The accounts are configuration: they are created once here and named in
# cucumber.js; the features never create or delete users.
set -euo pipefail

JOOMLA_VERSION="${JOOMLA_VERSION:-6.2.0}"
PHP_VERSION="${PHP_VERSION:-8.3}"
PROJECT_NAME="${PROJECT_NAME:-joomla-ci}"
ADMIN_USER="${ADMIN_USER:-admin}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-Admin123456789!}"
EDITOR_USER="${EDITOR_USER:-editor}"
EDITOR_PASSWORD="${EDITOR_PASSWORD:-Editor123456789!}"
MANAGER_USER="${MANAGER_USER:-manager}"
MANAGER_PASSWORD="${MANAGER_PASSWORD:-Manager123456789!}"
MEMBER_USER="${MEMBER_USER:-member}"
MEMBER_PASSWORD="${MEMBER_PASSWORD:-Member123456789!}"
JOOMLA_ZIP_URL="https://github.com/joomla/joomla-cms/releases/download/${JOOMLA_VERSION}/Joomla_${JOOMLA_VERSION}-Stable-Full_Package.zip"

SITE_DIR="${SITE_DIR:-$(mktemp -d)}"
mkdir -p "$SITE_DIR/public"
cd "$SITE_DIR"

ddev config --project-type=php --project-name="$PROJECT_NAME" --docroot=public \
  --php-version="$PHP_VERSION" --webserver-type=nginx-fpm
ddev start

curl -sL -o joomla.zip "$JOOMLA_ZIP_URL"
unzip -q joomla.zip -d public
rm -f joomla.zip

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

# The administrator asks every new site to share anonymous statistics with a
# notice on each page. A test site answers "never" once, so the notice does not
# sit among the system messages the suite asserts.
ddev mysql -e "UPDATE jos_extensions SET params='{\"mode\":3}' WHERE element='stats' AND folder='system'"

# Sample data seeds the articles but leaves the Smart Search index empty, so
# com_finder returns "No Results Found" for everything until it is built.
ddev exec "php public/cli/joomla.php finder:index --no-interaction"

# The test accounts, one per access level the suite uses. The Super User was
# created by the installer above.
for ACCOUNT in "$EDITOR_USER:$EDITOR_PASSWORD:Editor" "$MANAGER_USER:$MANAGER_PASSWORD:Manager" "$MEMBER_USER:$MEMBER_PASSWORD:Registered"; do
  IFS=: read -r ACCOUNT_USER ACCOUNT_PASSWORD ACCOUNT_GROUP <<< "$ACCOUNT"
  ddev exec php public/cli/joomla.php user:add --no-interaction \
    --username="$ACCOUNT_USER" --name="Test $ACCOUNT_GROUP" --password="$ACCOUNT_PASSWORD" \
    --email="$ACCOUNT_USER@example.com" --usergroup="$ACCOUNT_GROUP"
done

if [ -n "${GITHUB_ENV:-}" ]; then
  echo "LAUNCH_URL=$SITE_URL" >> "$GITHUB_ENV"
fi
echo "Built Joomla $JOOMLA_VERSION at $SITE_URL"
