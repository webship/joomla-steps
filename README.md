# joomla-steps

Cucumber step definitions for testing Joomla sites with
[webship-js](https://webship.co/docs/webship-js/2.0.x) — a BDD browser
automation harness built on Playwright + Cucumber-js.

`@webship-js/joomla-steps` adds a `joomla.steps.js` step file plus example `.feature`
files that cover the main pages of a typical Joomla install with its
default ("blog") sample content: the home page, the blog listing,
individual articles, menu / category navigation, and the Smart Search
(`com_finder`) component. CI builds a fresh default Joomla site with
[DDEV](https://ddev.com) and runs the suite against it on every
push/PR — see [`.github/workflows/test.yml`](.github/workflows/test.yml).

> Published to [npmjs.com](https://www.npmjs.com/package/@webship-js/joomla-steps)
> as `@webship-js/joomla-steps`.

## Requirements

- Node.js >= 20
- A webship-js 2.0 test project

## Install

```bash
npm install --save-dev @webship-js/joomla-steps
```

## Quick start

1. Add `@webship-js/joomla-steps`'s step files to your webship-js `cucumber.js`
   `require` array:

   ```javascript
   require: [
     'node_modules/webship-js/tests/step-definitions/**/*.js',
     'node_modules/@webship-js/joomla-steps/tests/step-definitions/*.js',
     'tests/step-definitions/**/*.js',
   ],
   ```

2. Point `launchUrl` at your Joomla site:

   ```javascript
   worldParameters: {
     launchUrl: process.env.LAUNCH_URL || 'https://your-joomla-site.example',
   },
   ```

3. Copy a feature file from this repo's
   [`tests/features/`](tests/features/) into your project's
   `tests/features/` directory and adjust the menu items / article
   titles / search terms to match your site's content.

4. Run the suite:

   ```bash
   npx cucumber-js
   ```

## What's included

| Path | Purpose |
| --- | --- |
| `tests/step-definitions/joomla.steps.js` | Front-office Cucumber steps (menu navigation, mobile menu, "read more" teasers, article headings, breadcrumbs, Smart Search). |
| `tests/step-definitions/joomla-admin.steps.js` | `/administrator` control panel steps (log in as a registry user or with explicit credentials, not logged in, log out, invalid-credentials error, dashboard/login-page assertions). |
| `tests/features/*.feature` | Reference feature files exercising the steps against a default Joomla install with sample content, desktop + mobile. |
| `.github/workflows/test.yml` | CI: builds a default Joomla site with DDEV, then runs a dry-run + full suite against it on every push/PR. |

The reference features assert the titles, menu items and paths of Joomla's
"blog" sample data ("Welcome to Joomla on Cassiopeia!", the "Blog" and "Help"
menu items, `/sample-layouts/category-list`, ...). That is deliberate for a
sample-data install; when you copy a feature to your own project, swap those
values for your site's content. The steps themselves carry no site data: every
title, menu label and search term is a capture group.

Sample content (menus, featured articles, the Smart Search module) is not
part of a stock Joomla install — it comes from applying the "blog" sample
data set as the Super User after installation, either through
Admin ▸ System ▸ Site ▸ Sample Data, or non-interactively via the
`com_ajax&group=sampledata&type=blog` endpoints (see
[`.github/scripts/build-ddev-joomla.sh`](.github/scripts/build-ddev-joomla.sh)
for a scripted example). Without it, the front-office features in this repo
will fail against an empty homepage.

`tests/features/administrator.feature` logs in through the `users` registry
in `cucumber.js` (`worldParameters.users.admin`), which defaults to `admin` /
`Admin123456789!`, the Super User `build-ddev-joomla.sh` provisions
(Joomla's installer rejects passwords under 12 characters, so a plain
"admin" won't install). Point `LAUNCH_URL` at a different site and set
`JOOMLA_ADMIN_USER` / `JOOMLA_ADMIN_PASSWORD` to that site's Super User
credentials; no password needs to live in a feature file.

## Step catalogue (summary)

| Step | Type |
| --- | --- |
| `I open the "<name>" menu item` | When |
| `I open the mobile menu` | When |
| `I should( not) see the "<name>" menu item` | Then |
| `I read more of "<title>"` | When |
| `I should( not) be viewing the "<title>" article` | Then |
| `the breadcrumb should show "<path>"` | Then |
| `I search the site for "<term>"` | When |
| `I search the site for a word from the first article` | When |
| `I should( not) see that word in the search results` | Then |
| `I should see no search results` | Then |
| `I should( not) see "<text>" in the search results` | Then |
| `I am on the administrator login page` | Given |
| `I am a logged in user with the "<key>" user` | Given |
| `I am not logged in` | Given |
| `I log in to the administrator panel as "<user>" with password "<pass>"` | When |
| `I log out of the administrator panel` | When |
| `I should( not) see the administrator dashboard` | Then |
| `I should( not) see an invalid login error in the administrator panel` | Then |
| `I should( not) be on the administrator login page` | Then |

Every Then step takes `should` or `should not`, every When/Then step takes
`I`, `we` or no pronoun, and every failure is a friendly message with a hint
(no Playwright stack). Assertions wait on their locator for the
`minWaitTime.page` budget (at least 10 s) instead of reading the page once.

Full details, regex patterns, and Gherkin examples for every step are in
the JSDoc block above each step in
[`tests/step-definitions/joomla.steps.js`](tests/step-definitions/joomla.steps.js) and
[`tests/step-definitions/joomla-admin.steps.js`](tests/step-definitions/joomla-admin.steps.js).

## Running the tests in this repo

Point `LAUNCH_URL` at any Joomla site running the default "blog" sample
content (CI builds one from scratch with DDEV — see
[`.github/workflows/test.yml`](.github/workflows/test.yml)):

```bash
npm install
LAUNCH_URL=https://your-joomla-site.example npx cucumber-js
```

`npm run test:examples` checks that every `Example #n:` line in the step
JSDoc matches its own step (and no webship-js core step) and that every
feature step is defined exactly once; CI runs it before the suite.

## License

MIT — see [LICENSE](LICENSE).

### Lanes, subsets and the settings webship-js reads

- `FEATURES=tests/features/a.feature,tests/features/b.feature npm test` runs a subset of the feature files; `CUCUMBER_TAGS=@critical npm test` runs a tag lane (the default run leaves `@wip` out).
- `cucumber.js` carries the `video` block (`WEBSHIP_VIDEO=on-failure` records the browser) and the `javascript` block (`WEBSHIP_JS_ERROR_MODE=fail` fails a scenario on a JavaScript error; `@js-off` silences one scenario) that webship-js reads.
- The step timeout is webship-js's own (45 seconds, set when it loads); `WEBSHIP_STEP_TIMEOUT=<milliseconds>` changes it, a `timeout` key in `cucumber.js` does not.
