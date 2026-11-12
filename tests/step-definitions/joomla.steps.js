'use strict';

// Joomla front end (site) step definitions: the main menu (including the
// collapsed mobile menu), articles and breadcrumbs, the Smart Search component
// (com_finder), logging in and out of the site with the users registry, the
// system messages, the 404 page and the language switcher.
//
// The administrator control panel has its own step files: joomla-admin.steps.js
// (login, dashboard, menu, toolbar), joomla-content.steps.js (articles,
// categories, menus, modules, media) and joomla-system.steps.js (users, access
// levels, configuration, extensions, cache, check-in).
//
// Steps that webship-js already covers with its generic click, fill and see
// vocabulary are not duplicated here; see "Rules for a new step" in README.md of
// this folder.
//
// Every assertion waits on its locator (the assertion is the wait), and every
// failure is a friendly error with a hint instead of a raw Playwright timeout
// stack.

const { Given, When, Then } = require('@cucumber/cucumber');
const { smartSettle, friendly } = require('webship-js/tests/step-definitions/webship');
const {
  budget,
  supplied,
  literal,
  exactly,
  siteUrl,
  open,
  actOrExplain,
  assertPresence,
  resolveUser,
  alerts,
} = require('./joomla-helpers');

const MENU_HINT = 'The menu or template may have changed; check the visible text of the main menu (`.mod-menu`).';

/**
 * The link of the menu modules (`.mod-menu`) with the given text. The exact
 * text wins; a link that only contains the text is the fallback, so "Blog" finds
 * the "Blog" link before "Blog archive".
 *
 * @param {object} world
 * @param {string} name
 * @returns {Promise<import('playwright').Locator>}
 */
async function menuLink(world, name) {
  const loose = world.page.locator('.mod-menu a', { hasText: name });
  const exact = world.page.locator('.mod-menu a').filter({ hasText: exactly(name) });
  await loose.first().waitFor({ state: 'attached', timeout: budget(world) }).catch(() => {});
  return (await exact.count()) ? exact.first() : loose.first();
}

// ---------------------------------------------------------------------------
// Main menu navigation
// ---------------------------------------------------------------------------

/**
 * Click a top-level or nested link inside the Joomla menu modules
 * (`.mod-menu`), by its visible text. Works for the desktop menu and for the
 * mobile menu once it is open.
 *
 * Example #1: When I open the "Blog" menu item
 * Example #2: When I open the "Help" menu item
 * Example #3: When we open the "About your home page" menu item
 * Example #4: And I open the "Typography" menu item
 * Example #5: When open the "Home" menu item
 *
 */
When(/^(I |we )*open the "([^"]*)?" menu item$/, async function (pronounCase, name) {
  await actOrExplain('open the menu item', name, async () => {
    const link = await menuLink(this, name);
    await link.waitFor({ state: 'visible', timeout: budget(this) });
    await link.click();
  }, MENU_HINT);
  await smartSettle(this.page, 1500);
});

/**
 * Expand the collapsed main menu on a narrow (mobile) viewport by pressing the
 * navbar toggler. Fails with a hint when the toggler is not there, for example
 * on a desktop viewport where the menu is already open.
 *
 * Example #1: When I open the mobile menu
 * Example #2: When I open the mobile navigation menu
 * Example #3: When we open the mobile menu
 * Example #4: And I open the mobile menu
 * Example #5: When I open the mobile navigation
 *
 */
When(/^(I |we )*open the mobile (navigation menu|navigation|menu)$/, async function (pronounCase, navigationCase) {
  const toggler = this.page.locator('.navbar-toggler').first();
  await actOrExplain('open the mobile menu', 'navbar toggler', async () => {
    await toggler.waitFor({ state: 'visible', timeout: budget(this) });
    await toggler.click();
  }, 'The toggler shows only on narrow viewports: set the viewport to the "xs" breakpoint first, or check that the template still uses `.navbar-toggler`.');
  await smartSettle(this.page, 1000);
});

/**
 * Assert a menu item with the given text is (or is not) in a menu module of
 * the page.
 *
 * Example #1: Then I should see the "Blog" menu item
 * Example #2: Then I should see the "Help" menu item
 * Example #3: And I should not see the "Checkout" menu item
 * Example #4: Then we should see the "Login" menu item
 * Example #5: And should see the "Typography" menu item
 *
 */
Then(/^(I |we )*should( not)* see the "([^"]*)?" menu item$/, async function (pronounCase, notCase, name) {
  await assertPresence(this.page.locator('.mod-menu a', { hasText: name }), notCase, {
    label: `a "${name}" menu item`,
    hint: MENU_HINT + ' On a narrow viewport, open the mobile menu first.',
    timeout: budget(this),
  });
});

// ---------------------------------------------------------------------------
// Articles
// ---------------------------------------------------------------------------

/**
 * Open the article teaser with the given title. Joomla renders a dedicated
 * "Read more" link (`aria-label="Read more: <title>"`) only when the intro text
 * is split from the full article; otherwise the heading of the teaser is the
 * link. The step tries the "Read more" link first and falls back to the heading
 * link, the exact title before a title that contains the text.
 *
 * Example #1: When I read more of "Joomla"
 * Example #2: When I read more of "Welcome to your blog"
 * Example #3: When we read more of "Your Template"
 * Example #4: And I read more of "About your home page"
 * Example #5: When read more of "Your Modules"
 *
 */
When(/^(I |we )*read more of "([^"]*)?"$/, async function (pronounCase, title) {
  const readMore = this.page.getByRole('link', { name: `Read more: ${title}`, exact: true });
  const exactHeading = this.page.locator('.page-header a, .item-title a').filter({ hasText: exactly(title) });
  const looseHeading = this.page.locator('.page-header a, .item-title a', { hasText: title });
  await actOrExplain('read more of', title, async () => {
    await readMore.or(looseHeading).first().waitFor({ state: 'visible', timeout: budget(this) });
    const link = (await readMore.count()) ? readMore.first() : (await exactHeading.count()) ? exactHeading.first() : looseHeading.first();
    await link.click();
  }, 'The article must be listed on the current page with a "Read more" link or a linked heading; check the title text.');
  await smartSettle(this.page, 1500);
});

/**
 * Assert the article currently open has (or does not have) the given title.
 * Joomla renders the title as the page `h1` for a standalone article, but as
 * `.page-header h2` for an item in a blog or category view (where `h1` is the
 * page heading), so both headings are checked.
 *
 * Example #1: Then I should be viewing the "Joomla" article
 * Example #2: Then I should be viewing the "Love" article
 * Example #3: And I should not be viewing the "Millions" article
 * Example #4: Then we should be viewing the "Welcome to your blog" article
 * Example #5: And should be viewing the "Your Template" article
 *
 */
Then(/^(I |we )*should( not)* be viewing the "([^"]*)?" article$/, async function (pronounCase, notCase, title) {
  const heading = this.page.locator('h1, .page-header h2').filter({ hasText: literal(title) });
  await assertPresence(heading, notCase, {
    label: `an article heading containing "${title}"`,
    hint: 'The article heading is the page `h1`, or `.page-header h2` in a blog or category view; check the title text and that the "read more" step reached the article.',
    timeout: budget(this),
  });
});

// ---------------------------------------------------------------------------
// Breadcrumbs
// ---------------------------------------------------------------------------

/**
 * Assert the breadcrumb trail equals the given "Home > Section > Page" path.
 * The segments are compared in order after trimming space.
 *
 * Example #1: Then the breadcrumb should show "Home > Blog"
 * Example #2: And the breadcrumb should show "Home > Sample Layouts > Articles > Joomla"
 * Example #3: Then the breadcrumb should show "Home"
 * Example #4: And breadcrumb should show "Home > Help"
 * Example #5: Then the breadcrumb should show "Home > Sample Layouts > Articles > Love"
 *
 */
Then(/^(the )*breadcrumb should show "([^"]*)?"$/, async function (theCase, expectedPath) {
  const expected = expectedPath.split('>').map((part) => part.trim());
  const items = this.page.locator('.mod-breadcrumbs .breadcrumb-item');
  const timeout = budget(this);
  try {
    await items.first().waitFor({ state: 'visible', timeout });
    // Poll until the trail matches or the budget runs out, so a breadcrumb that
    // is still rendering does not fail the step.
    await this.page.waitForFunction(
      (want) => {
        const got = Array.from(document.querySelectorAll('.mod-breadcrumbs .breadcrumb-item'))
          .map((el) => (el.innerText || '').trim()).filter(Boolean);
        return JSON.stringify(got) === JSON.stringify(want);
      },
      expected,
      { timeout }
    );
  } catch (err) {
    const texts = (await items.allInnerTexts().catch(() => [])).map((text) => text.trim()).filter(Boolean);
    throw friendly({
      message: `Expected the breadcrumb "${expected.join(' > ')}" but the page shows "${texts.join(' > ') || '(no breadcrumb)'}".`,
      cause: err,
      hint: 'Breadcrumbs come from the Breadcrumbs module (`.mod-breadcrumbs`); check the menu item titles and that the module is published on this page.',
    });
  }
});

// ---------------------------------------------------------------------------
// Named site pages
// ---------------------------------------------------------------------------

// The core pages a tester opens by name. They are addressed by component and
// view, so they work whatever the menu and the URL rewriting of the site are.
const SITE_PAGES = {
  'login': 'index.php?option=com_users&view=login',
  'sign-in': 'index.php?option=com_users&view=login',
  'password reset': 'index.php?option=com_users&view=reset',
  'reset password': 'index.php?option=com_users&view=reset',
  'username reminder': 'index.php?option=com_users&view=remind',
  'profile': 'index.php?option=com_users&view=profile',
  'search': 'index.php?option=com_finder&view=search',
  'smart search': 'index.php?option=com_finder&view=search',
};

/**
 * Open one of the core pages of the site by its name: the login page, the
 * password reset page, the username reminder, the profile of the logged in
 * user, or the Smart Search page.
 *
 * Example #1: Given I am on the login page
 * Example #2: Given I am on the search page
 * Example #3: Given we are on the password reset page
 * Example #4: Given I am on the username reminder page
 * Example #5: Given we are on the profile page
 *
 */
Given(/^(I am |we are )*on the (login|sign-in|password reset|reset password|username reminder|profile|search|smart search) page$/, async function (pronounCase, name) {
  await open(this, siteUrl(this, SITE_PAGES[name]));
});

/**
 * Assert the form of a core page is (or is not) showing: the login form
 * (the login page or a login module), the password reset form, the username
 * reminder form or the Smart Search form.
 *
 * Example #1: Then I should see the login form
 * Example #2: Then I should not see the login form
 * Example #3: Then we should see the password reset form
 * Example #4: And I should see the username reminder form
 * Example #5: Then I should see the search form
 *
 */
Then(/^(I |we )*should( not)* see the (login|password reset|username reminder|search) form$/, async function (pronounCase, notCase, name) {
  const selectors = {
    'login': '#com-users-login__form, form.mod-login',
    'password reset': '.com-users-reset__form',
    'username reminder': '.com-users-remind__form',
    'search': '.com-finder__form form, form.mod-finder',
  };
  await assertPresence(this.page.locator(selectors[name]), notCase, {
    label: `the ${name} form`,
    hint: 'Open the page that carries the form first; the login form is the login page or the login module, the search form is the Smart Search page or the search module.',
    timeout: budget(this),
  });
});

// ---------------------------------------------------------------------------
// Logging in and out of the site
// ---------------------------------------------------------------------------

// The site and the administrator keep separate sessions: an account that is
// logged in to the administrator is not logged in to the site, and the other
// way round.

/**
 * The state of the site session, read with the browser's own cookies and
 * without leaving the page the scenario is on: the login view of com_users
 * shows the logout form to a logged in user and the login form to a visitor.
 *
 * @param {object} world
 * @returns {Promise<boolean>}
 */
async function siteSessionActive(world) {
  const response = await world.context.request.get(siteUrl(world, 'index.php?option=com_users&view=login'));
  const html = await response.text();
  return /com-users-logout__form/.test(html);
}

/**
 * The login form of the site: the one of the login page when the page is
 * showing it, the login module otherwise.
 *
 * @param {object} world
 * @returns {Promise<{form: import('playwright').Locator, user: import('playwright').Locator, password: import('playwright').Locator, submit: import('playwright').Locator}>}
 */
async function siteLoginForm(world) {
  const page = world.page;
  let form = page.locator('#com-users-login__form');
  if (!(await form.count()) || !(await form.first().isVisible())) {
    form = page.locator('form.mod-login:visible').first();
  }
  if (!(await form.count())) {
    await open(world, siteUrl(world, SITE_PAGES.login));
    form = page.locator('#com-users-login__form');
  }
  return {
    form,
    user: form.locator('input[name="username"]'),
    password: form.locator('input[name="password"]'),
    submit: form.locator('button[type="submit"]'),
  };
}

async function submitSiteLogin(world, username, password) {
  const page = world.page;
  const login = await siteLoginForm(world);
  await actOrExplain('log in to the site as', username, async () => {
    await login.user.first().waitFor({ state: 'visible', timeout: budget(world) });
    await login.user.first().fill(username);
    await login.password.first().fill(password);
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {}),
      login.submit.first().click(),
    ]);
  }, 'The login form is the one of the login page (`#com-users-login__form`) or the login module (`form.mod-login`); open the login page first.');
  await smartSettle(page, (world.minWaitTime && world.minWaitTime.page) || 3000);
}

/**
 * Log in to the site with a username and a password, through the login form of
 * the page (the login page or a login module). When no login form is on the
 * page, the login page is opened first.
 *
 * Example #1: When I log in to the site as "member" with password "Member123456789!"
 * Example #2: When I log in to the site as "editor" with password "Editor123456789!"
 * Example #3: When we log in to the site as "member" with password "wrong-password"
 * Example #4: And I log in to the site as "manager" with password "Manager123456789!"
 * Example #5: When log in to the site as "member" with password "Member123456789!"
 *
 */
When(/^(I |we )*log in to the site as "([^"]*)?" with password "([^"]*)?"$/, { timeout: 60000 }, async function (pronounCase, username, password) {
  await submitSiteLogin(this, username, password);
});

/**
 * Log in to the site as an account of the `users` registry in cucumber.js
 * (`worldParameters.users`), so no credential lives in a feature file. The
 * login page is opened first; a session that is already open is closed before.
 * The accounts are created once with the Joomla CLI (`php cli/joomla.php
 * user:add`); a feature never creates users.
 *
 * Example #1: Given I am logged in to the site with the "member" user
 * Example #2: Given we are logged in to the site with the "editor" user
 * Example #3: Given I am logged in to the site with "member"
 * Example #4: And logged in to the site with the username "manager"
 * Example #5: Given I am logged in to the site with the username "member" user
 *
 */
Given(/^(I am |we are )*logged in to the site with( the)*( username)* "([^"]*)?"( user)*$/, { timeout: 90000 }, async function (pronounCase, theCase, usernameCase, handle, userCase) {
  const { username, password } = resolveUser(this, handle);
  await open(this, siteUrl(this, SITE_PAGES.login));
  if (await this.page.locator('#com-users-logout__form').count()) {
    await Promise.all([
      this.page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {}),
      this.page.locator('#com-users-logout__form button[type="submit"]').click(),
    ]);
    await open(this, siteUrl(this, SITE_PAGES.login));
  }
  await submitSiteLogin(this, username, password);
  if (!(await siteSessionActive(this))) {
    throw friendly({
      message: `The login of "${username}" (registry handle "${handle}") did not open a site session.`,
      hint: 'Check worldParameters.users in cucumber.js and that the account exists on the site (php cli/joomla.php user:list) and is not blocked.',
    });
  }
});

/**
 * Log out of the site: open the login view, which shows the logout form to a
 * logged in user, and press "Log out".
 *
 * Example #1: When I log out of the site
 * Example #2: When we log out of the site
 * Example #3: And I log out of the site
 * Example #4: When log out of the site
 * Example #5: And we log out of the site
 *
 */
When(/^(I |we )*log out of the site$/, async function (pronounCase) {
  await open(this, siteUrl(this, SITE_PAGES.login));
  const logout = this.page.locator('#com-users-logout__form button[type="submit"], form.mod-login-logout button[type="submit"]').first();
  await actOrExplain('log out of the site', 'the logout form', async () => {
    await logout.waitFor({ state: 'visible', timeout: budget(this) });
    await Promise.all([
      this.page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {}),
      logout.click(),
    ]);
  }, 'Nobody is logged in to the site; use "Given I am logged in to the site with the "member" user" first.');
  await smartSettle(this.page, 1500);
});

/**
 * Assert a session is (or is not) open on the site, optionally for a given
 * account (a username, or a handle of the users registry). The check asks the
 * site with the browser's cookies, so the page the scenario is on stays where
 * it is.
 *
 * Example #1: Then I should be logged in to the site
 * Example #2: Then I should not be logged in to the site
 * Example #3: Then we should be logged in to the site as "member"
 * Example #4: And I should be logged in to the site as "editor"
 * Example #5: Then should not be logged in to the site
 *
 */
Then(/^(I |we )*should( not)* be logged in to the site(?: as "([^"]*)")?$/, async function (pronounCase, notCase, who) {
  const wanted = !notCase;
  const deadline = Date.now() + budget(this);
  let active = await siteSessionActive(this);
  while (active !== wanted && Date.now() < deadline) {
    await this.page.waitForTimeout(500);
    active = await siteSessionActive(this);
  }
  if (active !== wanted) {
    throw friendly({
      message: wanted ? 'Expected a session on the site, but nobody is logged in.' : 'Expected nobody to be logged in to the site, but a session is open.',
      hint: wanted ? 'Log in first with "Given I am logged in to the site with the "member" user".' : 'Log out first with "When I log out of the site", or start with "Given I am not logged in".',
    });
  }
  if (supplied(who) && wanted) {
    const users = (this.parameters && this.parameters.users) || {};
    const username = users[who] && users[who].username ? users[who].username : who;
    const response = await this.context.request.get(siteUrl(this, 'index.php?option=com_users&view=profile'));
    const html = await response.text();
    if (!new RegExp('<dd[^>]*>\\s*' + username.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*</dd>').test(html)) {
      throw friendly({
        message: `Expected the site session to belong to "${username}", but the profile page shows another account.`,
        hint: 'Log out and log in as the account the scenario needs.',
      });
    }
  }
});

/**
 * Assert the login was refused with Joomla's "Username and password do not
 * match" message on the site.
 *
 * Example #1: Then I should see an invalid login error on the site
 * Example #2: Then we should see an invalid login error on the site
 * Example #3: And I should not see an invalid login error on the site
 * Example #4: Then should see an invalid login error on the site
 * Example #5: And we should not see an invalid login error on the site
 *
 */
Then(/^(I |we )*should( not)* see an invalid login error on the site$/, async function (pronounCase, notCase) {
  await assertPresence(alerts(this, 'warning', 'Username and password do not match'), notCase, {
    label: 'an invalid-login alert ("Username and password do not match")',
    hint: 'The alert is a <joomla-alert type="warning"> element; check the wording if the site runs another language, and that the login form was submitted.',
    timeout: budget(this),
  });
});

// ---------------------------------------------------------------------------
// System messages
// ---------------------------------------------------------------------------

/**
 * Assert a system message (`joomla-alert`) is (or is not) showing, optionally
 * of one type (success, info, notice, warning or error) and containing some
 * text. The messages are the same on the site and in the administrator.
 *
 * Example #1: Then I should see a success message "Article saved."
 * Example #2: Then I should see an error message "Save failed"
 * Example #3: Then we should see a warning message "Username and password do not match"
 * Example #4: And I should not see an info message
 * Example #5: Then I should see the system message "saved"
 *
 */
Then(/^(I |we )*should( not)* see (?:a|an|the) (?:(success|info|notice|warning|error) )?(?:system )?message(?: "([^"]*)")?$/, async function (pronounCase, notCase, type, text) {
  const wanted = [type ? `${type} ` : '', 'message', supplied(text) ? ` containing "${text}"` : ''].join('');
  const article = /^[aeiou]/.test(wanted) ? 'an' : 'a';
  try {
    await assertPresence(alerts(this, type, text), notCase, {
      label: `${article} ${wanted}`,
      hint: 'System messages are `joomla-alert` elements in `#system-message-container`; a message can be dismissed or replaced by the next page, so assert it right after the action.',
      timeout: budget(this),
    });
  } catch (err) {
    // Say what the page does show, so a wrong word or type is seen at once.
    const shown = await this.page.locator('#system-message-container joomla-alert').evaluateAll((els) => els.map((el) => `${el.getAttribute('type')}: ${(el.innerText || '').replace(/\s+/g, ' ').trim()}`)).catch(() => []);
    err.message += `\n  The page shows: ${shown.length ? shown.map((entry) => `"${entry}"`).join('; ') : 'no system message'}.`;
    err.stack = err.message;
    throw err;
  }
});

/**
 * Assert the page shows no system message at all (or, with "not", at least
 * one), whatever its type.
 *
 * Example #1: Then I should see no system messages
 * Example #2: Then we should see no system messages
 * Example #3: And I should see no system messages
 * Example #4: Then should see no system messages
 * Example #5: And we should see no system messages
 *
 */
Then(/^(I |we )*should see no system messages$/, async function (pronounCase) {
  await this.page.waitForSelector('body', { state: 'attached' });
  await smartSettle(this.page, 1500);
  const texts = await alerts(this).evaluateAll((els) => els.map((el) => (el.innerText || '').trim().replace(/\s+/g, ' ')));
  if (texts.length) {
    throw friendly({
      message: `Expected no system messages, but the page shows ${texts.length}: ${texts.map((text) => `"${text}"`).join(', ')}.`,
      hint: 'A message of the last action is still showing; check the scenario for a failed or warned action.',
    });
  }
});

// ---------------------------------------------------------------------------
// Site search (com_finder, Smart Search)
// ---------------------------------------------------------------------------

const SEARCH_HINT = 'The Smart Search module (`.js-finder-search-query`) must be published on this page, or open the search page first ("Given I am on the search page"); on a narrow viewport the search box may be inside the mobile menu.';
const RESULT_ITEMS = '#search-result-list .result__item';
const RESULTS_HINT = 'Smart Search only finds indexed content: run the indexer (`php cli/joomla.php finder:index`, or System > Smart Search > Index) and check the text is in a published article. The match is on the entries of the result list, not on the echo of the search term.';

async function submitSearch(world, term) {
  const input = world.page.locator('.js-finder-search-query:visible').first();
  await actOrExplain('search the site for', term, async () => {
    await input.waitFor({ state: 'visible', timeout: budget(world) });
    await input.fill(term);
    await Promise.all([
      world.page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {}),
      input.press('Enter'),
    ]);
  }, SEARCH_HINT);
  await smartSettle(world.page, 1500);
}

/**
 * Submit the Smart Search form (`com_finder`) with the given search term,
 * through whichever search box is visible: the search module of the page or the
 * form of the search page.
 *
 * Example #1: When I search the site for "joomla"
 * Example #2: When I search the site for "template"
 * Example #3: When we search the site for "articles"
 * Example #4: And I search the site for "blog"
 * Example #5: When search the site for "modules"
 *
 */
When(/^(I |we )*search the site for "([^"]*)?"$/, async function (pronounCase, term) {
  await submitSearch(this, term);
});

/**
 * Search for a word taken from the first article title on the current page, so
 * the search matches content the site really has without naming an article in
 * the feature file. The word is kept for "I should see that word in the search
 * results".
 *
 * Example #1: When I search the site for a word from the first article
 * Example #2: When we search the site for a word from the first article
 * Example #3: And I search the site for a word from the first article
 * Example #4: When search the site for a word from the first article
 * Example #5: And we search the site for a word from the first article
 *
 */
When(/^(I |we )*search the site for a word from the first article$/, async function (pronounCase) {
  const heading = this.page.locator('.item-title, .page-header h1, .page-header h2').first();
  await heading.waitFor({ state: 'visible', timeout: budget(this) }).catch((err) => {
    throw friendly({
      message: 'No article title on this page to take a search word from.',
      cause: err,
      hint: 'Open a page that lists articles first (the home page or the blog listing).',
    });
  });
  const title = (await heading.innerText()).trim();
  const word = title.split(/[^\p{L}\p{N}]+/u).filter((w) => w.length >= 4)[0] || title.split(/\s+/)[0];
  if (!word) {
    throw friendly({
      message: `The first article title on this page ("${title}") has no word to search for.`,
      hint: 'Open a page whose first article has a title of at least one word.',
    });
  }
  this.joomlaSearchWord = word;
  await submitSearch(this, word);
});

/**
 * Assert the Smart Search result list holds (or does not hold) an entry that
 * contains the word the step "search the site for a word from the first
 * article" searched for. The words are matched in the entries of the list, not
 * in the sentence that repeats the search term, so a search without results
 * cannot pass.
 *
 * Example #1: Then I should see that word in the search results
 * Example #2: And we should see that word in the search results
 * Example #3: Then should see that word in the search results
 * Example #4: Then I should not see that word in the search results
 * Example #5: And we should not see that word in the search results
 *
 */
Then(/^(I |we )*should( not)* see that word in the search results$/, async function (pronounCase, notCase) {
  const word = this.joomlaSearchWord;
  if (!word) {
    throw friendly({
      message: 'No search word is remembered for this scenario.',
      hint: 'Add "When I search the site for a word from the first article" before this step.',
    });
  }
  // A string `hasText` is a case-insensitive, whitespace-normalised match.
  await assertPresence(this.page.locator(RESULT_ITEMS).filter({ hasText: word }), notCase, {
    label: `"${word}" in an entry of the search results`,
    hint: RESULTS_HINT,
    timeout: budget(this),
  });
});

/**
 * Assert the Smart Search answered without any result: Joomla replaces the
 * result list with its "No Results Found" block.
 *
 * Example #1: Then I should see no search results
 * Example #2: And we should see no search results
 * Example #3: Then should see no search results
 * Example #4: And I should see no search results
 * Example #5: Then we should see no search results
 *
 */
Then(/^(I |we )*should see no search results$/, async function (pronounCase) {
  const timeout = budget(this);
  try {
    await this.page.locator('#search-result-empty').waitFor({ state: 'visible', timeout });
  } catch (err) {
    const count = await this.page.locator(RESULT_ITEMS).count();
    throw friendly({
      message: count ? `Expected no search results, but the list holds ${count}.` : 'Expected the "No Results Found" block of the Smart Search, but the page does not show it.',
      cause: err,
      hint: 'Use a term no article contains, and check the page is the Smart Search result page (`#search-results`).',
    });
  }
});

/**
 * Assert an entry of the Smart Search result list contains (or does not
 * contain) the given text. The text is matched in the entries of the list
 * (title, description, type, author, category), not in the sentence that
 * repeats the search term.
 *
 * Example #1: Then I should see "Joomla" in the search results
 * Example #2: And I should see "Template positions" in the search results
 * Example #3: Then I should not see "Checkout" in the search results
 * Example #4: And we should see "Blog" in the search results
 * Example #5: Then should see "Welcome" in the search results
 *
 */
Then(/^(I |we )*should( not)* see "([^"]*)?" in the search results$/, async function (pronounCase, notCase, expectedText) {
  await assertPresence(this.page.locator(RESULT_ITEMS).filter({ hasText: literal(expectedText) }), notCase, {
    label: `"${expectedText}" in an entry of the search results`,
    hint: RESULTS_HINT + ' The match is case-sensitive.',
    timeout: budget(this),
  });
});

/**
 * Assert the Smart Search result page lists (or, with "at least", lists at
 * least) a number of results on the page.
 *
 * Example #1: Then I should see at least 1 search result
 * Example #2: Then I should see at least 5 search results
 * Example #3: Then we should see 12 search results
 * Example #4: And I should see 1 search result
 * Example #5: Then should see at least 2 search results
 *
 */
Then(/^(I |we )*should see( at least)* (\d+) search results?$/, async function (pronounCase, atLeastCase, number) {
  const wanted = parseInt(number, 10);
  const items = this.page.locator(RESULT_ITEMS);
  const deadline = Date.now() + budget(this);
  let count = await items.count();
  const enough = (n) => (atLeastCase ? n >= wanted : n === wanted);
  while (!enough(count) && Date.now() < deadline) {
    await this.page.waitForTimeout(300);
    count = await items.count();
  }
  if (!enough(count)) {
    throw friendly({
      message: `Expected ${atLeastCase ? 'at least ' : ''}${wanted} search result(s) on the page, but it lists ${count}.`,
      hint: RESULTS_HINT + ' A result page lists 20 entries at most.',
    });
  }
});

/**
 * Open an entry of the Smart Search result list: the one with the given title,
 * or the first one.
 *
 * Example #1: When I open the search result "Joomla"
 * Example #2: When I open the first search result
 * Example #3: When we open the search result "Your Modules"
 * Example #4: And we open the first search result
 * Example #5: When open the search result "Typography"
 *
 */
When(/^(I |we )*open (?:the search result "([^"]*)"|the first search result)$/, async function (pronounCase, title) {
  const links = this.page.locator(`${RESULT_ITEMS} .result__title-link`);
  const target = supplied(title) ? links.filter({ has: this.page.locator('.result__title-text', { hasText: exactly(title) }) }) : links;
  await actOrExplain('open the search result', supplied(title) ? title : 'the first result', async () => {
    await target.first().waitFor({ state: 'visible', timeout: budget(this) });
    await target.first().click();
  }, RESULTS_HINT + ' The title is matched exactly.');
  await smartSettle(this.page, 1500);
});

// ---------------------------------------------------------------------------
// Error pages
// ---------------------------------------------------------------------------

/**
 * Assert the page is (or is not) Joomla's answer to a missing page (404) or a
 * refused one (403). The response status of the navigation must match, and the
 * page must say so in one of the ways Joomla does: the error template of the
 * site (`body.error_site`), the error template of the administrator (the error
 * code in a badge), or, for a 403 that a component answers inside the normal
 * template, the error message "You don't have permission to access this".
 *
 * Example #1: Then I should be on the 404 page
 * Example #2: Then I should be on the page not found page
 * Example #3: Then we should be on the 403 page
 * Example #4: And I should not be on the 404 page
 * Example #5: Then I should be on the access denied page
 *
 */
Then(/^(I |we )*should( not)* be on the (404|page not found|403|access denied) page$/, async function (pronounCase, notCase, name) {
  const status = /^(404|page not found)$/.test(name) ? 404 : 403;
  const timeout = budget(this);
  const probe = async () => this.page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0];
    const badge = document.querySelector('blockquote .badge');
    return {
      template: /(^|\s)error_site(\s|$)/.test(document.body.className) || (!!badge && /^\d{3}$/.test((badge.textContent || '').trim())),
      refused: !!document.querySelector('#system-message-container joomla-alert[type="danger"]'),
      status: nav && nav.responseStatus,
      title: document.title,
    };
  });
  const deadline = Date.now() + timeout;
  let state = await probe();
  const matches = (s) => s.status === status && (s.template || (status === 403 && s.refused));
  while (matches(state) === !!notCase && Date.now() < deadline) {
    await this.page.waitForTimeout(300);
    state = await probe();
  }
  if (matches(state) === !!notCase) {
    throw friendly({
      message: notCase
        ? `Expected not to be on the ${status} page, but the page "${state.title}" is Joomla's answer with status ${state.status}.`
        : `Expected Joomla's ${status} page, but the page "${state.title}" has status ${state.status}${state.template || state.refused ? '' : ' and shows neither the error template nor a refusal message'}.`,
      hint: 'Open a path that does not exist (for a 404) or a page the account may not open (for a 403) before this step.',
    });
  }
});

// ---------------------------------------------------------------------------
// Site fingerprint and modules
// ---------------------------------------------------------------------------

/**
 * Assert the page announces Joomla as its generator (the `generator` meta tag).
 *
 * Example #1: Then the site should be running Joomla
 * Example #2: Then the site should not be running Joomla
 * Example #3: And the site should be running Joomla
 * Example #4: Then the site should be running Joomla
 * Example #5: And the site should not be running Joomla
 *
 */
Then(/^the site should( not)* be running Joomla$/, async function (notCase) {
  const generator = await this.page.locator('meta[name="generator"]').first().getAttribute('content', { timeout: 2000 }).catch(() => null);
  const isJoomla = !!generator && /joomla/i.test(generator);
  if (isJoomla === !!notCase) {
    throw friendly({
      message: notCase ? `Expected a site that is not Joomla, but the generator is "${generator}".` : `Expected the generator meta tag to name Joomla, but it is ${generator ? `"${generator}"` : 'missing'}.`,
      hint: 'The generator tag can be changed in the Global Configuration (Site Meta) or removed by a template.',
    });
  }
});

/**
 * Assert a module with the given title is (or is not) on the page. The title
 * is the one the template shows above the module (`.card-header`, or
 * `.module-title`), so the module must have its title shown.
 *
 * Example #1: Then I should see the "Popular Tags" module
 * Example #2: Then I should see the "Latest Articles" module
 * Example #3: Then we should not see the "Login Form" module
 * Example #4: And I should see the "Who's Online" module
 * Example #5: Then should see the "Main Menu" module
 *
 */
Then(/^(I |we )*should( not)* see the "([^"]*)?" module$/, async function (pronounCase, notCase, title) {
  await assertPresence(this.page.locator('.card-header, .module-title, .mod-custom > h3').filter({ hasText: exactly(title) }), notCase, {
    label: `the "${title}" module`,
    hint: 'The module must be published for this page (position, menu assignment, access level) and its title shown; the title text is matched exactly.',
    timeout: budget(this),
  });
});

// ---------------------------------------------------------------------------
// Multilingual
// ---------------------------------------------------------------------------

/**
 * Assert the language switcher module (`.mod-languages`) is (or is not) on the
 * page. It shows only on a multilingual site: the Language Filter plugin, at
 * least two content languages and a published Language Switcher module.
 *
 * Example #1: Then I should see the language switcher
 * Example #2: Then I should not see the language switcher
 * Example #3: Then we should see the language switcher
 * Example #4: And I should not see the language switcher
 * Example #5: Then should see the language switcher
 *
 */
Then(/^(I |we )*should( not)* see the language switcher$/, async function (pronounCase, notCase) {
  await assertPresence(this.page.locator('.mod-languages'), notCase, {
    label: 'the language switcher (`.mod-languages`)',
    hint: 'A multilingual site needs the "System - Language Filter" plugin, two content languages and a published "Language Switcher" module.',
    timeout: budget(this),
  });
});

/**
 * Switch the site language with the language switcher, by the name the
 * switcher shows (a link, the label or the title of its flag, or an option of the
 * dropdown variant).
 *
 * Example #1: When I switch the site language to "Français"
 * Example #2: When I switch the site language to "English (United Kingdom)"
 * Example #3: When we switch the site language to "Deutsch"
 * Example #4: And I switch the site language to "Español"
 * Example #5: When switch the site language to "Français (France)"
 *
 */
When(/^(I |we )*switch the site language to "([^"]*)?"$/, async function (pronounCase, language) {
  const switcher = this.page.locator('.mod-languages');
  await actOrExplain('switch the site language to', language, async () => {
    await switcher.first().waitFor({ state: 'visible', timeout: budget(this) });
    const select = switcher.locator('select').first();
    if (await select.count()) {
      await select.selectOption({ label: language });
    } else {
      // The switcher shows the language as text, as a flag (an image with the
      // name as its title) or as a code with the name as its title; the link
      // carries the name as its label in the last two cases.
      const byText = switcher.locator('a').filter({ hasText: exactly(language) });
      const byName = switcher.locator(`a[aria-label="${language}"], a:has(img[title="${language}"]), a:has(img[alt="${language}"]), a:has([title="${language}"])`);
      const link = (await byText.count()) ? byText.first() : byName.first();
      await link.click();
    }
  }, 'The language must be one the switcher offers: check the name it shows (the native title of the content language, or the title of its flag).');
  await smartSettle(this.page, 2000);
});
