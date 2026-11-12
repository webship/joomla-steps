# joomla-steps

Cucumber step definitions for testing Joomla sites with
[webship-js](https://webship.co/docs/webship-js/2.0.x), a BDD browser automation
harness built on Playwright and Cucumber-js.

`@webship-js/joomla-steps` covers the front end of a Joomla site (menus,
articles, breadcrumbs, Smart Search, logging in and out, system messages, the 404
page) and the administrator control panel (login by account handle, the
dashboard, the Atum sidebar menu, the toolbar, article, category, menu item and
module lifecycles, the Media Manager, users, groups and access levels, the
Global Configuration, extensions and plugins, cache and global check-in). The
steps are written against the markup of Joomla 5 and 6 with the Cassiopeia and
Atum templates.

CI builds a real Joomla site with [DDEV](https://ddev.com) and runs the whole
suite against it on every push and pull request; see
[`.github/workflows/test.yml`](.github/workflows/test.yml).

> Published to [npmjs.com](https://www.npmjs.com/package/@webship-js/joomla-steps)
> as `@webship-js/joomla-steps`.

## Requirements

- Node.js 20 or later
- A webship-js 2.0 test project
- A Joomla 5 or 6 site to test, with the Cassiopeia (site) and Atum
  (administrator) templates

## Install

```bash
npm install --save-dev @webship-js/joomla-steps
```

## Quick start

1. Add the step files to the `require` list of your webship-js `cucumber.js`:

   ```javascript
   require: [
     'node_modules/webship-js/tests/step-definitions/**/*.js',
     'node_modules/@webship-js/joomla-steps/tests/step-definitions/*.js',
     'tests/step-definitions/**/*.js',
   ],
   ```

2. Point `launchUrl` at the site and name the accounts the suite logs in with
   (see [Accounts](#accounts)):

   ```javascript
   worldParameters: {
     launchUrl: process.env.LAUNCH_URL || 'https://your-joomla-site.example',
     users: {
       admin: { username: 'admin', password: process.env.JOOMLA_ADMIN_PASSWORD },
     },
   },
   ```

3. Copy a feature file from [`tests/features/`](tests/features/) into your
   project and adjust the titles, menu items and search terms to the content of
   your site.

4. Run the suite:

   ```bash
   npx cucumber-js
   ```

## What is included

| Path | Purpose |
| --- | --- |
| `tests/step-definitions/joomla.steps.js` | Front end: menus, articles, breadcrumbs, named pages, login and logout of the site, system messages, Smart Search, the 404 page, the generator, modules and the language switcher. |
| `tests/step-definitions/joomla-admin.steps.js` | Administrator: login and logout, the session, named pages, the page title, the sidebar menu, the toolbar, the Dashboard and the Joomla version. |
| `tests/step-definitions/joomla-content.steps.js` | Administrator content: list views, the lifecycle of articles, categories, menus, menu items and modules, the form controls (editor, fancy selects, switchers, tabs, fields) and the Media Manager. |
| `tests/step-definitions/joomla-system.steps.js` | Administrator system: users, groups and access levels, cache and global check-in. |
| `tests/step-definitions/joomla-helpers.js` | Shared plumbing. It registers no step. |
| `tests/features/*.feature` | Reference features for a default Joomla site with the "blog" sample data. |
| `.github/scripts/build-ddev-joomla.sh` | Builds a Joomla site with DDEV, the sample data and the test accounts. |

The reference features use the titles, menu items and paths of the Joomla "blog"
sample data ("Welcome to Joomla on Cassiopeia!", the "Blog" and "Help" menu
items, the category "Blog"). That is intended for a sample-data site: when you
copy a feature, replace those values with the content of your site. The steps
carry no site data: every title, label and search term is a parameter.

A site without sample content has no menus, featured articles or Smart Search
module, so the front end features need the sample data (Administrator, System,
Sample Data) or content of your own.

## Accounts

Feature files never carry a credential. The `users` registry of `cucumber.js`
maps a handle to an account, and the steps take the handle:

```gherkin
Given I am a logged in user with the "admin" user
Given I am logged in to the site with the "member" user
```

The accounts are configuration, not test data. They are created once, with the
Joomla command line, and a feature never creates or deletes a user:

```bash
php cli/joomla.php user:add --username=editor --name="Test Editor" \
  --password='Editor123456789!' --email=editor@example.com --usergroup=Editor
```

`cucumber.js` defines four handles. Each can be replaced from the environment.

| Handle | Group | Logs in to | Variables |
| --- | --- | --- | --- |
| `admin` | Super Users | the administrator | `JOOMLA_ADMIN_USER`, `JOOMLA_ADMIN_PASSWORD` |
| `manager` | Manager | the administrator, with fewer rights | `JOOMLA_MANAGER_USER`, `JOOMLA_MANAGER_PASSWORD` |
| `editor` | Editor | the site only | `JOOMLA_EDITOR_USER`, `JOOMLA_EDITOR_PASSWORD` |
| `member` | Registered | the site only | `JOOMLA_MEMBER_USER`, `JOOMLA_MEMBER_PASSWORD` |

The site and the administrator keep separate sessions in Joomla: an account that
is logged in to the administrator is not logged in to the site. Joomla rejects
passwords shorter than 12 characters.

## A test site

[`.github/scripts/build-ddev-joomla.sh`](.github/scripts/build-ddev-joomla.sh)
builds a default Joomla site in a DDEV project, applies the "blog" sample data,
builds the Smart Search index and creates the four accounts. It is what CI runs.

```bash
SITE_DIR=$HOME/joomla-test PROJECT_NAME=joomla-test .github/scripts/build-ddev-joomla.sh
```

| Variable | Default | Meaning |
| --- | --- | --- |
| `JOOMLA_VERSION` | `6.2.0` | The Joomla release to install. |
| `PHP_VERSION` | `8.3` | The PHP version of the container. |
| `PROJECT_NAME` | `joomla-ci` | The DDEV project name. |
| `SITE_DIR` | a temporary folder | The project folder. |
| `ADMIN_USER`, `ADMIN_PASSWORD`, and the same for `EDITOR_`, `MANAGER_` and `MEMBER_` | see the script | The accounts. |

## Steps

Every Then step reads both polarities from one phrase (`should` or `should not`).
Every When and Then step takes `I`, `we` or no pronoun. Every failure is a
message with a hint, not a Playwright stack. Assertions wait on their locator for
the `minWaitTime.page` budget (at least 10 seconds).

The JSDoc block above each step in the files of
[`tests/step-definitions/`](tests/step-definitions/) holds its regular
expression and at least five Gherkin examples. This is the summary.

### Front end

| Step | Type |
| --- | --- |
| `I open the "<name>" menu item` | When |
| `I open the mobile menu` | When |
| `I should( not) see the "<name>" menu item` | Then |
| `I read more of "<title>"` | When |
| `I should( not) be viewing the "<title>" article` | Then |
| `the breadcrumb should show "<path>"` | Then |
| `I am on the (login\|sign-in\|password reset\|username reminder\|profile\|search) page` | Given |
| `I should( not) see the (login\|password reset\|username reminder\|search) form` | Then |
| `I log in to the site as "<user>" with password "<password>"` | When |
| `I am logged in to the site with the "<handle>" user` | Given |
| `I log out of the site` | When |
| `I should( not) be logged in to the site( as "<user>")` | Then |
| `I should( not) see an invalid login error on the site` | Then |
| `I should( not) see a (success\|info\|warning\|error) message( "<text>")` | Then |
| `I should see no system messages` | Then |
| `I search the site for "<term>"` | When |
| `I search the site for a word from the first article` | When |
| `I should( not) see that word in the search results` | Then |
| `I should( not) see "<text>" in the search results` | Then |
| `I should see no search results` | Then |
| `I should see( at least) <n> search results` | Then |
| `I open the search result "<title>"` and `I open the first search result` | When |
| `I should( not) be on the (404\|403) page` | Then |
| `the site should( not) be running Joomla` | Then |
| `I should( not) see the "<title>" module` | Then |
| `I should( not) see the language switcher` | Then |

### Administrator

| Step | Type |
| --- | --- |
| `I am on the administrator login page` | Given |
| `I log in to the administrator panel as "<user>" with password "<password>"` | When |
| `I am a logged in user with the "<handle>" user` | Given |
| `I am not logged in` | Given |
| `I log out of the administrator panel` | When |
| `I should( not) see the administrator dashboard` | Then |
| `I should( not) see an invalid login error in the administrator panel` | Then |
| `I should( not) be on the administrator login page` | Then |
| `I should( not) be logged in to the administrator panel( as "<name>")` | Then |
| `I am on the administrator "<page>" page` | Given |
| `I should( not) be on the administrator "<page>" page` | Then |
| `I should( not) see the administrator page title "<text>"` | Then |
| `I should( not) see the administrator menu` | Then |
| `I open the administrator menu item "<path>"` | When |
| `I should( not) see the administrator menu item "<path>"` | Then |
| `I click the "<button>" toolbar button` | When |
| `I should( not) see the "<button>" toolbar button` | Then |
| `I should( not) see the "<title>" dashboard module` | Then |
| `the Joomla version should( not) (be\|start with) "<version>"` | Then |

The named pages are: dashboard, articles, featured articles, categories, media,
site modules, administrator modules, menus, menu items, users, groups, access
levels, extensions, plugins, site templates, installed languages, content
languages, global configuration, system information, clear cache, global
check-in, smart search index, tags, banners, contacts, redirects, user actions
log and messages. A query string such as `option=com_tags&view=tags` works too.

### Lists and content

| Step | Type |
| --- | --- |
| `I search the list for "<text>"` | When |
| `I filter the list by "<filter>" with "<option>"` | When |
| `I select the row "<title>"` and `I select all rows` | When |
| `I should( not) see the row "<title>" in the list` | Then |
| `I should( not) see an empty list` | Then |
| `I (publish\|unpublish\|archive\|trash\|feature\|unfeature\|check in\|enable\|disable\|activate\|block\|unblock) the (article\|category\|menu item\|module\|plugin\|extension\|user) "<title>"` | When |
| `I delete the (article\|category\|menu item\|module) "<title>" permanently` | When |
| `I open the (article\|category\|menu item\|module\|plugin\|extension\|user) "<title>" for editing` | When |
| `the (article\|category\|...) "<title>" should( not) exist` | Then |
| `the (article\|category\|...) "<title>" should( not) be (published\|unpublished\|archived\|trashed\|featured\|unfeatured\|enabled\|disabled\|blocked\|checked out)` | Then |
| `the (article\|category\|menu item\|module\|menu) "<title>" is removed` | Given |
| `I create (an\|a featured\|an unpublished) article titled "<title>"( in the "<category>" category)( with the text "<text>")` | When |
| `I create a category titled "<title>"` | When |
| `I create a menu titled "<title>"` and `I delete the menu "<title>"` | When |
| `I create a menu item titled "<title>" in the "<menu>" menu of the type "<group > type>"` | When |
| `I create a "<type>" site module titled "<title>"( with the text "<text>")( in the "<position>" position)` | When |
| `I fill in the rich text editor( field "<field>") with "<html>"` | When |
| `the rich text editor( field "<field>") should( not) contain "<text>"` | Then |
| `I choose "<option>" in the "<label>" field` | When |
| `I switch "<label>" to "<option>"` | When |
| `I set the field labelled "<label>" to "<value>"` | When |
| `the field labelled "<label>" should( not) have the value "<value>"` | Then |
| `I open the "<tab>" tab` | When |
| `I upload the file "<path>" to the media manager` | When |
| `I should( not) see the media file "<name>"` | Then |
| `I delete the media file "<name>"` | When |

The steps that name an item ("the article "Welcome"") open the list of that kind,
filtered by the title and showing every state, so they do not depend on the page
the scenario was on or on the filters a previous session left in the list state.
"Is removed" trashes and deletes the item when it exists and does nothing when it
does not: put it at the top of a scenario that creates the item, so the scenario
runs again after a failed run.

### System

| Step | Type |
| --- | --- |
| `the user "<username>" should( not) be in the "<group>" group` | Then |
| `the access level "<level>" should( not) include the "<group>" group` | Then |
| `the group "<group>" should have <n> enabled users` | Then |
| `I clear all caches` | When |
| `I clear the expired cache` | When |
| `I check in all items` | When |
| `there should( not) be checked out items` | Then |

Joomla's Global Configuration is a form: read it with `the field labelled "Site
Name" should have the value "..."` and change it with `I set the field labelled
"Site Name" to "..."`, then save with `I click the "Save" toolbar button`.

## Accessibility

webship-js ships the axe-core steps (`the page should have no critical
accessibility violations`, `the page should pass the full accessibility check`).
[`tests/features/accessibility.feature`](tests/features/accessibility.feature)
runs them on the front page, an article, the login page, the 404 page and three
administrator pages. It pins what holds on Cassiopeia 6: no critical or serious
violation, and states the two findings the template carries (two `h1` headings on
the front page and none on the login page) instead of hiding them.

## Running the tests in this repository

Point `LAUNCH_URL` at a Joomla site with the "blog" sample content and the four
accounts (CI builds one from scratch with DDEV; see
[`.github/workflows/test.yml`](.github/workflows/test.yml)):

```bash
npm install
LAUNCH_URL=https://your-joomla-site.example npx cucumber-js
```

`npm run test:examples` checks that every `Example #n:` line in the step JSDoc
matches its own step (and no webship-js core step) and that every feature step is
defined exactly once. CI runs it before the suite.

### Lanes, subsets and the settings webship-js reads

- `FEATURES=tests/features/a.feature,tests/features/b.feature npm test` runs a
  subset of the feature files; `CUCUMBER_TAGS=@critical npm test` runs a tag lane
  (the default run leaves `@wip` out).
- `cucumber.js` carries the `video` block (`WEBSHIP_VIDEO=on-failure` records the
  browser) and the `javascript` block (`WEBSHIP_JS_ERROR_MODE=fail` fails a
  scenario on a JavaScript error; `@js-off` silences one scenario) that webship-js
  reads.
- The step timeout is the one of webship-js (45 seconds, set when it loads);
  `WEBSHIP_STEP_TIMEOUT=<milliseconds>` changes it. A `timeout` key in
  `cucumber.js` is ignored.

## License

MIT. See [LICENSE](LICENSE).
