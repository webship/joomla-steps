'use strict';

// Joomla administrator step definitions: logging in to and out of the
// /administrator control panel (by credentials or by a handle of the users
// registry), the Dashboard, the Atum sidebar menu, the toolbar, the named
// administrator pages and the page title.
//
// The list views and forms of the components have their own files:
// joomla-content.steps.js (articles, categories, menus, modules, media) and
// joomla-system.steps.js (users, access levels, configuration, extensions,
// cache, check-in).
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
  siteRoot,
  adminUrl,
  open,
  actOrExplain: explain,
  assertPresence: presence,
  resolveUser,
  adminQuery,
  openAdminPage,
  clickToolbarButton,
} = require('./joomla-helpers');

const ADMIN_HINT = 'The administrator template may have changed; check the login form (`#form-login`) and the Dashboard markup (`#cpanel-modules`).';

function actOrExplain(label, target, fn, hint = ADMIN_HINT) {
  return explain(label, target, fn, hint);
}

function assertPresence(locator, notCase, options) {
  return presence(locator, notCase, options);
}

/** Wait for the administrator login form, with a friendly error when it does not show. */
async function waitForLoginForm(world) {
  await world.page.locator('#form-login').waitFor({ state: 'visible', timeout: budget(world) }).catch((err) => {
    throw friendly({
      message: 'The administrator login form (`#form-login`) did not appear.',
      cause: err,
      hint: 'Check that `launchUrl` points at the site root (the step opens `/administrator` under it) and that nobody is still logged in.',
    });
  });
}

/** Whether the administrator header shows a signed-in user (the Atum user menu). */
async function adminSessionActive(world) {
  return (await world.page.locator('#form-login').count()) === 0 && (await world.page.locator('.header-profile').count()) > 0;
}

/**
 * Fill in and submit the administrator login form (`#form-login`), then wait for
 * one of its two outcomes: the Dashboard or the invalid-login alert. The submit
 * is dispatched as an in-page click so the navigation it triggers is awaited
 * together with it, rather than racing a detached Playwright click against the
 * page unload. A first login after a fresh install can take far longer than
 * usual (cold PHP setup), so the outcome wait has its own long budget. Joomla's
 * one-time guided-tour modal is dismissed when it shows, since it overlays the
 * whole Dashboard.
 */
async function submitAdminLogin(world, username, password) {
  const page = world.page;
  const usernameField = page.locator('#mod-login-username');
  const passwordField = page.locator('#mod-login-password');
  await actOrExplain('log in to the administrator panel as', username, async () => {
    await usernameField.waitFor({ state: 'visible', timeout: budget(world) });
    await usernameField.fill(username);
    await passwordField.fill(password);
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 90000 }).catch(() => {}),
      page.evaluate(() => {
        const submit = document.querySelector('#btn-login-submit');
        if (!submit) throw new Error('The login submit button "#btn-login-submit" was not found.');
        submit.click();
      }),
    ]);
  });
  await smartSettle(page, (world.minWaitTime && world.minWaitTime.page) || 3000);

  const dashboard = page.locator('#cpanel-modules, body.com_cpanel').first();
  const loginError = page.locator('joomla-alert[type="warning"], joomla-alert[type="danger"]').first();
  await Promise.race([
    dashboard.waitFor({ state: 'visible', timeout: 90000 }),
    loginError.waitFor({ state: 'visible', timeout: 90000 }),
  ]).catch(() => {});

  const tourCancel = page.getByRole('button', { name: 'Cancel' });
  if (await tourCancel.count()) {
    await tourCancel.click().catch(() => {});
  }
}

// ---------------------------------------------------------------------------
// Login / logout
// ---------------------------------------------------------------------------

/**
 * Open the Joomla administrator login page (`/administrator`) as an anonymous
 * visitor.
 *
 * Example #1: Given I am on the administrator login page
 * Example #2: Given we are on the administrator login page
 * Example #3: Given I am on the admin login page
 * Example #4: Given on the administrator login page
 * Example #5: Given we are on the admin login page
 *
 */
Given(/^(I am |we are )*on the admin(?:istrator)* login page$/, async function (pronounCase) {
  await open(this, siteRoot(this) + '/administrator');
  await waitForLoginForm(this);
});

/**
 * Fill in and submit the Joomla administrator login form (`#form-login`) with
 * the given username and password, then wait for the page to settle on either
 * the Dashboard or the login error message.
 *
 * Example #1: When I log in to the administrator panel as "admin" with password "Admin123456789!"
 * Example #2: When I log into the administrator panel as "admin" with password "Admin123456789!"
 * Example #3: When we log in to the administrator panel as "manager" with password "Manager123456789!"
 * Example #4: And I log in to the administrator panel as "admin" with password "wrong-password"
 * Example #5: When I log into the administrator panel as "admin" with password "WrongPass1!"
 *
 */
When(/^(I |we )*log in(?:to| to) the administrator panel as "([^"]*)?" with password "([^"]*)?"$/, { timeout: 120000 }, async function (pronounCase, username, password) {
  await submitAdminLogin(this, username, password);
});

/**
 * Log in to the administrator panel as an account of the `users` registry in
 * cucumber.js `worldParameters` (`{ <handle>: { username, password } }`, with
 * the password read from an environment variable so no credential lives in a
 * feature file). Opens `/administrator` first, so no earlier "on the
 * administrator login page" step is needed. The account must be allowed to log
 * in to the administrator (Manager, Administrator or Super Users group); the
 * accounts are created once with the Joomla CLI (`php cli/joomla.php
 * user:add`), a feature never creates users.
 *
 * Example #1: Given I am a logged in user with the "admin" user
 * Example #2: Given we are a logged in user with the username "admin"
 * Example #3: Given I am a logged in user with "manager"
 * Example #4: And a logged in user with username "admin"
 * Example #5: Given I am a logged in user with the username "admin" user
 *
 */
Given(/^(I am |we are )*a logged in user with( the)*( username)* "([^"]*)?"( user)*$/, { timeout: 120000 }, async function (pronounCase, theCase, usernameCase, handle, userCase) {
  const { username, password } = resolveUser(this, handle);
  await open(this, siteRoot(this) + '/administrator');
  if (await adminSessionActive(this)) {
    await this.context.clearCookies();
    await open(this, siteRoot(this) + '/administrator');
  }
  await waitForLoginForm(this);
  await submitAdminLogin(this, username, password);
  if (!(await adminSessionActive(this))) {
    throw friendly({
      message: `The login of "${username}" (registry handle "${handle}") did not reach the administrator panel.`,
      hint: 'Check worldParameters.users in cucumber.js, that the account exists (php cli/joomla.php user:list) and that its group may log in to the administrator (Manager, Administrator or Super Users).',
    });
  }
});

/**
 * Make sure nobody is logged in, to the site or to the administrator: clear the
 * cookies and the web storage of the browser. When the scenario is on the
 * administrator, the login form is loaded again and asserted; on any other page
 * the page is reloaded.
 *
 * Example #1: Given I am not logged in
 * Example #2: Given we are not logged in
 * Example #3: And not logged in
 * Example #4: Given I am not logged in
 * Example #5: And we are not logged in
 *
 */
Given(/^(I am |we are )*not logged in$/, async function (pronounCase) {
  await this.context.clearCookies();
  await this.page.evaluate(() => {
    try { window.localStorage.clear(); } catch (e) { /* storage may be unavailable */ }
    try { window.sessionStorage.clear(); } catch (e) { /* storage may be unavailable */ }
  }).catch(() => {});
  const adminUrlPrefix = siteRoot(this) + '/administrator';
  const url = this.page.url();
  if (url.startsWith(adminUrlPrefix)) {
    await open(this, adminUrlPrefix);
    await waitForLoginForm(this);
  } else if (/^https?:/.test(url)) {
    await this.page.reload({ waitUntil: 'domcontentloaded' });
  }
  await smartSettle(this.page, 1000);
});

/**
 * Log out of the administrator panel: open the "User Menu" in the header and
 * press "Log out", then wait for the login form to reappear.
 *
 * Example #1: When I log out of the administrator panel
 * Example #2: When we log out of the administrator panel
 * Example #3: And I log out of the administrator panel
 * Example #4: When I log out of the admin panel
 * Example #5: And we log out of the admin panel
 *
 */
When(/^(I |we )*log out of the admin(?:istrator)* panel$/, async function (pronounCase) {
  const userMenuToggle = this.page.locator('.header-profile button.dropdown-toggle').first();
  const logoutLink = this.page.locator('.header-profile a[href*="task=logout"]').first();
  await actOrExplain('log out of', 'the administrator panel', async () => {
    // The "Log out" link is visible only once the "User Menu" of the header is open.
    await userMenuToggle.waitFor({ state: 'visible', timeout: budget(this) });
    await userMenuToggle.click();
    await logoutLink.waitFor({ state: 'visible', timeout: budget(this) });
    await logoutLink.click();
  }, 'The "Log out" link lives in the "User Menu" of the header; you must be logged in to the administrator panel first.');
  await smartSettle(this.page, 1500);
});

// ---------------------------------------------------------------------------
// Assertions about the session
// ---------------------------------------------------------------------------

/**
 * Assert the administrator Dashboard (`com_cpanel`) has (or has not) loaded,
 * identified by its `#cpanel-modules` container. The page title is not used:
 * whether it is prefixed with "Home Dashboard" varies by version and
 * configuration, but the markup of the Dashboard does not.
 *
 * Example #1: Then I should see the administrator dashboard
 * Example #2: And I should see the admin dashboard
 * Example #3: Then we should not see the administrator dashboard
 * Example #4: And should see the admin dashboard
 * Example #5: Then I should be on the administrator dashboard
 *
 */
Then(/^(I |we )*should( not)* (?:see|be on) the admin(?:istrator)* dashboard$/, { timeout: 40000 }, async function (pronounCase, notCase) {
  const dashboard = this.page.locator('#cpanel-modules, body.com_cpanel');
  try {
    await dashboard.first().waitFor({ state: notCase ? 'hidden' : 'visible', timeout: 30000 });
  } catch (err) {
    throw friendly({
      message: notCase
        ? 'Expected not to be on the administrator dashboard, but it is still showing.'
        : `Expected the administrator dashboard, but the page title was "${await this.page.title()}".`,
      cause: err,
      hint: notCase
        ? 'Log out of the administrator panel (or clear the session with "I am not logged in") before this step.'
        : 'A first login after a fresh install can be slow; check the credentials in worldParameters.users and that the login did not return an invalid-login alert.',
    });
  }
});

/**
 * Assert the administrator login form rejected (or did not reject) the
 * credentials with Joomla's standard "Username and password do not match"
 * message.
 *
 * Example #1: Then I should see an invalid login error in the administrator panel
 * Example #2: And I should see an invalid login error in the admin panel
 * Example #3: Then we should see an invalid login error in the administrator panel
 * Example #4: And should not see an invalid login error in the admin panel
 * Example #5: Then I should see an invalid login error in the admin panel
 *
 */
Then(/^(I |we )*should( not)* see an invalid login error in the admin(?:istrator)* panel$/, async function (pronounCase, notCase) {
  // The alert renders as a <joomla-alert> custom element; a matching
  // `.alert-warning` or `.alert-danger` markup exists too, but only inside a
  // <noscript> fallback that a real browser never displays.
  const message = this.page
    .locator('joomla-alert[type="warning"], joomla-alert[type="danger"]')
    .filter({ hasText: /username and password do not match/i });
  await assertPresence(message, notCase, {
    label: 'an invalid-login alert ("Username and password do not match")',
    hint: notCase
      ? 'The credentials were rejected; check worldParameters.users (or the inline password) against the site.'
      : 'The alert is a <joomla-alert> element; if the login succeeded instead, the password was accepted. Check the wording if the site runs another language.',
    timeout: budget(this),
  });
});

/**
 * Assert the administrator login form (`#form-login`) is (or is not) showing,
 * that is, whether anyone is logged in to the control panel.
 *
 * Example #1: Then I should be on the administrator login page
 * Example #2: And I should be on the admin login page
 * Example #3: Then we should not be on the administrator login page
 * Example #4: And should be on the admin login page
 * Example #5: Then I should be on the administrator login page again
 *
 */
Then(/^(I |we )*should( not)* be on the admin(?:istrator)* login page(?: again)*$/, async function (pronounCase, notCase) {
  await assertPresence(this.page.locator('#form-login'), notCase, {
    label: 'the administrator login form (`#form-login`)',
    hint: notCase
      ? 'The login form is still showing: the login was rejected or the session was cleared.'
      : 'Log out (or clear the session with "I am not logged in") and check `launchUrl` points at the site root.',
    timeout: budget(this),
  });
});

/**
 * Assert the administrator panel shows a signed-in user (the "User Menu" of the
 * header), optionally with the display name the menu announces ("Signed in as
 * ...").
 *
 * Example #1: Then I should be logged in to the administrator panel
 * Example #2: Then I should be logged in to the administrator panel as "Super User"
 * Example #3: Then we should not be logged in to the administrator panel
 * Example #4: And I should be logged in to the admin panel as "Test Manager"
 * Example #5: Then should be logged in to the admin panel
 *
 */
Then(/^(I |we )*should( not)* be logged in to the admin(?:istrator)* panel(?: as "([^"]*)")?$/, async function (pronounCase, notCase, name) {
  const profile = this.page.locator('.header-profile .dropdown-header');
  const target = supplied(name) ? profile.filter({ hasText: literal(name) }) : profile;
  await assertPresence(target, notCase, {
    label: supplied(name) ? `the administrator session of "${name}"` : 'an administrator session',
    hint: 'Open an administrator page first: the header with the "User Menu" shows "Signed in as <name>" for the logged in account; the name is the display name of the account, not its username.',
    timeout: budget(this),
    state: 'attached',
  });
});

// ---------------------------------------------------------------------------
// Pages, page title, sidebar menu
// ---------------------------------------------------------------------------

/**
 * Open a named administrator page: the dashboard, articles, featured articles,
 * categories, media, site modules, menus, menu items, users, groups, access
 * levels, extensions, plugins, templates, languages, global configuration,
 * system information, clear cache, global check-in, smart search index and
 * others. A query string such as "option=com_tags&view=tags" works too. The
 * session must be logged in to the administrator.
 *
 * Example #1: Given I am on the administrator "Articles" page
 * Example #2: Given I am on the administrator "Global Configuration" page
 * Example #3: Given we are on the administrator "Users" page
 * Example #4: When I go to the administrator "Clear Cache" page
 * Example #5: Given I am on the administrator "option=com_tags&view=tags" page
 *
 */
Given(/^(I am |we are |I go |we go )*(?:on|to) the admin(?:istrator)* "([^"]*)?" page$/, async function (pronounCase, name) {
  await openAdminPage(this, name);
});

/**
 * Assert the page is (or is not) the named administrator page, by the component
 * and view in its address (`option=com_content&view=articles`); the dashboard
 * by the `com_cpanel` body class.
 *
 * Example #1: Then I should be on the administrator "Articles" page
 * Example #2: Then I should be on the administrator "Dashboard" page
 * Example #3: Then we should be on the administrator "Users" page
 * Example #4: And I should not be on the administrator "Articles" page
 * Example #5: Then should be on the administrator "Global Configuration" page
 *
 */
Then(/^(I |we )*should( not)* be on the admin(?:istrator)* "([^"]*)?" page$/, async function (pronounCase, notCase, name) {
  const query = new URLSearchParams(adminQuery(name));
  const matches = () => {
    const current = new URL(this.page.url());
    if (!current.pathname.startsWith('/administrator')) return false;
    if (![...query.keys()].length) return !current.searchParams.get('option') || current.searchParams.get('option') === 'com_cpanel';
    return ['option', 'view', 'extension', 'client_id'].every((key) => !query.has(key) || current.searchParams.get(key) === query.get(key));
  };
  const deadline = Date.now() + budget(this);
  while (matches() === !!notCase && Date.now() < deadline) {
    await this.page.waitForTimeout(300);
  }
  if (matches() === !!notCase) {
    throw friendly({
      message: notCase ? `Expected not to be on the administrator "${name}" page, but the address is ${this.page.url()}.` : `Expected the administrator "${name}" page, but the address is ${this.page.url()}.`,
      hint: 'The page is recognised by the component and view in its address; check the name and that the session is logged in to the administrator.',
    });
  }
});

/**
 * Assert the title of the administrator page (the `h1.page-title` of the
 * header) contains (or does not contain) the text. A form shows its action in
 * the title ("Articles: New", "Articles: Edit").
 *
 * Example #1: Then I should see the administrator page title "Articles"
 * Example #2: Then I should see the administrator page title "Articles: New"
 * Example #3: Then we should see the administrator page title "Global Configuration"
 * Example #4: And I should not see the administrator page title "Users"
 * Example #5: Then should see the administrator page title "Maintenance: Clear Cache"
 *
 */
Then(/^(I |we )*should( not)* see the admin(?:istrator)* page title "([^"]*)?"$/, async function (pronounCase, notCase, title) {
  await assertPresence(this.page.locator('h1.page-title').filter({ hasText: literal(title) }), notCase, {
    label: `the administrator page title "${title}"`,
    hint: 'The title is the `h1.page-title` of the administrator header; check the text (it is matched case-sensitively) and that the page is the one the step expects.',
    timeout: budget(this),
  });
});

/**
 * Assert the administrator sidebar menu (`#sidebarmenu`, the Atum menu) is (or
 * is not) showing.
 *
 * Example #1: Then I should see the administrator menu
 * Example #2: Then I should not see the administrator menu
 * Example #3: Then we should see the admin menu
 * Example #4: And I should see the administrator menu
 * Example #5: Then should not see the admin menu
 *
 */
Then(/^(I |we )*should( not)* see the admin(?:istrator)* menu$/, async function (pronounCase, notCase) {
  await assertPresence(this.page.locator('#sidebarmenu .main-nav-container'), notCase, {
    label: 'the administrator sidebar menu (`#sidebarmenu`)',
    hint: 'The sidebar is part of the Atum template and shows once a user is logged in to the administrator; on a narrow viewport it is collapsed behind the "Toggle Menu" button.',
    timeout: budget(this),
  });
});

/**
 * Locate the link of an administrator menu path ("Content > Articles") in the
 * Atum sidebar, opening the parent entries on the way. Returns the final link.
 *
 * @param {object} world
 * @param {string} path
 * @param {boolean} expand - Open the parent entries so the final link is visible.
 * @returns {Promise<import('playwright').Locator>}
 */
async function sidebarLink(world, path, expand) {
  const segments = String(path).split('>').map((part) => part.trim()).filter(Boolean);
  const xpathLiteral = (text) => (text.includes("'") ? `concat('${text.split("'").join(`', "'", '`)}')` : `'${text}'`);
  let scope = world.page.locator('#sidebarmenu .main-nav-container > ul');
  let link = null;
  for (let index = 0; index < segments.length; index++) {
    const item = scope.locator(`xpath=./li[a[normalize-space(@aria-label)=${xpathLiteral(segments[index])}]]`).first();
    if (!(await item.count())) {
      throw friendly({
        message: `The administrator menu has no "${segments.slice(0, index + 1).join(' > ')}" entry.`,
        hint: 'Write the path the way the sidebar shows it, from the top entry down ("Content > Articles", "Components > Smart Search > Index"); the entries a user may not see are not in the menu.',
      });
    }
    link = item.locator('xpath=./a').first();
    if (index < segments.length - 1) {
      scope = item.locator('xpath=./ul');
      if (expand && (await link.getAttribute('aria-expanded')) === 'false') {
        await link.click();
        // The submenu opens with a height transition: wait until it is open and
        // has stopped growing, or the next click lands on a moving target.
        const submenu = await scope.first().elementHandle();
        await world.page.waitForFunction((el) => {
          const height = el.getBoundingClientRect().height;
          const settled = height > 0 && el.__joomlaStepsHeight === height;
          el.__joomlaStepsHeight = height;
          return settled;
        }, submenu, { polling: 100, timeout: budget(world) });
      }
    }
  }
  return link;
}

/**
 * Follow an entry of the administrator sidebar menu by its path from the top
 * entry, for example "Content > Articles" or "System".
 *
 * Example #1: When I open the administrator menu item "Content > Articles"
 * Example #2: When I open the administrator menu item "Users > Manage"
 * Example #3: When we open the administrator menu item "Menus > All Menu Items"
 * Example #4: And I open the admin menu item "Home Dashboard"
 * Example #5: When open the administrator menu item "Components > Smart Search > Index"
 *
 */
When(/^(I |we )*open the admin(?:istrator)* menu item "([^"]*)?"$/, async function (pronounCase, path) {
  await actOrExplain('open the administrator menu item', path, async () => {
    await this.page.locator('#sidebarmenu .main-nav-container').first().waitFor({ state: 'visible', timeout: budget(this) });
    const link = await sidebarLink(this, path, true);
    await link.click({ timeout: budget(this) });
  }, 'Write the path the way the sidebar shows it, from the top entry down; log in to the administrator first.');
  await smartSettle(this.page, (this.minWaitTime && this.minWaitTime.page) || 3000);
});

/**
 * Assert an entry of the administrator sidebar menu is (or is not) in the menu,
 * by its path from the top entry. The check looks at the menu markup, so a
 * collapsed parent entry does not hide its children from it.
 *
 * Example #1: Then I should see the administrator menu item "Content > Articles"
 * Example #2: Then I should see the administrator menu item "Components > Smart Search"
 * Example #3: Then we should not see the administrator menu item "System > Global Configuration"
 * Example #4: And I should see the admin menu item "Users > Access Levels"
 * Example #5: Then should see the administrator menu item "Home Dashboard"
 *
 */
Then(/^(I |we )*should( not)* see the admin(?:istrator)* menu item "([^"]*)?"$/, async function (pronounCase, notCase, path) {
  await this.page.locator('#sidebarmenu .main-nav-container').first().waitFor({ state: 'attached', timeout: budget(this) }).catch((err) => {
    throw friendly({ message: 'The administrator sidebar menu is not on the page.', cause: err, hint: 'Log in to the administrator first.' });
  });
  let present = true;
  try {
    await sidebarLink(this, path, false);
  } catch {
    present = false;
  }
  if (present === !!notCase) {
    throw friendly({
      message: notCase ? `Expected the administrator menu not to have "${path}", but it does.` : `Expected the administrator menu to have "${path}", but it does not.`,
      hint: 'Write the path the way the sidebar shows it, from the top entry down ("Content > Articles"); the entries a user may not see are not in the menu.',
    });
  }
});

// ---------------------------------------------------------------------------
// Toolbar
// ---------------------------------------------------------------------------

/**
 * Press a button of the administrator toolbar by its text ("New", "Save",
 * "Save & Close", "Cancel", "Publish", "Trash", "Check-in", ...). Buttons inside
 * the "Actions" dropdown are reached by opening it first. A disabled button (a
 * list action with no row selected) fails with a hint.
 *
 * Example #1: When I click the "New" toolbar button
 * Example #2: When I click the "Save & Close" toolbar button
 * Example #3: When we click the "Cancel" toolbar button
 * Example #4: And I click the "Publish" toolbar button
 * Example #5: When click the "Trash" toolbar button
 *
 */
When(/^(I |we )*click the "([^"]*)?" toolbar button$/, async function (pronounCase, name) {
  await clickToolbarButton(this, name);
});

/**
 * Assert a button with the given text is (or is not) in the administrator
 * toolbar. A button inside the "Actions" dropdown counts; its markup is in the
 * page even while the dropdown is closed.
 *
 * Example #1: Then I should see the "New" toolbar button
 * Example #2: Then I should see the "Save & Close" toolbar button
 * Example #3: Then we should not see the "Delete" toolbar button
 * Example #4: And I should see the "Publish" toolbar button
 * Example #5: Then should see the "Options" toolbar button
 *
 */
Then(/^(I |we )*should( not)* see the "([^"]*)?" toolbar button$/, async function (pronounCase, notCase, name) {
  const buttons = this.page.locator('#toolbar joomla-toolbar-button button, #toolbar joomla-toolbar-button a').filter({ hasText: exactly(name) });
  await assertPresence(buttons, notCase, {
    label: `the "${name}" toolbar button`,
    hint: 'The toolbar belongs to the administrator page the scenario is on; the button text is matched exactly (for example "Save & Close"). Some buttons show only for an account that may use them.',
    timeout: budget(this),
    state: 'attached',
  });
});

// ---------------------------------------------------------------------------
// Dashboard and version
// ---------------------------------------------------------------------------

/**
 * Assert a module of the administrator Dashboard (a panel of `#cpanel-modules`,
 * such as "Site Information", "Logged-in Users" or "Popular Articles") is (or is
 * not) on the page.
 *
 * Example #1: Then I should see the "Logged-in Users" dashboard module
 * Example #2: Then I should see the "Site Information" dashboard module
 * Example #3: Then we should see the "Popular Articles" dashboard module
 * Example #4: And I should not see the "Privacy Dashboard" dashboard module
 * Example #5: Then should see the "Latest Actions" dashboard module
 *
 */
Then(/^(I |we )*should( not)* see the "([^"]*)?" dashboard module$/, async function (pronounCase, notCase, title) {
  await assertPresence(this.page.locator('#cpanel-modules .card-header h2').filter({ hasText: literal(title) }), notCase, {
    label: `the "${title}" dashboard module`,
    hint: 'Open the administrator dashboard first; the modules of the dashboard are the "Administrator" modules in the position "cpanel" and can be unpublished or restricted by access level.',
    timeout: budget(this),
  });
});

/**
 * Assert the Joomla version the System Information page reports. "be" compares
 * the whole version ("6.2.0"), "start with" a part of it ("6" or "6.2").
 *
 * Example #1: Then the Joomla version should start with "6"
 * Example #2: Then the Joomla version should be "6.2.0"
 * Example #3: Then the Joomla version should start with "6.2"
 * Example #4: And the Joomla version should not start with "3"
 * Example #5: Then the Joomla version should not be "4.0.0"
 *
 */
Then(/^the Joomla version should( not)* (be|start with) "([^"]*)?"$/, async function (notCase, mode, expected) {
  await openAdminPage(this, 'System Information');
  const row = this.page.locator('tr', { has: this.page.locator('th, td', { hasText: /^\s*Joomla! Version\s*$/ }) }).first();
  const text = await row.innerText({ timeout: budget(this) }).catch((err) => {
    throw friendly({ message: 'The System Information page has no "Joomla! Version" row.', cause: err, hint: 'Log in as a Super User: the page is for the Super Users group only.' });
  });
  const found = (text.match(/Joomla!\s+(\d+(?:\.\d+){1,3})/) || [])[1];
  if (!found) throw friendly({ message: `The version row says "${text.trim()}", with no version number.`, hint: 'The row of the System Information page should read "Joomla! 6.2.0 Stable".' });
  const ok = mode === 'be' ? found === expected : found === expected || found.startsWith(expected + '.');
  if (ok === !!notCase) {
    throw friendly({
      message: `Expected the Joomla version ${notCase ? 'not ' : ''}to ${mode} "${expected}", but it is ${found}.`,
      hint: 'The version is the one the System Information page reports for the site under test.',
    });
  }
});
