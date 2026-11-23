<p align="center"><img src="https://raw.githubusercontent.com/webship/joomla-steps/2.0.x/assets/logo.svg" alt="Joomla logo" width="96"></p>

# joomla-steps

Cucumber step definitions for testing Joomla sites with
[webship-js](https://webship.co/docs/webship-js/2.0.x), a BDD browser automation
harness built on Playwright and Cucumber-js.

`@webship-js/joomla-steps` covers the front end of a Joomla site (logging in
and out, menus, articles, breadcrumbs, Smart Search, system messages, the 404
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

## From nothing to a green run

What the machine needs: Docker, [DDEV](https://ddev.com), git, curl, unzip,
python3, and Node.js 24 or later with npm. PHP and the database run in DDEV's
containers.

**1. The Joomla site.** The pack's own build script (the one CI runs) installs
Joomla with the "blog" sample data in a DDEV project, builds the Smart Search
index and creates the accounts of [Test users](#test-users); it takes about a
minute. `JOOMLA_LANGUAGES=fr-FR` adds the French language pack the
multilingual lane needs.

```bash
git clone https://github.com/webship/joomla-steps.git
SITE_DIR="$PWD/joomla-site" joomla-steps/.github/scripts/build-ddev-joomla.sh
```

The site answers at `https://joomla-ci.ddev.site` (see
[A test site](#a-test-site) for the other settings of the script). Smart
Search lists content from the minute after it was published: wait a minute
after the build before a search.

In the [Webship Workspace](https://github.com/webship/workspace), its Joomla
plugin builds the site instead, with the same blog sample data and Smart Search
index, in a sites folder of the workspace (`test/` here; `dev/`, `sandboxes/`
and `demos/` work the same):

```bash
bash core/scripts/plugins.sh --require joomla --with-needs
bash core/scripts/plugins.sh --activate joomla --with-needs
bash core/scripts/plugins.sh --install joomla
bash test/cmd-joomla-project.sh mysite --install --add-users --sample-data
```

That site answers at `https://mysite.ddev.site`. Its accounts are the plugin's
(`administrator`, a Super User, `manager`, `editor` and `member`, each with the
password `dD.123123ddd`; step 3 names them). The features of
[`tests/features/`](tests/features/) pass there too, but for seven lines
that name what the script makes: the account `admin`, the display names of its
accounts, its one Super User and its site name.

**2. A test project.**

```bash
mkdir joomla-tests && cd joomla-tests
npm init -y
npm install --save-dev webship-js @webship-js/joomla-steps
npx init-webship-js
```

`npx init-webship-js` writes `cucumber.js`, `playwright.config.ts`, the
`tests/` folders with a first feature and the `npm test` scripts, and installs
Chromium. npm usually runs it already when it installs webship-js; a second
run changes nothing.

**3. `cucumber.js`.** Replace the file with the wiring of the pack: the step
files of webship-js and of the pack, the address of the site, and the accounts
(the JSON of [Test users](#test-users)).

```javascript
module.exports = {
  default: {
    requireModule: ['tsx/cjs'],
    require: [
      'node_modules/webship-js/tests/step-definitions/**/*.js',
      'node_modules/@webship-js/joomla-steps/tests/step-definitions/*.js',
      'tests/step-definitions/**/*.js',
    ],
    paths: ['tests/features/**/*.feature'],
    // The multilingual feature changes every address of the site: a lane of its own, CUCUMBER_TAGS=@multilingual.
    tags: process.env.CUCUMBER_TAGS || 'not @multilingual',
    format: ['@cucumber/pretty-formatter', 'json:tests/reports/cucumber_report.json'],
    worldParameters: {
      launchUrl: process.env.LAUNCH_URL || 'https://joomla-ci.ddev.site',
      // The waits webship-js adds around each page, scenario and step (milliseconds).
      minWaitTime: { page: 3000, before_scenario: 0, after_scenario: 0, before_step: 0, after_step: 0 },
      users: {
        admin: { username: 'admin', password: 'Admin123456789!' },
        manager: { username: 'manager', password: 'Manager123456789!' },
        editor: { username: 'editor', password: 'Editor123456789!' },
        member: { username: 'member', password: 'Member123456789!' },
      },
    },
  },
};
```

On a site from the Webship Workspace (step 1), the accounts are the plugin's:
`admin: { username: 'administrator', password: 'dD.123123ddd' }`, and
`manager`, `editor` and `member` with the same password. Its address goes in
`LAUNCH_URL` (step 5).

**4. A first feature**, `tests/features/first-run.feature`:

```gherkin
Feature: First run
  Scenario: A Super User logs in to the administrator
    Given I am a logged in user with the "admin" user
    Then I should see the administrator dashboard

  Scenario: A visitor reads an article from the home page
    Given I am on the homepage
    When I read more of "Millions"
    Then I should be viewing the "Millions" article
```

**5. Run it.**

```bash
npm test
```

(`LAUNCH_URL=https://mysite.ddev.site npm test` for a site at another address.)
A green first run prints every step, then the summary (the starter feature of
`npx init-webship-js` and the two scenarios above, passed) and the HTML report
it wrote:

```
3 scenarios (3 passed)
7 steps (7 passed)
0m06.000s (executing steps: 0m05.900s)
[webship-js] HTML report → …/tests/reports/cucumber_report.html
```

From there, copy the features of [`tests/features/`](tests/features/) (they
also ship in the package, under
`node_modules/@webship-js/joomla-steps/tests/features/`), with the file
`tests/fixtures/pixel.png` the media feature uploads: together they use every
step of the pack, in both readings where a step reads both ways. The
multilingual feature runs alone, on a site with the French language pack:
`CUCUMBER_TAGS=@multilingual npm test`.

### What the suite tests

The features of this repository run every step of the pack against the
sample-data site, in CI on every change (the multilingual feature as a lane of
its own): logging in to and out of the site and the administrator, refused
logins, the password reset and username reminder pages, a Super User's and a
Manager's dashboard, menu and toolbar, the menus and the mobile menu of the
site, the blog and its articles, breadcrumbs, articles (create, publish,
feature, archive, trash, delete, the editor, the form), categories, menus and
menu items, site modules, the Media Manager, users, groups and access levels,
the Global Configuration, extensions and plugins, caches and global check-in,
Smart Search, the 404 and 403 pages, the generator, a multilingual site with
its language switcher, and an accessibility audit.

Not tested: contacts, banners, news feeds and private messages, workflows,
the template styles and their options, the installation and update of
extensions, user registration and the creation of accounts (the suite never
creates accounts), and e-mail.

## Requirements

- Node.js 24 or later
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
| `tests/step-definitions/joomla.steps.js` | Front end: login and logout of the site, menus, articles, breadcrumbs, named pages, system messages, Smart Search, the 404 page, the generator, modules and the language switcher. |
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

## Test users

The accounts this repository's suite logs in as, exactly as `cucumber.js` lists
them in `worldParameters.users` (the default values; each one can be replaced
through its variable, see the table above).
[`.github/scripts/build-ddev-joomla.sh`](.github/scripts/build-ddev-joomla.sh)
creates them on the local test site, and CI does the same on the runner: the
installer creates `admin` (Super Users), the Joomla command line the three others.
They are placeholder credentials of that throwaway site, not of any real one.

```json
{
  "admin": { "username": "admin", "password": "Admin123456789!" },
  "manager": { "username": "manager", "password": "Manager123456789!" },
  "editor": { "username": "editor", "password": "Editor123456789!" },
  "member": { "username": "member", "password": "Member123456789!" }
}
```

## A test site

[`.github/scripts/build-ddev-joomla.sh`](.github/scripts/build-ddev-joomla.sh)
builds a default Joomla site in a DDEV project, applies the "blog" sample data,
builds the Smart Search index and creates the four accounts. It is what CI runs.

```bash
SITE_DIR=$HOME/joomla-ci .github/scripts/build-ddev-joomla.sh
```

The site answers at `https://joomla-ci.ddev.site`, the address `cucumber.js` uses
when `LAUNCH_URL` is not set. With another `PROJECT_NAME`, set
`LAUNCH_URL=https://<project name>.ddev.site`.

| Variable | Default | Meaning |
| --- | --- | --- |
| `JOOMLA_VERSION` | `6.2.0` | The Joomla release to install. |
| `PHP_VERSION` | `8.3` | The PHP version of the container. |
| `PROJECT_NAME` | `joomla-ci` | The DDEV project name. |
| `SITE_DIR` | a temporary folder | The project folder. |
| `JOOMLA_LANGUAGES` | none | Language packs to install, separated by spaces (`fr-FR` for the multilingual lane). |
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
| `I log in to the site as "<user>" with password "<password>"` | When |
| `I am logged in to the site with the "<handle>" user` | Given |
| `I log out of the site` | When |
| `I should( not) be logged in to the site( as "<user>")` | Then |
| `I should( not) see an invalid login error on the site` | Then |
| `I open the "<name>" menu item` | When |
| `I open the mobile menu` | When |
| `I should( not) see the "<name>" menu item` | Then |
| `I read more of "<title>"` | When |
| `I should( not) be viewing the "<title>" article` | Then |
| `the breadcrumb should show "<path>"` | Then |
| `I am on the (login\|sign-in\|password reset\|username reminder\|profile\|search) page` | Given |
| `I should( not) see the (login\|password reset\|username reminder\|search) form` | Then |
| `I should( not) see a (success\|info\|warning\|error) message( "<text>")` | Then |
| `I should see no system messages` | Then |
| `I search the site for "<term>"` | When |
| `I search the site for a word from the first article` | When |
| `I should( not) see that word in the search results` | Then |
| `I should( not) see "<text>" in the search results` | Then |
| `I should see no search results` | Then |
| `I should see( at least) <n> search results` | Then |
| `I open the search result "<title>"` and `I open the first search result` | When |
| `I should( not) be on the (404\|page not found\|403\|access denied) page` | Then |
| `the page generator should( not) (be\|start with\|contain) "<text>"` | Then |
| `I should( not) see the "<title>" module` | Then |
| `I should( not) see the language switcher` | Then |
| `I switch the site language to "<language>"` | When |

Joomla answers a refused page (403) in three ways, and the 403 step reads all of
them with the response status: the error template of the site, the error
template of the administrator, and an error message inside the normal template
(the article form of the site, for an account that may not create articles).

### Administrator

| Step | Type |
| --- | --- |
| `I log in to the administrator panel as "<user>" with password "<password>"` | When |
| `I am a logged in user with the "<handle>" user` | Given |
| `I am on the administrator login page` | Given |
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
| `the CMS version should( not) (be\|start with) "<version>"` | Then |

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
| `the (article\|category\|menu item\|module\|menu\|content language) "<title>" is removed` | Given |
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
A state action on an item that is already in that state (enable a plugin that is
enabled, publish an article that is published) does nothing.
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

## Multilingual sites

`I should( not) see the language switcher` and `I switch the site language to
"<language>"` work on the Language Switcher module, whether it shows names, flags
or a dropdown (the step opens the dropdown first). [`tests/features/multilingual.feature`](tests/features/multilingual.feature)
turns a default site into a multilingual one (the Language Filter plugin, a second
content language, a home page for each language, the switcher module), switches
between English and French, and puts the site back. A multilingual site changes
every address of the front end, so the feature is a lane of its own:

```bash
CUCUMBER_TAGS=@multilingual npx cucumber-js
```

It needs the French language pack: `JOOMLA_LANGUAGES=fr-FR` when the build script
makes the site, or Administrator, System, Install, Languages.

## Accessibility

webship-js ships the axe-core steps (`the page should have no critical
accessibility violations`, `the page should pass the full accessibility check`).
[`tests/features/accessibility.feature`](tests/features/accessibility.feature)
runs them on the front page, an article, the login page, the 404 page and three
administrator pages. It pins what holds on Cassiopeia 6: no critical or serious
violation, and states the two findings the template carries (two `h1` headings on
the front page and none on the login page) instead of hiding them.

## Running the tests in this repository

Build the test site (see [A test site](#a-test-site)) and run the suite. Without
`LAUNCH_URL` the suite runs against that local site, `https://joomla-ci.ddev.site`;
CI builds the same site and runs the same commands (see
[`.github/workflows/test.yml`](.github/workflows/test.yml)).

```bash
npm install
SITE_DIR=$HOME/joomla-ci .github/scripts/build-ddev-joomla.sh
npx cucumber-js
```

To run against another Joomla site with the "blog" sample content and the four
accounts, set `LAUNCH_URL=https://your-joomla-site.example`. The suite logs in
with the accounts of the registry and changes content: point it only at a site
that is yours to test.

`npm run test:examples` checks that every `Example #n:` line in the step JSDoc
matches its own step (and no webship-js core step) and that every feature step is
defined exactly once. `npm run test:paths` checks that a feature or a scenario
named on the command line runs alone. CI runs both before the suite.

### Lanes, subsets and the settings webship-js reads

- `npx cucumber-js tests/features/blog.feature` runs one feature and
  `npx cucumber-js tests/features/blog.feature:<line>` one scenario (the line of
  its `Scenario:`); the paths of `cucumber.js` are left out when the command line
  names any.
- `FEATURES=tests/features/a.feature,tests/features/b.feature npm test` runs a
  subset of the feature files; `CUCUMBER_TAGS=@critical npm test` runs a tag lane
  (the default run leaves `@wip` and `@multilingual` out).
- `cucumber.js` carries the `video` block (`WEBSHIP_VIDEO=on-failure` records the
  browser) and the `javascript` block (`WEBSHIP_JS_ERROR_MODE=fail` fails a
  scenario on a JavaScript error; `@js-off` silences one scenario) that webship-js
  reads.
- The step timeout is the one of webship-js (45 seconds, set when it loads);
  `WEBSHIP_STEP_TIMEOUT=<milliseconds>` changes it. A `timeout` key in
  `cucumber.js` is ignored.

## License

MIT. See [LICENSE](LICENSE).

## Logo

The Joomla logo in this README comes from Simple Icons 16.37.0 (CC0-1.0), filled with the colour the set lists for the brand. The Joomla name and logo are trademarks of their owner; this pack is not affiliated with or endorsed by them.
