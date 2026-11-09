'use strict';

// Joomla administrator step definitions: logging into and out of the
// /administrator control panel, and asserting the outcome (dashboard vs.
// invalid-credentials message). Complements the front-office coverage in
// joomla.steps.js — see README.md "When to add a step".
//
// Every assertion waits on its locator (the assertion is the wait), and
// every failure is a friendly error with a hint instead of a raw Playwright
// timeout stack.

const { Given, When, Then } = require('@cucumber/cucumber');
const { smartSettle, gotoUrl, waitForPageLoad, friendly } = require('webship-js/tests/step-definitions/webship');

const ADMIN_HINT = 'The administrator template may have changed; check the login form (`#form-login`) and the Dashboard markup (`#cpanel-modules`).';

function siteRoot(launchUrl) {
  return String(launchUrl).replace(/\/$/, '');
}

/** The per-assertion wait budget: `minWaitTime.page` from cucumber.js, else 10 s. */
function budget(world) {
  return Math.max((world.minWaitTime && world.minWaitTime.page) || 0, 10000);
}

/**
 * Run a locator action and rethrow as a friendly error (action, target,
 * cause and a hint) instead of Playwright's raw timeout stack — keeps
 * failures readable when a Joomla admin template change moves a selector.
 */
async function actOrExplain(label, target, fn, hint = ADMIN_HINT) {
  try {
    return await fn();
  } catch (err) {
    throw friendly({ action: label, target, cause: err, hint });
  }
}

/**
 * Wait until `locator` has (or, with `notCase`, has no) visible match, then
 * throw a friendly error otherwise: the wait and the assertion are one call.
 */
async function assertPresence(locator, notCase, { label, hint, timeout }) {
  try {
    await locator.first().waitFor({ state: notCase ? 'hidden' : 'visible', timeout });
  } catch {
    throw friendly({
      message: notCase ? `Expected not to see ${label}, but it is still on the page.` : `Expected ${label}, but it did not appear within ${timeout} ms.`,
      hint,
    });
  }
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


/**
 * Fill in and submit the administrator login form (`#form-login`), then
 * wait for one of its two outcomes: the Dashboard or the invalid-login
 * alert. The submit is dispatched as an in-page click so the navigation
 * it triggers is awaited together with it, rather than racing a detached
 * Playwright click against the page unload. A correct first login after a
 * fresh install can take far longer than usual (cold PHP setup), so the
 * outcome wait has its own long budget instead of relying on smartSettle.
 * Joomla's one-time "Welcome to Joomla!" guided-tour modal is dismissed
 * when it shows, since it overlays the whole Dashboard.
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
 * Open the Joomla administrator login page (`/administrator`) as an
 * anonymous visitor.
 *
 * Example #1: Given I am on the administrator login page
 * Example #2: Given we are on the administrator login page
 * Example #3: Given I am on the admin login page
 * Example #4: Given on the administrator login page
 * Example #5: Given we are on the admin login page
 *
 */
Given(/^(I am |we are )*on the admin(?:istrator)* login page$/, async function (pronounCase) {
  const defaultTime = this.minWaitTime.page || 3000;
  await gotoUrl(this.page, siteRoot(this.launchUrl) + '/administrator');
  await waitForLoginForm(this);
  await waitForPageLoad(this.page, defaultTime);
});

/**
 * Fill in and submit the Joomla administrator login form
 * (`#form-login`) with the given username/password, then wait for the
 * page to settle on either the dashboard or the login error message.
 *
 * Example #1: When I log in to the administrator panel as "admin" with password "admin"
 * Example #2: When I log into the administrator panel as "admin" with password "admin"
 * Example #3: When we log in to the administrator panel as "editor" with password "Secr3t!23"
 * Example #4: And I log in to the administrator panel as "admin" with password "wrong-password"
 * Example #5: When I log into the administrator panel as "admin" with password "WrongPass1!"
 *
 */
When(/^(I |we )*log in(?:to| to) the administrator panel as "([^"]*)?" with password "([^"]*)?"$/, { timeout: 120000 }, async function (pronounCase, username, password) {
  await submitAdminLogin(this, username, password);
});

/**
 * Log in to the administrator panel as a user from the `users` registry in
 * cucumber.js `worldParameters` (`{ <key>: { username, password } }`, with
 * the password read from an environment variable so no credential has to
 * live in a feature file). Opens `/administrator` first, so no prior
 * "on the administrator login page" step is needed.
 *
 * Example #1: Given I am a logged in user with the "admin" user
 * Example #2: Given we are a logged in user with the username "admin"
 * Example #3: Given I am a logged in user with "admin"
 * Example #4: And a logged in user with username "admin"
 * Example #5: Given I am a logged in user with the username "admin" user
 *
 */
Given(/^(I am |we are )*a logged in user with( the)*( username)* "([^"]*)?"( user)*$/, { timeout: 120000 }, async function (pronounCase, theCase, usernameCase, userKey, userCase) {
  const users = (this.parameters && this.parameters.users) || {};
  const entry = users[userKey];
  if (!entry) {
    throw friendly({
      message: `User "${userKey}" is not configured. Known users: ${Object.keys(users).join(', ') || '(none)'}.`,
      hint: `Add it to worldParameters.users in cucumber.js: users: { ${userKey}: { username: '...', password: process.env.JOOMLA_ADMIN_PASSWORD } }.`,
    });
  }
  const username = entry.username || userKey;
  const password = typeof entry === 'string' ? entry : entry.password;
  if (!password) {
    throw friendly({
      message: `User "${userKey}" has no password configured.`,
      hint: `Set worldParameters.users.${userKey}.password in cucumber.js, ideally from an environment variable such as JOOMLA_ADMIN_PASSWORD.`,
    });
  }
  await gotoUrl(this.page, siteRoot(this.launchUrl) + '/administrator');
  await waitForLoginForm(this);
  await submitAdminLogin(this, username, password);
});

/**
 * Make sure nobody is logged in to the administrator panel: clear the
 * browser's cookies and web storage, load `/administrator` again, and
 * assert the login form (`#form-login`) is showing.
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
  const adminUrl = siteRoot(this.launchUrl) + '/administrator';
  if (this.page.url().startsWith(adminUrl)) {
    await this.page.reload({ waitUntil: 'domcontentloaded' });
  } else {
    await gotoUrl(this.page, adminUrl);
  }
  await waitForLoginForm(this);
  await smartSettle(this.page, 1000);
});

/**
 * Click the "Log out" link in the administrator panel's user menu and wait
 * for the login form to reappear.
 *
 * Example #1: When I log out of the administrator panel
 * Example #2: When we log out of the administrator panel
 * Example #3: And I log out of the administrator panel
 * Example #4: When I log out of the admin panel
 * Example #5: And we log out of the admin panel
 *
 */
When(/^(I |we )*log out of the admin(?:istrator)* panel$/, async function (pronounCase) {
  const userMenuToggle = this.page.getByRole('button', { name: 'User Menu' });
  const logoutLink = this.page.locator('a[href*="task=logout"]').first();
  await actOrExplain('log out of', 'the administrator panel', async () => {
    // The "Log out" link only becomes visible once the header's "User
    // Menu" dropdown is opened.
    await userMenuToggle.waitFor({ state: 'visible', timeout: budget(this) });
    await userMenuToggle.click();
    await logoutLink.waitFor({ state: 'visible', timeout: budget(this) });
    await logoutLink.click();
  }, 'The "Log out" link lives in the header "User Menu" dropdown; you must be logged in to the administrator panel first.');
  await smartSettle(this.page, 1500);
});

// ---------------------------------------------------------------------------
// Assertions
// ---------------------------------------------------------------------------

/**
 * Assert the administrator Dashboard (`com_cpanel`) has (or has not)
 * loaded, identified by its `#cpanel-modules` container. The page `<title>`
 * isn't used for this check — whether it's prefixed with "Home Dashboard"
 * varies by Joomla version/configuration, but the Dashboard's own markup
 * doesn't.
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
  // `.alert-warning`/`.alert-danger` markup exists too, but only inside a
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
 * Assert the administrator login form (`#form-login`) is (or is not)
 * showing, i.e. whether anyone is currently logged in to the control panel.
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
